/**
 * The arrival state of the tutor pane: what the agent already knows about your
 * work on this screen, before you type anything (CLAUDE.md rule 2).
 *
 * Everything here is derived from rows, never from a model. That matters twice
 * over: it is what the pane can show instantly while a model brief is still
 * being written, and it is what survives when the model is unreachable — an
 * outage should cost you the nicer sentence, not the true one.
 *
 * The evidence lines are never model-authored, whatever else changes. "Every
 * claim about a person shows its evidence" is only worth anything if the
 * evidence itself is drawn straight from the data.
 *
 * No database or alias imports, so this stays testable on its own.
 */

export interface DerivedBrief {
  /** One sentence, in the second person, about where they actually are. */
  text: string;
  /** The rows it was drawn from. Rendered beneath it in --dim. */
  evidence: string[];
}

function countOf(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

function when(date: Date, now: Date): string {
  const days = Math.floor((now.getTime() - date.getTime()) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  return `${days}d ago`;
}

export interface LessonBriefInput {
  kind: "lesson";
  title: string;
  hasTranscript: boolean;
  completedAt: Date | null;
  /** Exercises attached to this lesson, and whether they've been proven. */
  exercises: { title: string; proven: boolean; attempted: boolean }[];
}

export interface ExerciseBriefInput {
  kind: "exercise";
  title: string;
  totalChecks: number;
  attemptCount: number;
  latest: {
    passed: boolean;
    proven: boolean;
    failedChecks: string[];
    passedChecks: number;
    at: Date;
    hintsUsed: number;
  } | null;
}

export interface ProgressBriefInput {
  kind: "progress";
  proven: number;
  shaky: number;
  untested: number;
  dueRecall: number;
  /** The check failing most often across their attempts, if any. */
  topFailure: { check: string; exercise: string; times: number } | null;
  proposed: string | null;
}

export interface ThreadBriefInput {
  kind: "thread";
  title: string | null;
  replies: number;
  lastReplyAt: Date | null;
  /** True when nobody but the author has said anything. */
  unanswered: boolean;
}

export type BriefInput =
  | LessonBriefInput
  | ExerciseBriefInput
  | ProgressBriefInput
  | ThreadBriefInput;

export function derivedBrief(input: BriefInput, now = new Date()): DerivedBrief {
  switch (input.kind) {
    case "lesson":
      return lessonBrief(input, now);
    case "exercise":
      return exerciseBrief(input, now);
    case "progress":
      return progressBrief(input);
    case "thread":
      return threadBrief(input, now);
  }
}

function lessonBrief(input: LessonBriefInput, now: Date): DerivedBrief {
  const evidence = [
    input.hasTranscript
      ? "transcript read · answers cite it"
      : "no transcript yet · answers come from the wider course",
  ];
  if (input.completedAt) {
    evidence.push(`marked complete ${when(input.completedAt, now)}`);
  }

  const unproven = input.exercises.filter((e) => !e.proven);
  if (unproven.length > 0) {
    evidence.push(
      `${countOf(unproven.length, "exercise")} on this lesson still unproven`,
    );
    return {
      text: `I've read this lesson. ${unproven[0].attempted ? "You've attempted" : "You haven't attempted"} "${unproven[0].title}" yet — that's what would prove you followed it.`,
      evidence,
    };
  }

  if (input.exercises.length > 0) {
    return {
      text: "I've read this lesson, and you've proven every exercise attached to it.",
      evidence: [...evidence, `${countOf(input.exercises.length, "exercise")} proven`],
    };
  }

  return {
    text: "I've read this lesson and can point you at the moment anything in it is explained.",
    evidence,
  };
}

function exerciseBrief(input: ExerciseBriefInput, now: Date): DerivedBrief {
  if (!input.latest) {
    return {
      text: `You haven't run "${input.title}" yet. I can explain what it's asking before you start.`,
      evidence: [
        `no attempts · ${countOf(input.totalChecks, "check")} to pass`,
      ],
    };
  }

  const evidence = [
    `${countOf(input.attemptCount, "attempt")} · last ${when(input.latest.at, now)} · ` +
      `${input.latest.passedChecks}/${input.totalChecks} checks passing`,
  ];
  if (input.latest.hintsUsed > 0) {
    evidence.push(`${countOf(input.latest.hintsUsed, "hint")} taken`);
  }

  if (input.latest.passed) {
    return {
      text: input.latest.proven
        ? "You've passed this one clean — no hints, no solution revealed."
        : "You've passed this, though the solution was revealed first, so it isn't marked proven.",
      evidence,
    };
  }

  const [first, ...rest] = input.latest.failedChecks;
  if (!first) {
    return {
      text: "Your last run didn't pass, and it reported no per-check detail — worth running it again.",
      evidence,
    };
  }

  return {
    text:
      rest.length > 0
        ? `Your last run failed on "${first}" and ${countOf(rest.length, "other check")}. I can explain what that check is getting at.`
        : `Your last run failed on one check: "${first}". I can explain what it's getting at without giving you the fix.`,
    evidence,
  };
}

function progressBrief(input: ProgressBriefInput): DerivedBrief {
  const evidence = [
    `${input.proven} proven · ${input.shaky} shaky · ${input.untested} untested`,
  ];
  if (input.dueRecall > 0) {
    evidence.push(`${countOf(input.dueRecall, "recall check")} due`);
  }

  if (input.topFailure && input.topFailure.times > 1) {
    return {
      text: `"${input.topFailure.check}" has failed ${input.topFailure.times}× on ${input.topFailure.exercise} — that's the pattern worth breaking.`,
      evidence: [
        ...evidence,
        `same check failed ${input.topFailure.times}× across attempts`,
      ],
    };
  }

  if (input.dueRecall > 0) {
    return {
      text: `${countOf(input.dueRecall, "recall check")} came due — those are the ones you'd otherwise quietly forget.`,
      evidence,
    };
  }

  if (input.proposed) {
    return {
      text: `Nothing is decaying, so the next thing is "${input.proposed}".`,
      evidence,
    };
  }

  if (input.proven === 0 && input.untested > 0) {
    return {
      text: "You haven't proven anything yet — attempting one exercise tells me more than any amount of watching.",
      evidence,
    };
  }

  return {
    text: "Nothing is due and nothing is unattempted. Ask me what's worth getting ahead on.",
    evidence,
  };
}

function threadBrief(input: ThreadBriefInput, now: Date): DerivedBrief {
  if (input.unanswered) {
    return {
      text: "Nobody has replied to this yet. I've read it and can tell you which lesson covers it.",
      evidence: ["no replies"],
    };
  }

  return {
    text: `I've read this thread and the ${countOf(input.replies, "reply", "replies")} on it.`,
    evidence: [
      `${countOf(input.replies, "reply", "replies")}` +
        (input.lastReplyAt ? ` · last ${when(input.lastReplyAt, now)}` : ""),
    ],
  };
}
