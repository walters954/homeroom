"use server";

import { db, type Prisma } from "@homeroom/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  isAttempt,
  deriveSkillState,
  nextInterval,
  MS_DAY,
  FIRST_INTERVAL_DAYS,
} from "../practice";
import {
  parseFiles,
  parseTestSpec,
  runTests,
  type ExerciseFile,
} from "../exercises/runner";
import { requireAdmin, requireUser } from "../session";

/**
 * Attempt-screen actions. The whole screen is one form, so every button —
 * run, reveal a hint, reveal the solution — carries the learner's current
 * files with it and nothing they typed is lost by clicking.
 */

async function loadExercise(slug: string) {
  const exercise = await db.exercise.findUnique({
    where: { slug },
    include: { skill: true },
  });
  if (!exercise) throw new Error(`No exercise ${slug}`);
  return exercise;
}

/** Files come back keyed `file:<path>` from the editor's textareas. */
function filesFromForm(formData: FormData, starter: ExerciseFile[]): ExerciseFile[] {
  return starter.map((f) => {
    const submitted = formData.get(`file:${f.path}`);
    return {
      path: f.path,
      contents: typeof submitted === "string" ? submitted : f.contents,
    };
  });
}

/**
 * The one open row per exercise that carries hint state before the first run.
 * `testResults: []` marks it as "not run" — it never counts as an attempt.
 */
async function saveDraft(
  userId: string,
  exerciseId: string,
  files: ExerciseFile[],
  patch: { hintsUsed?: number; solutionRevealed?: boolean },
) {
  const latest = await db.submission.findFirst({
    where: { userId, exerciseId },
    orderBy: { createdAt: "desc" },
  });

  if (latest && !isAttempt(latest)) {
    return db.submission.update({
      where: { id: latest.id },
      data: { files: files as unknown as Prisma.InputJsonValue, ...patch },
    });
  }
  return db.submission.create({
    data: {
      userId,
      exerciseId,
      files: files as unknown as Prisma.InputJsonValue,
      testResults: [] as unknown as Prisma.InputJsonValue,
      passed: false,
      hintsUsed: patch.hintsUsed ?? latest?.hintsUsed ?? 0,
      solutionRevealed: patch.solutionRevealed ?? latest?.solutionRevealed ?? false,
    },
  });
}

export async function submitAttempt(slug: string, formData: FormData) {
  const user = await requireUser();
  const exercise = await loadExercise(slug);
  const files = filesFromForm(formData, parseFiles(exercise.starterFiles));

  const latest = await db.submission.findFirst({
    where: { userId: user.id, exerciseId: exercise.id },
    orderBy: { createdAt: "desc" },
  });

  // Execution lives behind one interface; today it reports honest failures.
  const results = await runTests(exercise, files);
  const passed = results.length > 0 && results.every((r) => r.passed);

  if (latest && !isAttempt(latest)) {
    await db.submission.update({
      where: { id: latest.id },
      data: {
        files: files as unknown as Prisma.InputJsonValue,
        testResults: results as unknown as Prisma.InputJsonValue,
        passed,
      },
    });
  } else {
    await db.submission.create({
      data: {
        userId: user.id,
        exerciseId: exercise.id,
        files: files as unknown as Prisma.InputJsonValue,
        testResults: results as unknown as Prisma.InputJsonValue,
        passed,
        hintsUsed: latest?.hintsUsed ?? 0,
        solutionRevealed: latest?.solutionRevealed ?? false,
      },
    });
  }

  await deriveSkillState(user.id, exercise.skillId);
  revalidatePath(`/exercises/${slug}`);
  revalidatePath("/today");
  revalidatePath("/capability");
}

export async function revealHint(slug: string, formData: FormData) {
  const user = await requireUser();
  const exercise = await loadExercise(slug);
  const files = filesFromForm(formData, parseFiles(exercise.starterFiles));
  const hints = Array.isArray(exercise.hints) ? exercise.hints : [];

  const latest = await db.submission.findFirst({
    where: { userId: user.id, exerciseId: exercise.id },
    orderBy: { createdAt: "desc" },
  });
  const next = Math.min((latest?.hintsUsed ?? 0) + 1, hints.length);

  await saveDraft(user.id, exercise.id, files, { hintsUsed: next });
  revalidatePath(`/exercises/${slug}`);
}

