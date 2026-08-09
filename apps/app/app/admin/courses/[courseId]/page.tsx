import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@homeroom/db";
import {
  createLesson,
  createSection,
  deleteSection,
  moveLesson,
  moveSection,
  updateCourse,
} from "@/lib/actions/courses";
import { createExercise, createSkill, deleteSkill } from "@/lib/actions/exercises";
import { Page, PageHeader } from "@/components/page-header";
import { requireAdmin } from "@/lib/session";
import { Button, Card, Input, Textarea } from "@homeroom/ui";

export const dynamic = "force-dynamic";

/**
 * Up/down beats drag-and-drop here: it works without JavaScript, is reachable
 * by keyboard and screen reader, and building a curriculum is a handful of
 * deliberate moves rather than a long sort. The ends are disabled rather than
 * hidden so rows don't reflow as you move something down a list.
 */
function Reorder({
  up,
  down,
  first,
  last,
  label,
}: {
  up: () => Promise<void>;
  down: () => Promise<void>;
  first: boolean;
  last: boolean;
  label: string;
}) {
  const base =
    "grid h-[18px] w-[18px] place-items-center rounded border border-line text-[10px] leading-none text-dim hover:bg-soft disabled:cursor-default disabled:opacity-25 disabled:hover:bg-transparent";
  return (
    <span className="flex shrink-0 flex-col gap-0.5">
      <form action={up}>
        <button
          type="submit"
          disabled={first}
          aria-label={`Move ${label} up`}
          title="Move up"
          className={base}
        >
          ▲
        </button>
      </form>
      <form action={down}>
        <button
          type="submit"
          disabled={last}
          aria-label={`Move ${label} down`}
          title="Move down"
          className={base}
        >
          ▼
        </button>
      </form>
    </span>
  );
}

