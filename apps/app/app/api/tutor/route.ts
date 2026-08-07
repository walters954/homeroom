import type Anthropic from "@anthropic-ai/sdk";
import { db, type Prisma } from "@homeroom/db";
import { makeAnthropic, modelFor } from "@/lib/ai";
import { buildGrounding } from "@/lib/tutor/grounding";
import { getCurrentUser } from "@/lib/session";

export const maxDuration = 120;

const SYSTEM_PROMPT = `You are the tutor for this school, built into its course platform (Homeroom). Students ask you questions while watching lessons.

Evidence rules (non-negotiable):
- Teach only from the course material provided in the "Course material" block of each request: transcripts, lesson notes, and excerpts. That corpus is your entire knowledge of this course.
- Always cite where your answer comes from, naming the lesson: e.g. (see "Lesson title" in Section name).
- If the material doesn't contain the answer, say so plainly and point the student to the closest relevant lesson from the provided material instead. Never improvise course content or answer from general knowledge as if the instructor taught it.
- A confidently wrong answer is worse than "that's not covered in this course."

Style: warm, direct, and brief — a couple of short paragraphs at most. This is a chat panel next to a video, not an essay. Answer the question asked; don't recap the whole lesson.`;

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return Response.json({ error: "Not signed in" }, { status: 401 });
  }

  const body = (await request.json()) as {
    message?: string;
    lessonId?: string;
    conversationId?: string;
  };
  const message = body.message?.trim();
  if (!message) {
    return Response.json({ error: "Empty message" }, { status: 400 });
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
      data: { userId: user.id, lessonId: body.lessonId ?? null },
      include: { messages: true },
    });
  }

  const grounding = await buildGrounding(message, body.lessonId ?? null);

  await db.tutorMessage.create({
    data: { conversationId: conversation.id, role: "USER", content: message },
  });

  const history: Anthropic.MessageParam[] = conversation.messages.map((m) => ({
    role: m.role === "USER" ? "user" : "assistant",
    content: m.content,
  }));

  const client = makeAnthropic();
  const stream = client.messages.stream({
    model: await modelFor("simple"),
    max_tokens: 4096,
    output_config: { effort: "low" },
    system: [
      {
        type: "text",
        text: SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [
      ...history,
      {
        role: "user",
        content: `# Course material for this question\n${grounding.contextText}\n\n# Student question\n${message}`,
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
