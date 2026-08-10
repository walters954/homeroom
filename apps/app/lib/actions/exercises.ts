"use server";

import { db, type ExerciseLanguage } from "@homeroom/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  parseFiles,
  parseTestSpec,
  runTests,
  type ExerciseFile,
} from "../exercises/runner";
import { requireAdmin } from "../session";
import { slugify } from "../slug";

const LANGUAGES = [
  "APEX",
  "SQL",
  "TYPESCRIPT",
  "JAVASCRIPT",
  "PYTHON",
  "OTHER",
] as const;

function languageOf(value: unknown): ExerciseLanguage {
  const v = String(value ?? "");
  return (LANGUAGES as readonly string[]).includes(v)
    ? (v as ExerciseLanguage)
    : "OTHER";
}

/**
 * The editor posts the repeatable parts as JSON in hidden fields — files,
 * hints, and the test spec are lists a plain FormData round-trip mangles.
 */
function json(formData: FormData, key: string): unknown {
  try {
    return JSON.parse(String(formData.get(key) ?? "null"));
  } catch {
    return null;
  }
}

// --- Skills -----------------------------------------------------------------

export async function createSkill(courseId: string, formData: FormData) {
  await requireAdmin();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;

  const last = await db.skill.findFirst({
    where: { courseId },
    orderBy: { order: "desc" },
    select: { order: true },
  });

  await db.skill.create({
    data: {
      courseId,
      name,
      description: String(formData.get("description") ?? "").trim() || null,
      order: (last?.order ?? 0) + 1,
    },
  });
  revalidatePath(`/admin/courses/${courseId}`);
}

export async function updateSkill(skillId: string, formData: FormData) {
  await requireAdmin();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;

  const skill = await db.skill.update({
    where: { id: skillId },
    data: {
      name,
      description: String(formData.get("description") ?? "").trim() || null,
    },
  });
  revalidatePath(`/admin/courses/${skill.courseId}`);
}

/**
 * Refuses while exercises still hang off it. The cascade would take their
 * submissions with them, and a submission is the evidence a skill was proven.
 */
export async function deleteSkill(skillId: string) {
  await requireAdmin();
  const skill = await db.skill.findUnique({
    where: { id: skillId },
    include: { _count: { select: { exercises: true } } },
  });
  if (!skill || skill._count.exercises > 0) return;

  await db.skill.delete({ where: { id: skillId } });
  revalidatePath(`/admin/courses/${skill.courseId}`);
}

// --- Exercises --------------------------------------------------------------

export async function createExercise(skillId: string, formData: FormData) {
  await requireAdmin();
  const title = String(formData.get("title") ?? "").trim();
  if (!title) return;

  const skill = await db.skill.findUnique({ where: { id: skillId } });
  if (!skill) return;

  const last = await db.exercise.findFirst({
    where: { skillId },
    orderBy: { order: "desc" },
    select: { order: true },
  });

  const base = slugify(title) || "exercise";
  let slug = base;
  for (let n = 2; await db.exercise.findUnique({ where: { slug } }); n++) {
    slug = `${base}-${n}`;
  }

  const exercise = await db.exercise.create({
    data: {
      skillId,
      title,
      slug,
      prompt: "",
      language: "TYPESCRIPT",
      starterFiles: [],
      hints: [],
      testSpec: [],
      order: (last?.order ?? 0) + 1,
    },
  });

  redirect(`/admin/exercises/${exercise.id}`);
}

export async function updateExercise(exerciseId: string, formData: FormData) {
  await requireAdmin();

  const lessonId = String(formData.get("lessonId") ?? "");
  const timecode = String(formData.get("lessonTimecode") ?? "").trim();

  const exercise = await db.exercise.update({
    where: { id: exerciseId },
    data: {
      title: String(formData.get("title") ?? "").trim() || "Untitled",
      prompt: String(formData.get("prompt") ?? ""),
      language: languageOf(formData.get("language")),
      differenceNotes: String(formData.get("differenceNotes") ?? "").trim() || null,
      lessonId: lessonId || null,
      lessonTimecode: timecode ? Number(timecode) || null : null,
      published: formData.get("published") === "on",
      starterFiles: (json(formData, "starterFiles") ?? []) as never,
      solutionFiles: (json(formData, "solutionFiles") ?? []) as never,
      testFiles: (json(formData, "testFiles") ?? []) as never,
      hints: (json(formData, "hints") ?? []) as never,
      testSpec: (json(formData, "testSpec") ?? []) as never,
    },
    include: { skill: true },
  });

  revalidatePath(`/admin/exercises/${exerciseId}`);
  revalidatePath(`/admin/courses/${exercise.skill.courseId}`);
  revalidatePath(`/exercises/${exercise.slug}`);
}

export async function deleteExercise(exerciseId: string) {
  await requireAdmin();
  const exercise = await db.exercise.findUnique({
    where: { id: exerciseId },
    include: { skill: true, _count: { select: { submissions: true } } },
  });
  // Deleting would cascade the submissions, which are the proof anyone did it.
  if (!exercise || exercise._count.submissions > 0) return;

  await db.exercise.delete({ where: { id: exerciseId } });
  redirect(`/admin/courses/${exercise.skill.courseId}`);
}

export interface VerifyResult {
  ok: boolean;
  headline: string;
  detail: string;
  results: { name: string; passed: boolean; message: string }[];
}

/**
 * Run the reference solution against the exercise's own tests.
 *
 * This is the check that stops a broken exercise shipping. If the author's own
 * answer cannot pass, no learner's can — and they would be told their correct
 * code is wrong, which is the single worst thing this product can do.
 */
export async function verifyExercise(exerciseId: string): Promise<VerifyResult> {
  const admin = await requireAdmin();

  const exercise = await db.exercise.findUnique({ where: { id: exerciseId } });
  if (!exercise) {
    return { ok: false, headline: "Not found", detail: "", results: [] };
  }

  const solution: ExerciseFile[] = parseFiles(exercise.solutionFiles);
  if (solution.length === 0) {
    return {
      ok: false,
      headline: "No reference solution",
      detail:
        "Add the files a correct answer would contain, then run this again. Without one there is nothing to check the tests against.",
      results: [],
    };
  }
  if (parseFiles(exercise.testFiles).length === 0) {
    return {
      ok: false,
      headline: "No test files",
      detail:
        "This exercise cannot be verified, and a learner submitting it would be told every test failed.",
      results: [],
    };
  }

  // Starter files first so anything the solution does not overwrite is still
  // present — the same shape a learner's submission arrives in.
  const starter = parseFiles(exercise.starterFiles);
  const merged = [
    ...starter.filter((f) => !solution.some((s) => s.path === f.path)),
    ...solution,
  ];

  // Apex verification runs in the admin's own connected org — the same path a
  // learner's attempt takes, so a green here means green for them too.
  const results = await runTests(exercise, merged, admin.id);
  const failed = results.filter((r) => !r.passed);
  const spec = parseTestSpec(exercise.testSpec);
  const missing = spec.filter((s) => !results.some((r) => r.name === s.name));

  if (failed.length === 0 && missing.length === 0) {
    return {
      ok: true,
      headline: `Reference solution passes all ${results.length} tests`,
      detail: "Safe to publish.",
      results,
    };
  }

  return {
    ok: false,
    headline: `${failed.length} of ${results.length} failed against the reference solution`,
    detail:
      missing.length > 0
        ? `${missing.length} test(s) in the spec never ran — the names must match what the test file exports.`
        : "Either the tests are wrong or the reference solution is. A learner would hit the same wall.",
    results,
  };
}
