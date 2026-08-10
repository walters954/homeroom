import { db, type User } from "@homeroom/db";
import { makeAnthropic, modelFor } from "@/lib/ai";
import { parseTestResults } from "@homeroom/exercise-runner";
import {
  getPracticeSnapshot,
  isAttempt,
  isGenuinePass,
} from "@/lib/practice";
import { scopeContext } from "@/lib/tutor/grounding";
import { derivedBrief, type BriefInput, type DerivedBrief } from "./brief-text";
import { scopeKey, type AgentScope } from "./scope";

/**
 * The arrival brief: what the agent already did before you got here.
 *
 * Two costs are being managed. A model call on every page view would put real
 * latency on `/today`, which is the app's home — so a brief is cached against a
 * *state fingerprint* (their last submission, what's due, the thread's last
 * reply) and rewritten only when that state actually moves. Reloading the same
 * screen six times pays for one call.
 *
 * And the model is never on the critical path: the route flushes the derived
 * brief first and the model's version second, so a slow or unreachable gateway
 * costs the nicer sentence and nothing else.
 */

export interface Brief extends DerivedBrief {
  /** True once the model's version has replaced the derived sentence. */
  written: boolean;
}

export interface ScopeState {
  input: BriefInput;
  /** Changes exactly when there is something new to say. */
  fingerprint: string;
}

