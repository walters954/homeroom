import type Anthropic from "@anthropic-ai/sdk";
import { db, type Prisma } from "@homeroom/db";
import { makeAnthropic, modelFor } from "@/lib/ai";
import { getBranding } from "@/lib/settings";
import { buildGrounding } from "@/lib/tutor/grounding";
import { parseScope, scopeKey, type AgentScope } from "@/lib/agent/scope";
import { getCurrentUser } from "@/lib/session";

export const maxDuration = 120;

/**
 * What the tutor is allowed to know, per scope. The exercise clause is the
 * load-bearing one: the corpus withholds the tests and the solution, and this
 * stops the model filling the gap from general knowledge instead.
 */
const SCOPE_RULES: Record<AgentScope["kind"], string> = {
  lesson: "",
  exercise: `
You are sitting beside an exercise the student is working on. You can see the brief, the starter files, the names of the checks it has to pass, their own submission and which checks failed. You do not have the tests themselves and you do not have a reference solution — do not pretend otherwise, and do not reconstruct either one.

Never write the solution, a complete implementation, or the specific line that would turn a failing check green. Explain the idea, ask what they have already tried, and name the concept they are missing. Handing over the answer is what the hint ladder is for, and its last rung costs them the proven mark — so it is not yours to give away for free. If they ask you outright for the answer, say plainly that you won't, say why, and offer the next question that would get them there.`,
  progress: `
The context block contains this student's own practice record: what they have proven, what is due for recall, the checks they keep failing, and what Today is proposing next. Talk about it directly and concretely, quoting the rows you were given. Never invent progress, attempts or dates you were not shown.`,
  thread: `
The context block contains a community thread. Summarise and explain it, and connect it back to the course material where you can. Attribute what people said to them by name, and don't put words in their mouths.`,
};

const systemPrompt = (schoolName: string, kind: AgentScope["kind"]) =>
  `You are the tutor for ${schoolName}, built into its course platform. Students ask you questions while they practise.

Evidence rules (non-negotiable):
- Teach only from what you are given in the "Context for this question" block: transcripts, lesson notes, excerpts, and whatever the current screen has put there. That block is your entire knowledge of this school.
- Always cite where your answer comes from, naming the lesson: e.g. (see "Lesson title" in Section name).
- If the context doesn't contain the answer, say so plainly and point the student to the closest relevant lesson from it instead. Never improvise course content or answer from general knowledge as if the instructor taught it.
- A confidently wrong answer is worse than "that's not covered in this course."
${SCOPE_RULES[kind]}

Style: warm, direct, and brief — a couple of short paragraphs at most. This is a chat panel beside the work, not an essay. Answer the question asked; don't recap the whole lesson.`;

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return Response.json({ error: "Not signed in" }, { status: 401 });
  }

  const body = (await request.json()) as {
    message?: string;
    scope?: unknown;
    conversationId?: string;
  };
  const message = body.message?.trim();
  if (!message) {
    return Response.json({ error: "Empty message" }, { status: 400 });
  }
  const scope = parseScope(body.scope);
  if (!scope) {
    return Response.json({ error: "Unknown scope" }, { status: 400 });
  }

  // Load or create the conversation, scoped to this user.
  let conversation = body.conversationId
    ? await db.tutorConversation.findFirst({
        where: { id: body.conversationId, userId: user.id },
        include: { messages: { orderBy: { createdAt: "asc" }, take: 20 } },
      })
    : null;
  if (!conversation) {
    conversation = await db.tutorConversation.create({
      data: {
        userId: user.id,
        scopeKey: scopeKey(scope),
        lessonId: scope.kind === "lesson" ? scope.lessonId : null,
      },
      include: { messages: true },
    });
  }

  const grounding = await buildGrounding(message, scope, user);

  await db.tutorMessage.create({
    data: { conversationId: conversation.id, role: "USER", content: message },
  });

  const history: Anthropic.MessageParam[] = conversation.messages.map((m) => ({
    role: m.role === "USER" ? "user" : "assistant",
    content: m.content,
  }));

  const client = await makeAnthropic();
  const stream = client.messages.stream({
    model: await modelFor("simple"),
    max_tokens: 4096,
    output_config: { effort: "low" },
    system: [
      {
        type: "text",
        text: systemPrompt((await getBranding()).schoolName, scope.kind),
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [
      ...history,
      {
        role: "user",
        content: `# Context for this question\n${grounding.contextText}\n\n# Student question\n${message}`,
      },
    ],
  });

  const conversationId = conversation.id;
  const encoder = new TextEncoder();
  const readable = new ReadableStream<Uint8Array>({
    async start(controller) {
      let assistantText = "";
      try {
        for await (const event of stream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            assistantText += event.delta.text;
            controller.enqueue(encoder.encode(event.delta.text));
          }
        }
        const final = await stream.finalMessage();
        if (final.stop_reason === "refusal" && !assistantText) {
          const notice = "I can't help with that here — try asking about the course material.";
          assistantText = notice;
          controller.enqueue(encoder.encode(notice));
        }
        if (assistantText) {
          await db.tutorMessage.create({
            data: {
              conversationId,
              role: "ASSISTANT",
              content: assistantText,
              citations: grounding.sources as unknown as Prisma.InputJsonValue,
            },
          });
        }
        controller.close();
      } catch (err) {
        controller.error(err);
      }
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "X-Conversation-Id": conversation.id,
      "Cache-Control": "no-store",
    },
  });
}