export default async function AdminCoursePage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  await requireAdmin();
  const { courseId } = await params;
  const course = await db.course.findUnique({
    where: { id: courseId },
    include: {
      sections: {
        orderBy: { order: "asc" },
        include: {
          lessons: {
            orderBy: { order: "asc" },
            include: { transcript: { select: { id: true } } },
          },
        },
      },
    },
  });
  if (!course) notFound();

  const skills = await db.skill.findMany({
    where: { courseId },
    orderBy: { order: "asc" },
    include: {
      exercises: {
        orderBy: { order: "asc" },
        include: { _count: { select: { submissions: true } } },
      },
      _count: { select: { recallQuestions: true } },
    },
  });

  return (
    <Page width="narrow">
      <PageHeader
        crumbs={[{ label: "Admin", href: "/admin" }, { label: course.title }]}
        title={course.title}
        subtitle="Sections hold lessons; lessons hold the video and the transcript the tutor reads."
        actions={
          <Link href={`/courses/${course.slug}`} className="hr-btn hr-btn-sm">
            View live
          </Link>
        }
      />

      <Card className="mb-4 p-5">
        <h2 className="mb-4 text-[13px] font-semibold">Course settings</h2>
        <form
          action={updateCourse.bind(null, course.id)}
          className="flex flex-col gap-3 text-sm"
        >
          <label className="flex flex-col gap-1 font-medium">
            Title
            <Input
              name="title"
              defaultValue={course.title}
              className="font-normal"
            />
          </label>
          <label className="flex flex-col gap-1 font-medium">
            Slug
            <Input
              name="slug"
              defaultValue={course.slug}
              className="font-normal"
            />
          </label>
          <label className="flex flex-col gap-1 font-medium">
            Description
            <Textarea
              name="description"
              defaultValue={course.description ?? ""}
              rows={2}
              className="font-normal"
            />
          </label>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 font-medium">
              SEO title
              <Input
                name="seoTitle"
                defaultValue={course.seoTitle ?? ""}
                className="font-normal"
              />
            </label>
            <label className="flex flex-col gap-1 font-medium">
              SEO description
              <Input
                name="seoDescription"
                defaultValue={course.seoDescription ?? ""}
                className="font-normal"
              />
            </label>
          </div>
          <label className="flex items-center gap-2 font-medium">
            <input
              type="checkbox"
              name="published"
              defaultChecked={course.published}
            />
            Published
          </label>
          <Button
            type="submit"
            size="sm" className="self-start"
          >
            Save
          </Button>
        </form>
      </Card>

      <section className="space-y-6">
        <h2 className="text-[13px] font-semibold">Curriculum</h2>
        {course.sections.map((section, sectionIndex) => (
          <div key={section.id} className="hr-card mb-4 p-5">
            <div className="mb-3 flex items-center gap-2">
              <Reorder
                up={moveSection.bind(null, course.id, section.id, "up")}
                down={moveSection.bind(null, course.id, section.id, "down")}
                first={sectionIndex === 0}
                last={sectionIndex === course.sections.length - 1}
                label={`section ${section.title}`}
              />
              <h3 className="min-w-0 flex-1 truncate font-semibold">
                {section.title}
              </h3>
              <form action={deleteSection.bind(null, section.id, course.id)}>
                <button className="text-xs text-fail hover:underline">
                  delete section
                </button>
              </form>
            </div>
            <ul className="mb-4 divide-y divide-line">
              {section.lessons.map((lesson, lessonIndex) => (
                <li
                  key={lesson.id}
                  className="flex items-center gap-2 px-2 py-2 text-sm"
                >
                  <Reorder
                    up={moveLesson.bind(
                      null,
                      course.id,
                      section.id,
                      lesson.id,
                      "up",
                    )}
                    down={moveLesson.bind(
                      null,
                      course.id,
                      section.id,
                      lesson.id,
                      "down",
                    )}
                    first={lessonIndex === 0}
                    last={lessonIndex === section.lessons.length - 1}
                    label={lesson.title}
                  />
                  <Link
                    href={`/admin/courses/${course.id}/lessons/${lesson.id}`}
                    className="min-w-0 flex-1 truncate hover:underline"
                  >
                    {lesson.title}
                  </Link>
                  <span className="flex shrink-0 gap-2 text-xs">
                    {lesson.videoProvider !== "NONE" && (
                      <span className="text-dim">
                        {lesson.videoProvider.toLowerCase()}
                      </span>
                    )}
                    {lesson.transcript && (
                      <span className="text-acc">transcript ✓</span>
                    )}
                    {!lesson.published && (
                      <span className="rounded bg-warn-soft px-1.5 py-0.5 text-warn">
                        draft
                      </span>
                    )}
                  </span>
                </li>
              ))}
              {section.lessons.length === 0 && (
                <li className="px-2 py-2 text-sm text-dim">
                  No lessons in this section yet.
                </li>
              )}
            </ul>
            <form
              action={createLesson.bind(null, section.id, course.id)}
              className="flex gap-2"
            >
              <Input
                name="title"
                placeholder="New lesson title"
                required
                className="flex-1"
              />
              <Button variant="outline" size="sm">
                Add lesson
              </Button>
            </form>
          </div>
        ))}
        <form
          action={createSection.bind(null, course.id)}
          className="flex gap-2"
        >
          <Input
            name="title"
            placeholder="New section title"
            required
            className="flex-1"
          />
          <Button size="sm">
            Add section
          </Button>
        </form>
      </section>

      <section className="mt-8 space-y-3">
        <div>
          <h2 className="text-[13px] font-semibold">Skills and exercises</h2>
          <p className="hr-ev">
            A skill is what an exercise proves. Lessons teach; passing an
            exercise is the only thing that moves a member&apos;s capability.
          </p>
        </div>

        {skills.length === 0 && (
          <Card className="p-4">
            <p className="text-[12.5px] text-dim">
              No skills yet, so nothing on this course can be proven — the
              capability map and recall queue stay empty until one exists.
            </p>
          </Card>
        )}

        {skills.map((skill) => (
          <Card key={skill.id} className="p-4">
            <div className="mb-2 flex flex-wrap items-start gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-medium">{skill.name}</p>
                <p className="hr-ev">
                  {skill.exercises.length === 1
                    ? "1 exercise"
                    : `${skill.exercises.length} exercises`}
                  {" · "}
                  {skill._count.recallQuestions === 0
                    ? "no recall questions, so proving it schedules nothing"
                    : `${skill._count.recallQuestions} recall questions`}
                </p>
              </div>
              {skill.exercises.length === 0 && (
                <form action={deleteSkill.bind(null, skill.id)}>
                  <Button type="submit" variant="ghost" size="sm">
                    Delete
                  </Button>
                </form>
              )}
            </div>

            {skill.exercises.length > 0 && (
              <ul className="mb-2 divide-y divide-soft border-y border-soft">
                {skill.exercises.map((ex) => (
                  <li
                    key={ex.id}
                    className="flex flex-wrap items-center gap-2 py-2 text-[12.5px]"
                  >
                    <Link
                      href={`/admin/exercises/${ex.id}`}
                      className="min-w-0 flex-1 font-medium hover:underline"
                    >
                      {ex.title}
                    </Link>
                    <span className="hr-path">{ex.language.toLowerCase()}</span>
                    <span
                      className={`hr-tag ${
                        ex.published ? "hr-tag-proven" : "hr-tag-untested"
                      }`}
                    >
                      {ex.published ? "published" : "draft"}
                    </span>
                    <span className="hr-ev">
                      {ex._count.submissions} attempts
                    </span>
                  </li>
                ))}
              </ul>
            )}

            <form
              action={createExercise.bind(null, skill.id)}
              className="flex flex-wrap gap-2"
            >
              <Input
                name="title"
                placeholder="New exercise title"
                required
                className="min-w-[180px] flex-1"
              />
              <Button variant="outline" size="sm">
                Add exercise
              </Button>
            </form>
          </Card>
        ))}

        <Card className="p-4">
          <p className="mb-2 text-[13px] font-semibold">New skill</p>
          <form action={createSkill.bind(null, courseId)} className="space-y-2">
            <Input name="name" placeholder="Trigger bulkification" required />
            <Input
              name="description"
              placeholder="What someone who has this can do — optional."
            />
            <Button size="sm">Add skill</Button>
          </form>
        </Card>
      </section>
    </Page>
  );
}
