import {
  db,
  type Skill,
  type SkillState,
  type SkillStatus,
  type Submission,
  type User,
} from "@homeroom/db";
import { parseTestResults } from "./exercises/runner";

/**
 * The practice loop, in one place: how a submission turns into a skill
 * assessment, and how the agent picks the one thing to do next.
 *
 * A note on the submission ledger: a Submission whose `testResults` is empty
 * has not been run — it exists only to carry hint state (hintsUsed /
 * solutionRevealed) from before the first run. Everything a person sees as an
 * "attempt" — pips, attempt counts, pass rates — counts only run submissions,
 * so opening a hint never inflates a failure record.
 */

export const MS_DAY = 86_400_000;

/** A run submission — something was actually checked. */
export function isAttempt(s: Pick<Submission, "testResults">): boolean {
  return parseTestResults(s.testResults).length > 0;
}

/** A pass the learner earned: tests green, solution never revealed. */
export function isGenuinePass(
  s: Pick<Submission, "passed" | "solutionRevealed">,
): boolean {
  return s.passed && !s.solutionRevealed;
}

export function daysSince(date: Date, now = new Date()): number {
  return Math.floor((now.getTime() - date.getTime()) / MS_DAY);
}

export function relativeDays(date: Date, now = new Date()): string {
  const d = daysSince(date, now);
  if (d <= 0) return "today";
  if (d === 1) return "yesterday";
  if (d < 7) return `${d} days ago`;
  if (d < 14) return "last week";
  if (d < 60) return `${Math.round(d / 7)} weeks ago`;
  return `${Math.round(d / 30)} months ago`;
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

export function countTimes(n: number): string {
  if (n === 1) return "once";
  if (n === 2) return "twice";
  return `${n} times`;
}

// ---------------------------------------------------------------------------
// Skill state derivation — recomputed from submissions, never incremented
// blindly, so a replay of the history always produces the same assessment.
// ---------------------------------------------------------------------------

export interface DerivedSkillState {
  status: SkillStatus;
  provenCount: number;
  attemptCount: number;
  lastProvenAt: Date | null;
  everUsedHints: boolean;
  /** Failed runs recorded after the most recent genuine pass. */
  failsSinceProven: number;
  /** True when the last spaced check on this skill was answered wrong. */
  missedRecall: boolean;
}

export function deriveStatus(input: {
  attemptCount: number;
  provenCount: number;
  failsSinceProven: number;
  missedRecall: boolean;
}): SkillStatus {
  if (input.attemptCount === 0 && input.provenCount === 0) return "UNTESTED";
  if (input.provenCount === 0) return "SHAKY";
  if (input.failsSinceProven > 0 || input.missedRecall) return "SHAKY";
  return "PROVEN";
}

/**
 * Recompute one member's assessment of one skill from the evidence, persist it,
 * and open a spaced-recall schedule the first time the skill is proven.
 * Called after every submission.
 */
export async function deriveSkillState(
  userId: string,
  skillId: string,
): Promise<SkillState> {
  const [submissions, recallItem, questionCount] = await Promise.all([
    db.submission.findMany({
      where: { userId, exercise: { skillId } },
      orderBy: { createdAt: "asc" },
    }),
    db.recallItem.findUnique({
      where: { userId_skillId: { userId, skillId } },
    }),
    db.recallQuestion.count({ where: { skillId } }),
  ]);

  const attempts = submissions.filter(isAttempt);
  const passes = attempts.filter(isGenuinePass);
  const lastProvenAt = passes.length > 0 ? passes[passes.length - 1].createdAt : null;
  const failsSinceProven = attempts.filter(
    (s) => !s.passed && (!lastProvenAt || s.createdAt > lastProvenAt),
  ).length;

  const derived: DerivedSkillState = {
    attemptCount: attempts.length,
    provenCount: passes.length,
    lastProvenAt,
    everUsedHints: submissions.some((s) => s.hintsUsed > 0 || s.solutionRevealed),
    failsSinceProven,
    missedRecall: recallItem?.lastResult === false,
    status: "UNTESTED",
  };
  derived.status = deriveStatus(derived);

  const state = await db.skillState.upsert({
    where: { userId_skillId: { userId, skillId } },
    create: {
      userId,
      skillId,
      status: derived.status,
      provenCount: derived.provenCount,
      attemptCount: derived.attemptCount,
      lastProvenAt: derived.lastProvenAt,
      everUsedHints: derived.everUsedHints,
    },
    update: {
      status: derived.status,
      provenCount: derived.provenCount,
      attemptCount: derived.attemptCount,
      lastProvenAt: derived.lastProvenAt,
      everUsedHints: derived.everUsedHints,
    },
  });

  // Spaced recall starts when a skill is first proven — day 2, then 7, 30, 90.
  if (derived.lastProvenAt && !recallItem && questionCount > 0) {
    await db.recallItem.create({
      data: {
        userId,
        skillId,
        intervalDays: FIRST_INTERVAL_DAYS,
        dueAt: new Date(derived.lastProvenAt.getTime() + FIRST_INTERVAL_DAYS * MS_DAY),
      },
    });
  }

  return state;
}

// ---------------------------------------------------------------------------
// Spaced recall schedule
// ---------------------------------------------------------------------------

export const FIRST_INTERVAL_DAYS = 2;
export const RECALL_LADDER = [2, 7, 30, 90, 180] as const;
export const MAX_INTERVAL_DAYS = 180;

/** Correct doubles up the ladder (capped); a miss drops straight back to 2. */
export function nextInterval(current: number, correct: boolean): number {
  if (!correct) return FIRST_INTERVAL_DAYS;
  const next = RECALL_LADDER.find((d) => d > current);
  return Math.min(next ?? current * 2, MAX_INTERVAL_DAYS);
}

// ---------------------------------------------------------------------------
// Access — Today only proposes work the member can actually open
// ---------------------------------------------------------------------------

export async function accessibleCourseIds(user: User): Promise<string[]> {
  const where = user.role === "ADMIN" ? {} : { published: true };
  const [courses, entitlements, subs] = await Promise.all([
    db.course.findMany({ where, select: { id: true } }),
    db.entitlement.findMany({
      where: { product: { active: true } },
      select: { courseId: true, productId: true },
    }),
    db.subscription.findMany({
      where: { userId: user.id, status: { in: ["ACTIVE", "TRIALING"] } },
      select: { productId: true },
    }),
  ]);
  if (user.role === "ADMIN") return courses.map((c) => c.id);

  const owned = new Set(subs.map((s) => s.productId));
  const gated = new Map<string, string[]>();
  for (const e of entitlements) {
    gated.set(e.courseId, [...(gated.get(e.courseId) ?? []), e.productId]);
  }
  return courses
    .map((c) => c.id)
    .filter((id) => {
      const products = gated.get(id);
      if (!products || products.length === 0) return true;
      return products.some((p) => owned.has(p));
    });
}

// ---------------------------------------------------------------------------
// Next-action selection — the arrival state of /today is a decision
// ---------------------------------------------------------------------------

export type NextActionKind = "RECALL" | "SHAKY_EXERCISE" | "NEXT_EXERCISE";

export interface NextAction {
  /** Stable key so "skip to something else" can rule this one out. */
  key: string;
  kind: NextActionKind;
  eyebrow: string;
  title: string;
  href: string;
  cta: string;
  /** Plain language, drawn from the rows below it. Never a vibe. */
  reason: string;
  /** The rows the reason was drawn from. */
  evidence: string[];
}

export interface PracticeSnapshot {
  ranked: NextAction[];
  dueRecall: {
    skillId: string;
    skillName: string;
    dueAt: Date;
    intervalDays: number;
    streak: number;
    lastResult: boolean | null;
  }[];
  skills: {
    skill: Skill;
    state: SkillState | null;
    status: SkillStatus;
  }[];
  practiceDays: PracticeDays;
}

function exerciseHref(slug: string) {
  return `/exercises/${slug}`;
}

/**
 * Everything /today needs, in one pass: the ranked proposals, what's due, the
 * capability snapshot, and the practice-days strip.
 */
export async function getPracticeSnapshot(user: User): Promise<PracticeSnapshot> {
  const now = new Date();
  const courseIds = await accessibleCourseIds(user);

  const [skills, exercises, submissions, states, recallItems, questionSkills] =
    await Promise.all([
      db.skill.findMany({
        where: { courseId: { in: courseIds } },
        orderBy: [{ courseId: "asc" }, { order: "asc" }],
      }),
      db.exercise.findMany({
        where: {
          published: true,
          skill: { courseId: { in: courseIds } },
        },
        orderBy: [{ skillId: "asc" }, { order: "asc" }],
        include: {
          skill: true,
          lesson: { include: { section: { include: { course: true } } } },
        },
      }),
      db.submission.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "asc" },
      }),
      db.skillState.findMany({ where: { userId: user.id } }),
      db.recallItem.findMany({
        where: { userId: user.id, skill: { courseId: { in: courseIds } } },
        orderBy: { dueAt: "asc" },
        include: { skill: true },
      }),
      db.recallQuestion.findMany({
        where: { skill: { courseId: { in: courseIds } } },
        select: { skillId: true },
      }),
    ]);

  const skillsWithQuestions = new Set(questionSkills.map((q) => q.skillId));
  const stateBySkill = new Map(states.map((s) => [s.skillId, s]));
  const byExercise = new Map<string, Submission[]>();
  for (const s of submissions) {
    byExercise.set(s.exerciseId, [...(byExercise.get(s.exerciseId) ?? []), s]);
  }
  const attemptsFor = (id: string) => (byExercise.get(id) ?? []).filter(isAttempt);

  const ranked: NextAction[] = [];

  // (a) A recall item due. Decay beats new ground.
  const due = recallItems.filter(
    (r) => r.dueAt <= now && skillsWithQuestions.has(r.skillId),
  );
  const first = due[0];
  if (first) {
    const overdue = daysSince(first.dueAt, now);
    const reason =
      first.lastResult === false
        ? `You missed the last check on ${first.skill.name}, so the schedule tightened back to ${plural(first.intervalDays, "day")}. It's due now.`
        : first.streak > 0
          ? `You've answered ${plural(first.streak, "check")} on ${first.skill.name} in a row. The next one is due — this is the interval where it usually starts to fade.`
          : `You proved ${first.skill.name} and the first spaced check is due. Answering now is what makes it stick.`;
    ranked.push({
      key: `recall:${first.skillId}`,
      kind: "RECALL",
      eyebrow: "Due for recall",
      title: first.skill.name,
      href: "/recall",
      cta: "Start the check",
      reason,
      evidence: [
        overdue > 0
          ? `due ${relativeDays(first.dueAt, now)} · interval ${first.intervalDays}d · streak ${first.streak}`
          : `due today · interval ${first.intervalDays}d · streak ${first.streak}`,
        due.length > 1 ? `${due.length - 1} more skill(s) due behind this one` : "",
      ].filter(Boolean),
    });
  }

  // (b) An exercise for a shaky skill.
  const shakySkillIds = new Set(
    states.filter((s) => s.status === "SHAKY").map((s) => s.skillId),
  );
  for (const ex of exercises) {
    if (!shakySkillIds.has(ex.skillId)) continue;
    const attempts = attemptsFor(ex.id);
    if (attempts.some(isGenuinePass)) continue;
    const state = stateBySkill.get(ex.skillId);
    if (!state) continue;

    const fails = attempts.filter((s) => !s.passed);
    const recentFails = fails.filter((s) => daysSince(s.createdAt, now) <= 7);
    const reason = state.lastProvenAt
      ? `You proved ${ex.skill.name} ${relativeDays(state.lastProvenAt, now)}, then failed it ${countTimes(fails.length)} since. That's the pattern that decays first.`
      : recentFails.length > 0
        ? `You failed ${ex.skill.name} ${countTimes(recentFails.length)} in the last week and haven't passed it yet.`
        : `You've attempted ${ex.skill.name} ${countTimes(state.attemptCount)} without passing. It's the only thing standing between you and the rest of the course.`;

    ranked.push({
      key: `exercise:${ex.id}`,
      kind: "SHAKY_EXERCISE",
      eyebrow: "Shaky skill",
      title: ex.title,
      href: exerciseHref(ex.slug),
      cta: "Open the attempt",
      reason,
      evidence: [
        `${plural(state.attemptCount, "attempt")} · ${state.provenCount} proven${state.everUsedHints ? " · hints used" : " · no hints used"}`,
        fails.length > 0
          ? `last failed ${relativeDays(fails[fails.length - 1].createdAt, now)}`
          : "",
      ].filter(Boolean),
    });
    break;
  }

  // (c) The next unattempted exercise, in order.
  for (const ex of exercises) {
    if (attemptsFor(ex.id).length > 0) continue;
    if (ranked.some((a) => a.key === `exercise:${ex.id}`)) continue;
    const state = stateBySkill.get(ex.skillId);
    const paired = ex.lesson
      ? `The concept video for it — ${ex.lesson.title} — is already indexed, so the tutor can point at the passage.`
      : "";
    const reason = (
      state && state.provenCount > 0
        ? `You've proven ${ex.skill.name} ${countTimes(state.provenCount)}; this is the next exercise on it you haven't attempted. ${paired}`
        : `You haven't attempted ${ex.skill.name} yet, and this is the first exercise that tests it. ${paired}`
    ).trim();

    ranked.push({
      key: `exercise:${ex.id}`,
      kind: "NEXT_EXERCISE",
      eyebrow: "Next in order",
      title: ex.title,
      href: exerciseHref(ex.slug),
      cta: "Open the attempt",
      reason,
      evidence: [
        `${ex.skill.name} · no attempts yet`,
        ex.lesson && ex.lessonTimecode != null
          ? `paired lesson ${ex.lesson.title} · ${formatTimecode(ex.lessonTimecode)}`
          : "",
      ].filter(Boolean),
    });
    if (ranked.filter((a) => a.kind === "NEXT_EXERCISE").length >= 3) break;
  }

  const practiceDays = await getPracticeDays(user.id, 7, now);

  return {
    ranked,
    dueRecall: due.map((r) => ({
      skillId: r.skillId,
      skillName: r.skill.name,
      dueAt: r.dueAt,
      intervalDays: r.intervalDays,
      streak: r.streak,
      lastResult: r.lastResult,
    })),
    skills: skills.map((skill) => {
      const state = stateBySkill.get(skill.id) ?? null;
      return { skill, state, status: state?.status ?? "UNTESTED" };
    }),
    practiceDays,
  };
}