/**
 * The last rung. The UI states the cost before this is reachable: a revealed
 * solution can still pass the tests, but it never counts as proven.
 */
export async function revealSolution(slug: string, formData: FormData) {
  const user = await requireUser();
  const exercise = await loadExercise(slug);
  const files = filesFromForm(formData, parseFiles(exercise.starterFiles));
  const hints = Array.isArray(exercise.hints) ? exercise.hints : [];

  await saveDraft(user.id, exercise.id, files, {
    hintsUsed: hints.length,
    solutionRevealed: true,
  });
  await deriveSkillState(user.id, exercise.skillId);
  revalidatePath(`/exercises/${slug}`);
  revalidatePath("/capability");
}

/**
 * Admin escape hatch so the loop is demonstrable before the sandbox exists.
 * It records what it is — an override, with no tests run — rather than
 * pretending a green run happened.
 */
export async function markPassedManual(slug: string, formData: FormData) {
  const admin = await requireAdmin();
  const exercise = await loadExercise(slug);
  const files = filesFromForm(formData, parseFiles(exercise.starterFiles));
  const spec = parseTestSpec(exercise.testSpec);

  const latest = await db.submission.findFirst({
    where: { userId: admin.id, exerciseId: exercise.id },
    orderBy: { createdAt: "desc" },
  });

  const results = [
    {
      name: "manual override",
      passed: true,
      message: `An admin marked this passed. No tests were run — the sandbox isn't wired up yet (issue #7). ${spec.length} test(s) are specified.`,
    },
  ];

  const data = {
    files: files as unknown as Prisma.InputJsonValue,
    testResults: results as unknown as Prisma.InputJsonValue,
    passed: true,
  };

  if (latest && !isAttempt(latest)) {
    await db.submission.update({ where: { id: latest.id }, data });
  } else {
    await db.submission.create({
      data: {
        userId: admin.id,
        exerciseId: exercise.id,
        hintsUsed: latest?.hintsUsed ?? 0,
        solutionRevealed: latest?.solutionRevealed ?? false,
        ...data,
      },
    });
  }

  await deriveSkillState(admin.id, exercise.skillId);
  revalidatePath(`/exercises/${slug}`);
  revalidatePath("/today");
  revalidatePath("/capability");
}

// ---------------------------------------------------------------------------
// Spaced recall
// ---------------------------------------------------------------------------

export async function answerRecall(questionId: string, formData: FormData) {
  const user = await requireUser();
  const choice = Number(formData.get("choice"));
  const question = await db.recallQuestion.findUnique({
    where: { id: questionId },
  });
  if (!question || Number.isNaN(choice)) redirect("/recall");

  const correct = choice === question.correctIndex;
  const existing = await db.recallItem.findUnique({
    where: { userId_skillId: { userId: user.id, skillId: question.skillId } },
  });
  const interval = nextInterval(
    existing?.intervalDays ?? FIRST_INTERVAL_DAYS,
    correct,
  );
  const dueAt = new Date(Date.now() + interval * MS_DAY);

  await db.recallItem.upsert({
    where: { userId_skillId: { userId: user.id, skillId: question.skillId } },
    create: {
      userId: user.id,
      skillId: question.skillId,
      intervalDays: interval,
      streak: correct ? 1 : 0,
      lastResult: correct,
      dueAt,
    },
    update: {
      intervalDays: interval,
      streak: correct ? (existing?.streak ?? 0) + 1 : 0,
      lastResult: correct,
      dueAt,
    },
  });

  // A miss moves the skill back to shaky — the assessment follows the evidence.
  await deriveSkillState(user.id, question.skillId);
  revalidatePath("/today");
  revalidatePath("/capability");
  redirect(`/recall?answered=${questionId}&choice=${choice}`);
}
