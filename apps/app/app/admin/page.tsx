import Link from "next/link";
import { db } from "@homeroom/db";
import { Page, PageHeader } from "@/components/page-header";
import { EnterPreviewButton } from "@/components/preview-bar";
import { createCourse } from "@/lib/actions/courses";
import { plural } from "@/lib/practice";
import { requireAdmin } from "@/lib/session";
import {
  Button,
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  Input,
  Textarea,
} from "@homeroom/ui";

export const metadata = { title: "Admin" };
export const dynamic = "force-dynamic";

export default async function AdminPage() {
  await requireAdmin();
  const courses = await db.course.findMany({
    orderBy: { createdAt: "asc" },
    include: { sections: { include: { lessons: { select: { id: true } } } } },
  });

  const published = courses.filter((c) => c.published).length;

  return (
    <Page width="narrow">
      <PageHeader
        crumbs={[{ label: "Admin" }]}
        title="Courses"
        subtitle={
          courses.length > 0
            ? `${plural(courses.length, "course")}, ${published} published. Everything else lives on the rail — coach, members, products, the agent queue and settings.`
            : "Nothing exists yet. A course is the container everything else hangs off, so it is the first thing to make."
        }
        actions={<EnterPreviewButton expanded />}
      />

      <Card>
        <CardHeader>
          <span className="font-semibold">All courses</span>
          <span className="ml-auto hr-path">{courses.length}</span>
        </CardHeader>
        {courses.length === 0 ? (
          <CardContent>
            <p className="text-[12.5px] text-dim">
              Create one below and it will appear here with its lesson count.
            </p>
          </CardContent>
        ) : (
          <ul>
            {courses.map((course) => {
              const lessons = course.sections.reduce(
                (n, s) => n + s.lessons.length,
                0,
              );
              return (
                <li key={course.id} className="hr-row items-start">
                  <span className="min-w-0 flex-1">
                    <Link
                      href={`/admin/courses/${course.id}`}
                      className="block font-medium text-ink hover:underline"
                    >
                      {course.title}
                    </Link>
                    <span className="hr-ev block">
                      {plural(lessons, "lesson")}
                      {lessons === 0 && " · nothing to watch yet"}
                    </span>
                  </span>
                  <span
                    className={`hr-tag shrink-0 ${
                      course.published ? "hr-tag-proven" : "hr-tag-untested"
                    }`}
                  >
                    {course.published ? "published" : "draft"}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <span className="font-semibold">New course</span>
        </CardHeader>
        <form action={createCourse}>
          <div className="hr-card-b space-y-3">
            <label className="block">
              <span className="hr-eyebrow mb-1 block">Title</span>
              <Input
                name="title"
                placeholder="Apex That Survives Production"
                required
                
              />
            </label>
            <label className="block">
              <span className="hr-eyebrow mb-1 block">Description</span>
              <Textarea
                name="description"
                placeholder="What someone can do after finishing it — optional."
                rows={2}
                
              />
            </label>
          </div>
          <CardFooter>
            <Button type="submit" size="sm">
              Create course
            </Button>
            <span className="hr-ev">
              Created as a draft. Nothing is member-visible until you publish it.
            </span>
          </CardFooter>
        </form>
      </Card>
    </Page>
  );
}
