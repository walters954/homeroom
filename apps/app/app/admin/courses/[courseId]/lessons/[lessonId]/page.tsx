import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@homeroom/db";
import { PullTranscriptButton } from "@/components/pull-transcript-button";
import { VideoEmbed } from "@/components/video-embed";
import {
  draftAnnouncement,
  draftLessonFromTranscript,
} from "@/lib/actions/agent";
import { deleteLesson, updateLesson } from "@/lib/actions/courses";
import { saveManualTranscript } from "@/lib/actions/transcripts";
import { requireAdmin } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function AdminLessonPage({
  params,
}: {
  params: Promise<{ courseId: string; lessonId: string }>;
}) {
  await requireAdmin();
  const { courseId, lessonId } = await params;
  const lesson = await db.lesson.findUnique({
    where: { id: lessonId },
    include: {
      transcript: true,
      section: { include: { course: true } },
    },
  });
  if (!lesson || lesson.section.courseId !== courseId) notFound();

  const body = (lesson.body as { markdown?: string } | null)?.markdown ?? "";

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <p className="mb-2 text-sm text-zinc-500">
        <Link href="/admin" className="hover:underline">
          Admin
        </Link>{" "}
        ·{" "}
        <Link href={`/admin/courses/${courseId}`} className="hover:underline">
          {lesson.section.course.title}
        </Link>{" "}
        · {lesson.section.title}
      </p>
      <h1 className="mb-8 text-3xl font-bold tracking-tight">{lesson.title}</h1>

      {lesson.videoProvider !== "NONE" && lesson.videoId && (
        <div className="mb-8">
          <VideoEmbed
            provider={lesson.videoProvider}
            videoId={lesson.videoId}
            title={lesson.title}
          />
        </div>
      )}

      <section className="mb-10 rounded-lg border border-zinc-200 p-5">
        <h2 className="mb-4 text-lg font-semibold">Lesson</h2>
        <form
          action={updateLesson.bind(null, lesson.id, courseId)}
          className="flex flex-col gap-3 text-sm"
        >
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 font-medium">
              Title
              <input
                name="title"
                defaultValue={lesson.title}
                className="rounded-md border border-zinc-300 px-3 py-2 font-normal"
              />
            </label>
            <label className="flex flex-col gap-1 font-medium">
              Slug
              <input
                name="slug"
                defaultValue={lesson.slug}
                className="rounded-md border border-zinc-300 px-3 py-2 font-normal"
              />
            </label>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <label className="flex flex-col gap-1 font-medium">
              Video provider
              <select
                name="videoProvider"
                defaultValue={lesson.videoProvider}
                className="rounded-md border border-zinc-300 px-3 py-2 font-normal"
              >
                <option value="NONE">None</option>
                <option value="VIMEO">Vimeo</option>
                <option value="YOUTUBE">YouTube</option>
                <option value="MUX">Mux</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 font-medium">
              Video ID
              <input
                name="videoId"
                defaultValue={lesson.videoId ?? ""}
                placeholder="e.g. 987654321"
                className="rounded-md border border-zinc-300 px-3 py-2 font-normal"
              />
            </label>
            <label className="flex flex-col gap-1 font-medium">
              Duration (sec)
              <input
                name="durationSeconds"
                type="number"
                defaultValue={lesson.durationSeconds ?? ""}
                className="rounded-md border border-zinc-300 px-3 py-2 font-normal"
              />
            </label>
          </div>
          <label className="flex flex-col gap-1 font-medium">
            Body (markdown)
            <textarea
              name="body"
              defaultValue={body}
              rows={10}
              className="rounded-md border border-zinc-300 px-3 py-2 font-mono text-xs"
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 font-medium">
              SEO title
              <input
                name="seoTitle"
                defaultValue={lesson.seoTitle ?? ""}
                className="rounded-md border border-zinc-300 px-3 py-2 font-normal"
              />
            </label>
            <label className="flex flex-col gap-1 font-medium">
              SEO description
              <input
                name="seoDescription"
                defaultValue={lesson.seoDescription ?? ""}
                className="rounded-md border border-zinc-300 px-3 py-2 font-normal"
              />
            </label>
          </div>
          <div className="flex gap-6">
            <label className="flex items-center gap-2 font-medium">
              <input
                type="checkbox"
                name="published"
                defaultChecked={lesson.published}
              />
              Published
            </label>
            <label className="flex items-center gap-2 font-medium">
              <input
                type="checkbox"
                name="isPublicPreview"
                defaultChecked={lesson.isPublicPreview}
              />
              Free public preview
            </label>
          </div>
          <button
            type="submit"
            className="self-start rounded-md bg-zinc-900 px-4 py-2 font-medium text-white hover:bg-zinc-700"
          >
            Save lesson
          </button>
        </form>
      </section>

      <section className="mb-10 rounded-lg border border-zinc-200 p-5">
        <h2 className="mb-1 text-lg font-semibold">Transcript</h2>
        <p className="mb-4 text-sm text-zinc-500">
          The transcript is the agent&apos;s grounding corpus for this lesson —
          the tutor can only teach what&apos;s in here.
        </p>
        {lesson.transcript ? (
          <div className="mb-4 rounded-md bg-zinc-50 p-4 text-sm">
            <p className="mb-2 text-xs text-zinc-500">
              {lesson.transcript.source.toLowerCase()} ·{" "}
              {lesson.transcript.text.length.toLocaleString()} chars ·{" "}
              {Array.isArray(lesson.transcript.segments)
                ? `${(lesson.transcript.segments as unknown[]).length} timed segments`
                : "no timing data"}
            </p>
            <p className="line-clamp-4 text-zinc-700">
              {lesson.transcript.text.slice(0, 500)}…
            </p>
          </div>
        ) : (
          <p className="mb-4 text-sm text-amber-700">No transcript yet.</p>
        )}
        {lesson.videoProvider === "VIMEO" && lesson.videoId && (
          <div className="mb-4">
            <PullTranscriptButton lessonId={lesson.id} courseId={courseId} />
          </div>
        )}
        <form
          action={saveManualTranscript.bind(null, lesson.id, courseId)}
          className="flex flex-col gap-2"
        >
          <textarea
            name="transcript"
            rows={5}
            placeholder="Or paste a transcript here (plain text or WebVTT)…"
            className="rounded-md border border-zinc-300 px-3 py-2 font-mono text-xs"
          />
          <button className="self-start rounded-md border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-100">
            Save pasted transcript
          </button>
        </form>
      </section>

      <section className="mb-10 rounded-lg border border-zinc-200 p-5">
        <h2 className="mb-1 text-lg font-semibold">Agent</h2>
        <p className="mb-4 text-sm text-zinc-500">
          Drafts land in the{" "}
          <Link href="/admin/suggestions" className="underline">
            suggestion queue
          </Link>{" "}
          for your approval — the agent never publishes directly.
        </p>
        <div className="flex gap-2">
          <form action={draftLessonFromTranscript.bind(null, lesson.id, courseId)}>
            <button
              disabled={!lesson.transcript}
              className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-100 disabled:opacity-40"
            >
              ✍️ Draft lesson from transcript
            </button>
          </form>
          <form action={draftAnnouncement.bind(null, lesson.id, courseId)}>
            <button className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-100">
              📣 Draft announcement email
            </button>
          </form>
        </div>
      </section>

      <form action={deleteLesson.bind(null, lesson.id, courseId)}>
        <button className="text-sm text-red-500 hover:underline">
          Delete lesson
        </button>
      </form>
    </main>
  );
}