export interface PracticeDays {
  count: number;
  window: number;
  /** ISO dates (yyyy-mm-dd) in the window that carry an attempt. */
  days: string[];
}

/**
 * Days you attempted something, not days you opened the app. Counts distinct
 * calendar days that carry a run submission inside the window. Deliberately
 * not a login streak — see docs/PLAN.md on gamification.
 */
export async function getPracticeDays(
  userId: string,
  windowDays = 7,
  now = new Date(),
): Promise<PracticeDays> {
  const since = new Date(now.getTime() - (windowDays - 1) * MS_DAY);
  since.setHours(0, 0, 0, 0);
  const rows = await db.submission.findMany({
    where: { userId, createdAt: { gte: since } },
    select: { createdAt: true, testResults: true },
  });
  const days = [
    ...new Set(rows.filter(isAttempt).map((r) => dayKey(r.createdAt))),
  ];
  return { count: days.length, window: windowDays, days };
}

/** Local calendar day, so "today" means the learner's today. */
export function dayKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function formatTimecode(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export const STATUS_LABEL: Record<SkillStatus, string> = {
  PROVEN: "proven",
  SHAKY: "shaky",
  UNTESTED: "untested",
};

export const STATUS_TAG: Record<SkillStatus, string> = {
  PROVEN: "hr-tag hr-tag-proven",
  SHAKY: "hr-tag hr-tag-shaky",
  UNTESTED: "hr-tag hr-tag-untested",
};
