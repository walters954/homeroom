import Link from "next/link";
import { db } from "@homeroom/db";
import { Badge, Card, CardContent, CardFooter, CardHeader } from "@homeroom/ui";
import { EmptyState } from "@/components/empty-state";
import { getCurrentUser } from "@/lib/session";
import { Page, PageHeader } from "@/components/page-header";
import { getPracticeSnapshot, plural, type CourseStanding } from "@/lib/practice";

export const metadata = { title: "Courses" };
export const dynamic = "force-dynamic";

export default async function CoursesPage() {
  const user = await getCurrentUser();
  const courses = await db.course.findMany({
    where: user?.role === "ADMIN" ? {} : { published: true },
    orderBy: { createdAt: "asc" },
    include: {
      sections: {
        include: { lessons: { where: { published: true }, select: { id: true } } },
      },
    },
  });

  // Signed out, there is no practice record to rank against, so this is a
  // catalog and honestly says so.
  const snapshot = user ? await getPracticeSnapshot(user) : null;
  const standingBy = new Map(
    (snapshot?.courses ?? []).map((c) => [c.courseId, c]),
  );

  // `courses` is already ordered most-deserving-first, so the first one
  // carrying a proposal is the arrival state.
  const chosen = snapshot?.courses.find((c) => c.next) ?? null;
  const chosenCourse = chosen
    ? (courses.find((c) => c.id === chosen.courseId) ?? null)
    : null;
  const rest = chosenCourse
    ? courses.filter((c) => c.id !== chosenCourse.id)
    : courses;

  return (
    <Page>
      <PageHeader
        crumbs={[{ label: "Courses" }]}
        title={chosenCourse ? chosenCourse.title : "Courses"}
        subtitle={
          chosenCourse
            ? "Where you left off, and the one thing inside it worth doing next. The rest of the catalog is below."
            : user
              ? "Nothing is mid-flight. Pick where to start — the counts are what you've proven, not what you've watched."
              : "What this school teaches. Sign in to see what you've proven."
        }
      />

      {courses.length === 0 &&
        (user?.role === "ADMIN" ? (
          <EmptyState
            glyph="▷"
            title="No courses yet"
            body="A course holds sections, lessons and the exercises that prove them. Create one, add a lesson, drop in its transcript — the agent drafts the rest."
            actionLabel="Create your first course"
            actionHref="/admin"
          />
        ) : (
          <EmptyState
            glyph="▷"
            title="Nothing published yet"
            body="Your instructor hasn't published a course here yet. You'll get an email the moment the first lesson goes live."
          />
        ))}

      {/* Arrival: a decision with its reason, not a grid to shop in. */}
      {chosenCourse && chosen?.next && (
        <Card className="mb-8">
          <CardHeader>
            <span className="hr-eyebrow">{chosen.next.eyebrow}</span>
            <span className="ml-auto hr-path">picked for you</span>
          </CardHeader>
          <CardContent>
            <p className="font-semibold text-ink">{chosen.next.title}</p>
            <p className="mt-2 max-w-[66ch] text-[13.5px] leading-relaxed text-ink">
              {chosen.next.reason}
            </p>
            <div className="hr-cite mt-3">
              {chosen.next.evidence.map((line) => (
                <p key={line} className="text-dim">
                  {line}
                </p>
              ))}
              <p className="text-dim">{chosen.standing}</p>
            </div>
          </CardContent>
          <CardFooter>
            <Link
              href={chosen.next.href}
              className="hr-btn hr-btn-primary hr-btn-sm"
            >
              {chosen.next.cta}
            </Link>
            <Link
              href={`/courses/${chosenCourse.slug}`}
              className="hr-btn hr-btn-sm"
            >
              Open the course
            </Link>
          </CardFooter>
        </Card>
      )}

      {/* The seam: the catalog, demoted to what it is. */}
      {rest.length > 0 && (
        <section>
          {chosenCourse && <p className="hr-eyebrow mb-3">Browse the rest</p>}
          <div className="grid gap-6 sm:grid-cols-2">
            {rest.map((course) => {
              const total = course.sections.reduce(
                (n, s) => n + s.lessons.length,
                0,
              );
              return (
                <Link
                  key={course.id}
                  href={`/courses/${course.slug}`}
                  className="rounded-xl border border-line p-6 transition-colors hover:border-dim"
                >
                  <h2 className="text-lg font-semibold">
                    {course.title}
                    {!course.published && (
                      <span className="ml-2 rounded bg-warn-soft px-1.5 py-0.5 text-xs font-medium text-warn">
                        draft
                      </span>
                    )}
                  </h2>
                  {course.description && (
                    <p className="mt-2 line-clamp-2 text-sm text-dim">
                      {course.description}
                    </p>
                  )}
                  <CourseCounts standing={standingBy.get(course.id)} />
                  <p className="mt-3 text-xs text-dim">
                    {plural(total, "lesson")}
                  </p>
                </Link>
              );
            })}
          </div>
        </section>
      )}
    </Page>
  );
}

/**
 * What replaced `X% complete`.
 *
 * The old stat came from `LessonProgress.completedAt`, so it advanced by
 * watching — teaching the belief the practice loop exists to break, on the
 * most-visited screen in the app. These counts only move when someone passes
 * an exercise they hadn't seen.
 */
function CourseCounts({ standing }: { standing?: CourseStanding }) {
  if (!standing) return null;
  const { proven, shaky, untested } = standing;
  if (proven + shaky + untested === 0) return null;

  return (
    <>
      <div className="mt-4 flex flex-wrap gap-2">
        {proven > 0 && <Badge variant="proven">{proven} proven</Badge>}
        {shaky > 0 && <Badge variant="shaky">{shaky} shaky</Badge>}
        {untested > 0 && <Badge variant="untested">{untested} untested</Badge>}
      </div>
      <p className="hr-ev mt-2">{standing.standing}</p>
    </>
  );
}
