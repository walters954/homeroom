import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@homeroom/db";
import type { Metadata } from "next";
import { Badge, Card, CardContent, CardFooter, CardHeader } from "@homeroom/ui";
import { formatPrice, getCourseAccess, lessonAccessible } from "@/lib/access";
import { getCurrentUser } from "@/lib/session";
import { Page, PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { getPracticeSnapshot } from "@/lib/practice";

export const dynamic = "force-dynamic";

async function getCourse(courseSlug: string) {
  return db.course.findUnique({
    where: { slug: courseSlug },
    include: {
      sections: {
        orderBy: { order: "asc" },
        include: { lessons: { orderBy: { order: "asc" } } },
      },
    },
  });
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ courseSlug: string }>;
}): Promise<Metadata> {
  const { courseSlug } = await params;
  const course = await getCourse(courseSlug);
  if (!course) return {};
  return {
    title: course.seoTitle ?? course.title,
    description: course.seoDescription ?? course.description ?? undefined,
  };
}

export default async function CoursePage({
  params,
}: {
  params: Promise<{ courseSlug: string }>;
}) {
  const { courseSlug } = await params;
  const [user, course] = await Promise.all([
    getCurrentUser(),
    getCourse(courseSlug),
  ]);
  if (!course) notFound();
  if (!course.published && user?.role !== "ADMIN") notFound();

  const access = await getCourseAccess(user, course.id);

  const completedIds = new Set<string>();
  if (user) {
    const progress = await db.lessonProgress.findMany({
      where: { userId: user.id, completedAt: { not: null } },
      select: { lessonId: true },
    });
    for (const p of progress) completedIds.add(p.lessonId);
  }

  const visibleLessons = (lessons: (typeof course.sections)[0]["lessons"]) =>
    user?.role === "ADMIN" ? lessons : lessons.filter((l) => l.published);

  // The same ranked proposal /today computes, narrowed to this course. Only
  // worth the query for someone who can actually attempt something.
  const snapshot = user && access.hasAccess ? await getPracticeSnapshot(user) : null;
  const standing =
    snapshot?.courses.find((c) => c.courseId === course.id) ?? null;
  const next = snapshot?.ranked.find((a) => a.courseId === course.id) ?? null;

  return (
    <Page width="narrow">
      <PageHeader
        crumbs={[{ label: "Courses", href: "/courses" }, { label: course.title }]}
        title={course.title}
        subtitle={course.description ?? undefined}
      />

      {standing && standing.proven + standing.shaky + standing.untested > 0 && (
        <div className="mb-6 flex flex-wrap items-center gap-2">
          {standing.proven > 0 && (
            <Badge variant="proven">{standing.proven} proven</Badge>
          )}
          {standing.shaky > 0 && (
            <Badge variant="shaky">{standing.shaky} shaky</Badge>
          )}
          {standing.untested > 0 && (
            <Badge variant="untested">{standing.untested} untested</Badge>
          )}
          <span className="hr-ev">{standing.standing}</span>
        </div>
      )}

      {/* Arrival: the one thing worth doing inside this course, with why. */}
      {next && (
        <Card className="mb-8">
          <CardHeader>
            <span className="hr-eyebrow">{next.eyebrow}</span>
            <span className="ml-auto hr-path">picked for you</span>
          </CardHeader>
          <CardContent>
            <p className="font-semibold text-ink">{next.title}</p>
            <p className="mt-2 max-w-[66ch] text-[13.5px] leading-relaxed text-ink">
              {next.reason}
            </p>
            <div className="hr-cite mt-3">
              {next.evidence.map((line) => (
                <p key={line} className="text-dim">
                  {line}
                </p>
              ))}
            </div>
          </CardContent>
          <CardFooter>
            <Link href={next.href} className="hr-btn hr-btn-primary hr-btn-sm">
              {next.cta}
            </Link>
          </CardFooter>
        </Card>
      )}
      {!access.hasAccess && access.product && (
        <div className="mt-4 flex items-center justify-between rounded-lg bg-bg p-4">
          <p className="text-sm text-dim">
            <span className="font-semibold text-ink">
              {access.product.name}
            </span>{" "}
            · {formatPrice(access.product)}
            {access.product.trialDays > 0 &&
              ` · ${access.product.trialDays}-day free trial`}
          </p>
          <a
            href={
              user
                ? `/api/checkout?productId=${access.product.id}`
                : "/sign-up"
            }
            className="rounded-md bg-acc px-4 py-2 text-sm font-medium text-acc-ink hover:opacity-90"
          >
            {access.product.trialDays > 0 ? "Start free trial" : "Subscribe"}
          </a>
        </div>
      )}
      {!user && !access.product && (
        <p className="mt-4 rounded-lg bg-bg p-4 text-sm text-dim">
          <Link href="/sign-up" className="font-medium underline">
            Create an account
          </Link>{" "}
          to take this course. Lessons marked “preview” are free to watch.
        </p>
      )}

      <div className="mt-10 space-y-8">
        {course.sections.every(
          (section) => visibleLessons(section.lessons).length === 0,
        ) && (
          <EmptyState
            glyph="▷"
            title="No lessons published yet"
            body={
              user?.role === "ADMIN"
                ? "You can see this course because you're an admin. Add a lesson and publish it — until then a member opening this page sees an empty shelf."
                : "This course doesn't have anything to watch yet. It'll show up here the moment the first lesson is published."
            }
            actionLabel={user?.role === "ADMIN" ? "Edit this course" : undefined}
            actionHref={user?.role === "ADMIN" ? `/admin/courses/${course.id}` : undefined}
          />
        )}
        {course.sections.map((section) => (
          <section key={section.id}>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-dim">
              {section.title}
            </h2>
            <ul className="divide-y divide-line rounded-lg border border-line">
              {visibleLessons(section.lessons).map((lesson) => {
                const accessible = lessonAccessible(
                  user,
                  lesson,
                  access.hasAccess,
                );
                const row = (
                  <li className="flex items-center justify-between px-4 py-3 text-sm">
                    <span className="flex items-center gap-2">
                      <span
                        className={
                          completedIds.has(lesson.id)
                            ? "text-acc"
                            : "text-dim"
                        }
                      >
                        ●
                      </span>
                      {lesson.title}
                      {!lesson.published && (
                        <span className="rounded bg-warn-soft px-1.5 py-0.5 text-xs text-warn">
                          draft
                        </span>
                      )}
                      {lesson.isPublicPreview && (
                        <span className="rounded bg-acc-soft px-1.5 py-0.5 text-xs text-acc">
                          preview
                        </span>
                      )}
                    </span>
                    {!accessible && <span className="text-dim">🔒</span>}
                  </li>
                );
                return accessible ? (
                  <Link
                    key={lesson.id}
                    href={`/courses/${course.slug}/${lesson.slug}`}
                    className="block hover:bg-bg"
                  >
                    {row}
                  </Link>
                ) : (
                  <div key={lesson.id}>{row}</div>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </Page>
  );
}
