import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@homeroom/db";
import {
  createLesson,
  createSection,
  deleteSection,
  updateCourse,
} from "@/lib/actions/courses";
import { Page, PageHeader } from "@/components/page-header";
import { requireAdmin } from "@/lib/session";
import { Button, Card, Input, Textarea } from "@homeroom/ui";

export const dynamic = "force-dynamic";

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
        {course.sections.map((section) => (
          <div key={section.id} className="hr-card mb-4 p-5">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-semibold">{section.title}</h3>
              <form action={deleteSection.bind(null, section.id, course.id)}>
                <button className="text-xs text-fail hover:underline">
                  delete section
                </button>
              </form>
            </div>
            <ul className="mb-4 divide-y divide-line">
              {section.lessons.map((lesson) => (
                <Link
                  key={lesson.id}
                  href={`/admin/courses/${course.id}/lessons/${lesson.id}`}
                  className="block hover:bg-bg"
                >
                  <li className="flex items-center justify-between px-2 py-2 text-sm">
                    <span>{lesson.title}</span>
                    <span className="flex gap-2 text-xs">
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
                </Link>
              ))}
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
    </Page>
  );
}
