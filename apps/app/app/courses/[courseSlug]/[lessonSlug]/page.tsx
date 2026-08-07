import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { db } from "@homeroom/db";
import type { Metadata } from "next";
import { Markdown } from "@/components/markdown";
import { TutorFloater } from "@/components/tutor-floater";
import { VideoEmbed } from "@/components/video-embed";
import { toggleLessonComplete } from "@/lib/actions/progress";
import { getCourseAccess, lessonAccessible } from "@/lib/access";
import { getCurrentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

async function getLesson(courseSlug: string, lessonSlug: string) {
  const course = await db.course.findUnique({
    where: { slug: courseSlug },
    include: {
      sections: {
        orderBy: { order: "asc" },
        include: { lessons: { orderBy: { order: "asc" } } },
      },
    },
  });
  if (!course) return null;
  const flat = course.sections.flatMap((s) => s.lessons);
  const lesson = flat.find((l) => l.slug === lessonSlug);
  if (!lesson) return null;
  const idx = flat.findIndex((l) => l.id === lesson.id);
  return {
    course,
    lesson,
    prev: idx > 0 ? flat[idx - 1] : null,
    next: idx < flat.length - 1 ? flat[idx + 1] : null,
  };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ courseSlug: string; lessonSlug: string }>;
}): Promise<Metadata> {
  const { courseSlug, lessonSlug } = await params;
  const data = await getLesson(courseSlug, lessonSlug);
  if (!data) return {};
  return {
    title: data.lesson.seoTitle ?? `${data.lesson.title} — ${data.course.title}`,
    description: data.lesson.seoDescription ?? undefined,
  };
}

export default async function LessonPage({
  params,
}: {
  params: Promise<{ courseSlug: string; lessonSlug: string }>;
}) {
  const { courseSlug, lessonSlug } = await params;
  const [user, data] = await Promise.all([
    getCurrentUser(),
    getLesson(courseSlug, lessonSlug),
  ]);
  if (!data) notFound();
  const { course, lesson, prev, next } = data;

  const access = await getCourseAccess(user, course.id);
  if (!lessonAccessible(user, lesson, access.hasAccess)) {
    if (!user) redirect(`/sign-in`);
    redirect(`/courses/${course.slug}`);
  }

  const progress = user
    ? await db.lessonProgress.findUnique({
        where: { userId_lessonId: { userId: user.id, lessonId: lesson.id } },
      })
    : null;
  const completed = Boolean(progress?.completedAt);
  const body = (lesson.body as { markdown?: string } | null)?.markdown;
  const coursePath = `/courses/${course.slug}/${lesson.slug}`;

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <p className="mb-2 text-sm text-dim">
        <Link href={`/courses/${course.slug}`} className="hover:underline">
          {course.title}
        </Link>
      </p>
      <h1 className="mb-6 text-2xl font-bold tracking-tight">{lesson.title}</h1>

      <VideoEmbed
        provider={lesson.videoProvider}
        videoId={lesson.videoId}
        title={lesson.title}
      />

      {body && (
        <div className="mt-8">
          <Markdown>{body}</Markdown>
        </div>
      )}

      <div className="mt-10 flex items-center justify-between border-t border-line pt-6">
        <div>
          {prev && (
            <Link
              href={`/courses/${course.slug}/${prev.slug}`}
              className="text-sm text-dim hover:underline"
            >
              ← {prev.title}
            </Link>
          )}
        </div>
        {user && (
          <form
            action={toggleLessonComplete.bind(null, lesson.id, coursePath)}
          >
            <button
              type="submit"
              className={
                completed
                  ? "rounded-md bg-acc-soft px-4 py-2 text-sm font-medium text-acc hover:opacity-90"
                  : "rounded-md bg-acc px-4 py-2 text-sm font-medium text-acc-ink hover:opacity-90"
              }
            >
              {completed ? "✓ Completed" : "Mark complete"}
            </button>
          </form>
        )}
        <div>
          {next && (
            <Link
              href={`/courses/${course.slug}/${next.slug}`}
              className="text-sm text-dim hover:underline"
            >
              {next.title} →
            </Link>
          )}
        </div>
      </div>

      {user && <TutorFloater lessonId={lesson.id} />}
    </main>
  );
}
