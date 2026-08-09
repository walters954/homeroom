/**
 * Assembles the non-transcript parts of the tutor's corpus: an exercise and how
 * your attempts went, your practice record, a community thread.
 *
 * Deliberately free of database and alias imports so the guarantees below can
 * be tested directly (`context.test.mjs`).
 *
 * The guarantee that matters is what `exerciseContext` cannot say. It is given
 * the learner-visible contract — the prompt, the starter files, the named
 * checks, their own submission — and never the executable tests or the
 * reference solution. A tutor holding the answer key stops being a tutor: it
 * would recite the assertion you are failing, which is the hint ladder
 * collapsing into a solution, and the product's one non-negotiable is that the
 * agent withholds (docs/PLAN.md; CLAUDE.md rule 2).
 */

export interface ContextFile {
  path: string;
  contents: string;
}

export interface TestOutcome {
  name: string;
  passed: boolean;
  message?: string;
}

const FILE_CHARS = 4000;
const BODY_CHARS = 4000;
const COMMENT_CHARS = 1500;
const MAX_COMMENTS = 20;

function files(list: ContextFile[], cap = FILE_CHARS): string {
  if (list.length === 0) return "(none)\n";
  return list
    .map((f) => `\`${f.path}\`\n\`\`\`\n${f.contents.slice(0, cap)}\n\`\`\`\n`)
    .join("");
}

function when(date: Date, now: Date): string {
  const days = Math.floor((now.getTime() - date.getTime()) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  return `${days} days ago`;
}

export interface ExerciseContextInput {
  title: string;
  /** Markdown: what to build. Learner-visible. */
  prompt: string;
  language: string;
  /** Learner-visible scaffolding. */
  starterFiles: ContextFile[];
  /** The named contract shown to the learner — not the tests that implement it. */
  testSpec: { name: string; description?: string }[];
  attemptCount: number;
  latest: {
    files: ContextFile[];
    passed: boolean;
    results: TestOutcome[];
    hintsUsed: number;
    at: Date;
  } | null;
}

export function exerciseContext(
  input: ExerciseContextInput,
  now = new Date(),
): string {
  const parts: string[] = [
    `## The exercise the student is on: "${input.title}" (${input.language})\n` +
      `### Brief\n${input.prompt.slice(0, BODY_CHARS)}\n`,
  ];

  if (input.testSpec.length > 0) {
    parts.push(
      `### The checks it has to pass (names only — you do not have the tests themselves)\n` +
        input.testSpec
          .map((s) => `- ${s.name}${s.description ? `: ${s.description}` : ""}`)
          .join("\n") +
        "\n",
    );
  }

  parts.push(`### Starter files\n${files(input.starterFiles)}`);

  if (!input.latest) {
    parts.push(
      "### Their attempts\nThey have not submitted anything yet, so you cannot see any code of theirs.\n",
    );
    return parts.join("\n");
  }

  const failed = input.latest.results.filter((r) => !r.passed);
  parts.push(
    `### Their latest submission (${when(input.latest.at, now)}, attempt ${input.attemptCount})\n` +
      files(input.latest.files),
  );
  parts.push(
    `### How that run went\n` +
      (input.latest.passed
        ? "It passed.\n"
        : failed.length > 0
          ? `It failed. Checks that did not pass:\n` +
            failed
              .map((r) => `- ${r.name}${r.message ? ` — ${r.message}` : ""}`)
              .join("\n") +
            "\n"
          : "It did not pass, and the run reported no per-check detail.\n") +
      (input.latest.hintsUsed > 0
        ? `They have taken ${input.latest.hintsUsed} hint(s) on this exercise.\n`
        : "They have not taken any hints.\n"),
  );

  return parts.join("\n");
}

export interface ProgressContextInput {
  skills: {
    name: string;
    course: string;
    status: string;
    attemptCount: number;
  }[];
  dueRecall: {
    skillName: string;
    dueAt: Date;
    intervalDays: number;
    streak: number;
    lastResult: boolean | null;
  }[];
  /** Failures grouped by the check that keeps failing — the error pattern. */
  repeatedFailures: {
    exercise: string;
    skill: string;
    check: string;
    times: number;
  }[];
  proposed: { title: string; reason: string } | null;
}

export function progressContext(
  input: ProgressContextInput,
  now = new Date(),
): string {
  const parts: string[] = [];

  parts.push(
    `## This student's practice record\n` +
      `### What they've proven\n` +
      (input.skills.length === 0
        ? "(no skills in their courses yet)\n"
        : input.skills
            .map(
              (s) =>
                `- ${s.name} (${s.course}) — ${s.status.toLowerCase()}, ${s.attemptCount} attempt(s)`,
            )
            .join("\n") + "\n"),
  );

  parts.push(
    `### Recall due\n` +
      (input.dueRecall.length === 0
        ? "Nothing is due.\n"
        : input.dueRecall
            .map(
              (r) =>
                `- ${r.skillName} — due ${when(r.dueAt, now)}, every ${r.intervalDays}d, ` +
                `${r.streak} in a row${r.lastResult === false ? ", last one missed" : ""}`,
            )
            .join("\n") + "\n"),
  );

  if (input.repeatedFailures.length > 0) {
    parts.push(
      `### Checks they keep failing\n` +
        input.repeatedFailures
          .map(
            (f) =>
              `- "${f.check}" on ${f.exercise} (${f.skill}) — failed ${f.times}×`,
          )
          .join("\n") +
        "\n",
    );
  }

  if (input.proposed) {
    parts.push(
      `### What Today is proposing next\n${input.proposed.title} — ${input.proposed.reason}\n`,
    );
  }

  return parts.join("\n");
}

export interface ThreadContextInput {
  space: string;
  title: string | null;
  author: string;
  body: string;
  comments: { author: string; body: string; at: Date }[];
}

export function threadContext(
  input: ThreadContextInput,
  now = new Date(),
): string {
  const header = input.title
    ? `"${input.title}" in #${input.space}`
    : `a thread in #${input.space}`;

  const comments =
    input.comments.length === 0
      ? "(no replies yet)\n"
      : input.comments
          .slice(0, MAX_COMMENTS)
          .map(
            (c) =>
              `**${c.author}** (${when(c.at, now)}): ${c.body.slice(0, COMMENT_CHARS)}`,
          )
          .join("\n\n") + "\n";

  return (
    `## The community thread the student is reading: ${header}\n` +
    `**${input.author}** opened it: ${input.body.slice(0, BODY_CHARS)}\n\n` +
    `### Replies\n${comments}`
  );
}
