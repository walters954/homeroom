import { db } from "@homeroom/db";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ExerciseForm } from "@/components/exercise-form";
import { Page, PageHeader } from "@/components/page-header";
import {
  deleteExercise,
  updateExercise,
  verifyExercise,
} from "@/lib/actions/exercises";
import { parseFiles, parseTestSpec } from "@/lib/exercises/runner";
import { requireAdmin } from "@/lib/session";

export const dynamic = "force-dynamic";

// Verifying provisions a sandbox and runs the tests, same budget as an attempt.
export const maxDuration = 300;

async function load(exerciseId: string) {
  return db.exercise.findUnique({
    where: { id: exerciseId },
    include: {
      skill: { include: { course: true } },
      _count: { select: { submissions: true } },
    },
  });
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ exerciseId: string }>;
}): Promise<Metadata> {
  const { exerciseId } = await params;
  const exercise = await load(exerciseId);
  return { title: exercise ? `Edit ${exercise.title}` : "Exercise" };
}

export default async function EditExercisePage({
  params,
}: {
  params: Promise<{ exerciseId: string }>;
}) {
  await requireAdmin();
  const { exerciseId } = await params;
  const exercise = await load(exerciseId);
  if (!exercise) notFound();

  const sections = await db.section.findMany({
    where: { courseId: exercise.skill.courseId },
    orderBy: { order: "asc" },
    include: { lessons: { orderBy: { order: "asc" } } },
  });
  const lessons = sections.flatMap((s) =>
    s.lessons.map((l) => ({ id: l.id, title: l.title, section: s.title })),
  );

  return (
    <Page>
      <PageHeader
        crumbs={[
          { label: "Admin", href: "/admin" },
          {
            label: exercise.skill.course.title,
            href: `/admin/courses/${exercise.skill.courseId}`,
          },
          { label: exercise.skill.name },
        ]}
        title={exercise.title}
        subtitle="An exercise is what proves the skill. Progress only moves when someone passes one they hadn't seen, so this is the thing that has to be right."
      />

      <ExerciseForm
        exercise={{
          id: exercise.id,
          title: exercise.title,
          slug: exercise.slug,
          prompt: exercise.prompt,
          language: exercise.language,
          published: exercise.published,
          lessonId: exercise.lessonId,
          lessonTimecode: exercise.lessonTimecode,
          differenceNotes: exercise.differenceNotes,
          starterFiles: parseFiles(exercise.starterFiles),
          solutionFiles: parseFiles(exercise.solutionFiles),
          testFiles: parseFiles(exercise.testFiles),
          hints: (Array.isArray(exercise.hints) ? exercise.hints : []).map(String),
          testSpec: parseTestSpec(exercise.testSpec),
          submissionCount: exercise._count.submissions,
        }}
        lessons={lessons}
        saveAction={updateExercise.bind(null, exercise.id)}
        verifyAction={verifyExercise.bind(null, exercise.id)}
        deleteAction={deleteExercise.bind(null, exercise.id)}
      />
    </Page>
  );
}