async function lessonState(
  lessonId: string,
  user: User,
): Promise<ScopeState | null> {
  const lesson = await db.lesson.findUnique({
    where: { id: lessonId },
    select: {
      title: true,
      transcript: { select: { id: true } },
      exercises: { select: { id: true, title: true } },
    },
  });
  if (!lesson) return null;

  const [progress, submissions] = await Promise.all([
    db.lessonProgress.findUnique({
      where: { userId_lessonId: { userId: user.id, lessonId } },
      select: { completedAt: true },
    }),
    db.submission.findMany({
      where: {
        userId: user.id,
        exerciseId: { in: lesson.exercises.map((e) => e.id) },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const exercises = lesson.exercises.map((exercise) => {
    const mine = submissions.filter((s) => s.exerciseId === exercise.id);
    return {
      title: exercise.title,
      proven: mine.some(isGenuinePass),
      attempted: mine.some(isAttempt),
    };
  });

  return {
    input: {
      kind: "lesson",
      title: lesson.title,
      hasTranscript: Boolean(lesson.transcript),
      completedAt: progress?.completedAt ?? null,
      exercises,
    },
    fingerprint: [
      lessonId,
      progress?.completedAt?.getTime() ?? 0,
      submissions[0]?.id ?? "",
    ].join(":"),
  };
}

async function exerciseState(
  exerciseId: string,
  user: User,
): Promise<ScopeState | null> {
  const exercise = await db.exercise.findUnique({
    where: { id: exerciseId },
    // testFiles and solutionFiles are deliberately absent — see lib/tutor/context.ts.
    select: { title: true, testSpec: true },
  });
  if (!exercise) return null;

  const submissions = await db.submission.findMany({
    where: { userId: user.id, exerciseId },
    orderBy: { createdAt: "desc" },
  });
  const attempts = submissions.filter(isAttempt);
  const latest = attempts[0] ?? null;
  const results = latest ? parseTestResults(latest.testResults) : [];
  const totalChecks = Array.isArray(exercise.testSpec)
    ? exercise.testSpec.length
    : results.length;

  return {
    input: {
      kind: "exercise",
      title: exercise.title,
      totalChecks,
      attemptCount: attempts.length,
      latest: latest && {
        passed: latest.passed,
        proven: isGenuinePass(latest),
        failedChecks: results.filter((r) => !r.passed).map((r) => r.name),
        passedChecks: results.filter((r) => r.passed).length,
        at: latest.createdAt,
        hintsUsed: latest.hintsUsed,
      },
    },
    fingerprint: [exerciseId, attempts.length, latest?.id ?? ""].join(":"),
  };
}

async function progressState(user: User): Promise<ScopeState> {
  const snapshot = await getPracticeSnapshot(user);

  const submissions = await db.submission.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 60,
    include: { exercise: { select: { title: true } } },
  });

  const counts = new Map<
    string,
    { check: string; exercise: string; times: number }
  >();
  for (const submission of submissions) {
    if (!isAttempt(submission)) continue;
    for (const result of parseTestResults(submission.testResults)) {
      if (result.passed) continue;
      const key = `${submission.exerciseId}:${result.name}`;
      const seen = counts.get(key);
      if (seen) seen.times += 1;
      else
        counts.set(key, {
          check: result.name,
          exercise: submission.exercise.title,
          times: 1,
        });
    }
  }
  const topFailure =
    [...counts.values()].sort((a, b) => b.times - a.times)[0] ?? null;

  const status = (want: string) =>
    snapshot.skills.filter((s) => s.status === want).length;

  return {
    input: {
      kind: "progress",
      proven: status("PROVEN"),
      shaky: status("SHAKY"),
      untested: status("UNTESTED"),
      dueRecall: snapshot.dueRecall.length,
      topFailure,
      proposed: snapshot.ranked[0]?.title ?? null,
    },
    fingerprint: [
      submissions[0]?.id ?? "",
      snapshot.dueRecall.length,
      snapshot.dueRecall[0]?.dueAt.getTime() ?? 0,
    ].join(":"),
  };
}

async function threadState(postId: string): Promise<ScopeState | null> {
  const post = await db.post.findUnique({
    where: { id: postId },
    select: {
      title: true,
      authorId: true,
      comments: {
        orderBy: { createdAt: "desc" },
        select: { id: true, authorId: true, createdAt: true },
      },
    },
  });
  if (!post) return null;

  return {
    input: {
      kind: "thread",
      title: post.title,
      replies: post.comments.length,
      lastReplyAt: post.comments[0]?.createdAt ?? null,
      unanswered: post.comments.every((c) => c.authorId === post.authorId),
    },
    fingerprint: [
      postId,
      post.comments.length,
      post.comments[0]?.id ?? "",
    ].join(":"),
  };
}

async function stateFor(
  scope: AgentScope,
  user: User,
): Promise<ScopeState | null> {
  switch (scope.kind) {
    case "lesson":
      return lessonState(scope.lessonId, user);
    case "exercise":
      return exerciseState(scope.exerciseId, user);
    case "progress":
      return progressState(user);
    case "thread":
      return threadState(scope.postId);
  }
}

const SYSTEM = `You write the opening line of a tutor panel, shown to a student the moment a page loads, before they have asked anything.

Rules:
- One sentence. Two at the absolute most. Second person.
- Say what you can see about their work and what it means for what to do next.
- Use only the facts you are given. Never invent an attempt, a date, a score or a lesson.
- You are not answering a question and not greeting them. No "Hi", no "Let me know if…".
- If the exercise context says you cannot see the tests or the solution, do not imply otherwise, and never state the fix.
- Plain sentences. No markdown, no bullets, no quotes around the whole line.`;

/**
 * Ask the model to improve on the derived sentence, given the same context the
 * tutor would answer from. Returns null on any failure — the caller keeps the
 * derived brief, which was already true.
 */
async function writeBrief(
  scope: AgentScope,
  user: User,
  derived: DerivedBrief,
): Promise<string | null> {
  try {
    const { text } = await scopeContext(scope, user);
    const client = await makeAnthropic();
    const message = await client.messages.create({
      model: await modelFor("simple"),
      max_tokens: 200,
      output_config: { effort: "low" },
      system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
      messages: [
        {
          role: "user",
          content:
            `# What this screen is\n${text ?? "(no additional context)"}\n\n` +
            `# The facts, already established\n${derived.text}\n` +
            derived.evidence.map((e) => `- ${e}`).join("\n"),
        },
      ],
    });

    const written = message.content
      .flatMap((block) => (block.type === "text" ? [block.text] : []))
      .join("")
      .trim();
    return written.length > 0 ? written : null;
  } catch {
    // Same contract as lib/notify.ts: an integration that isn't reachable
    // degrades, it doesn't take the screen down with it.
    return null;
  }
}

/**
 * The derived brief, instantly. Callers flush this before doing anything that
 * can be slow.
 */
export async function openingBrief(
  scope: AgentScope,
  user: User,
  now = new Date(),
): Promise<{ brief: Brief; state: ScopeState } | null> {
  const state = await stateFor(scope, user);
  if (!state) return null;
  return {
    brief: { ...derivedBrief(state.input, now), written: false },
    state,
  };
}

/**
 * The model's version — from cache when the state hasn't moved, otherwise
 * written fresh and stored. Null means keep showing the derived brief.
 */
export async function writtenBrief(
  scope: AgentScope,
  user: User,
  state: ScopeState,
  derived: DerivedBrief,
): Promise<string | null> {
  const key = scopeKey(scope);
  const cached = await db.agentBrief.findUnique({
    where: { userId_scopeKey: { userId: user.id, scopeKey: key } },
  });
  if (cached && cached.fingerprint === state.fingerprint) return cached.text;

  const text = await writeBrief(scope, user, derived);
  if (!text) return null;

  await db.agentBrief.upsert({
    where: { userId_scopeKey: { userId: user.id, scopeKey: key } },
    create: {
      userId: user.id,
      scopeKey: key,
      fingerprint: state.fingerprint,
      text,
    },
    update: { fingerprint: state.fingerprint, text },
  });
  return text;
}
