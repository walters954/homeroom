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
import { Page, PageHeader } from "@/components/page-header";
import { requireAdmin } from "@/lib/session";
import { Button, Card, Input, Select, Textarea } from "@homeroom/ui";

export const dynamic = "force-dynamic";
// Model calls + fan-out can run long; Pro allows well past the default.
export const maxDuration = 300;

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

  const sections = await db.section.findMany({
    where: { courseId },
    orderBy: [{ order: "asc" }, { id: "asc" }],
    select: { id: true, title: true },
  });

  const body = (lesson.body as { markdown?: string } | null)?.markdown ?? "";

  return (
    <Page width="narrow">
      <PageHeader
        crumbs={[
          { label: "Admin", href: "/admin" },
          {
            label: lesson.section.course.title,
            href: `/admin/courses/${courseId}`,
          },
          { label: lesson.section.title },
        ]}
        title={lesson.title}
        subtitle="The video teaches and the transcript grounds the tutor — a lesson without one leaves the agent guessing."
      />

      {lesson.videoProvider !== "NONE" && lesson.videoId && (
        <div className="mb-8">
          <VideoEmbed
            provider={lesson.videoProvider}
            videoId={lesson.videoId}
            title={lesson.title}
          />
        </div>
      )}

      <Card className="mb-4 p-5">
        <h2 className="mb-4 text-[13px] font-semibold">Lesson</h2>
        <form
          action={updateLesson.bind(null, lesson.id, courseId)}
          className="flex flex-col gap-3 text-sm"
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 font-medium">
              Title
              <Input
                name="title"
                defaultValue={lesson.title}
                className="font-normal"
              />
            </label>
            <label className="flex flex-col gap-1 font-medium">
              Slug
              <Input
                name="slug"
                defaultValue={lesson.slug}
                className="font-normal"
              />
            </label>
          </div>
          <label className="flex flex-col gap-1 font-medium">
            Section
            <Select
              name="sectionId"
              defaultValue={lesson.sectionId}
              className="font-normal"
            >
              {sections.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title}
                </option>
              ))}
            </Select>
            <span className="hr-ev">
              Moving a lesson puts it at the end of the new section — reorder it
              from the course page.
            </span>
          </label>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <label className="flex flex-col gap-1 font-medium">
              Video provider
              <Select
                name="videoProvider"
                defaultValue={lesson.videoProvider}
                className="font-normal"
              >
                <option value="NONE">None</option>
                <option value="VIMEO">Vimeo</option>
                <option value="YOUTUBE">YouTube</option>
                <option value="MUX">Mux</option>
              </Select>
            </label>
            <label className="flex flex-col gap-1 font-medium">
              Video ID
              <Input
                name="videoId"
                defaultValue={lesson.videoId ?? ""}
                placeholder="e.g. 987654321"
                className="font-normal"
              />
            </label>
            <label className="flex flex-col gap-1 font-medium">
              Duration (sec)
              <Input
                name="durationSeconds"
                type="number"
                defaultValue={lesson.durationSeconds ?? ""}
                className="font-normal"
              />
            </label>
          </div>
          <label className="flex flex-col gap-1 font-medium">
            Body (markdown)
            <Textarea
              name="body"
              defaultValue={body}
              rows={10}
              className="font-mono text-[12px] font-normal"
            />
          </label>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 font-medium">
              SEO title
              <Input
                name="seoTitle"
                defaultValue={lesson.seoTitle ?? ""}
                className="font-normal"
              />
            </label>
            <label className="flex flex-col gap-1 font-medium">
              SEO description
              <Input
                name="seoDescription"
                defaultValue={lesson.seoDescription ?? ""}
                className="font-normal"
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
          <Button
            type="submit"
            size="sm" className="self-start"
          >
            Save lesson
          </Button>
        </form>
      </Card>

      <Card className="mb-4 p-5">
        <h2 className="mb-1 text-lg font-semibold">Transcript</h2>
        <p className="mb-4 text-sm text-dim">
          The transcript is the agent&apos;s grounding corpus for this lesson —
          the tutor can only teach what&apos;s in here.
        </p>
        {lesson.transcript ? (
          <div className="mb-4 rounded-md bg-bg p-4 text-sm">
            <p className="mb-2 text-xs text-dim">
              {lesson.transcript.source.toLowerCase()} ·{" "}
              {lesson.transcript.text.length.toLocaleString()} chars ·{" "}
              {Array.isArray(lesson.transcript.segments)
                ? `${(lesson.transcript.segments as unknown[]).length} timed segments`
                : "no timing data"}
            </p>
            <p className="line-clamp-4 text-ink">
              {lesson.transcript.text.slice(0, 500)}…
            </p>
          </div>
        ) : (
          <p className="mb-4 text-sm text-warn">No transcript yet.</p>
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
          <label className="text-sm font-medium">
            Upload a transcript file (.vtt, .srt, .txt)
            <input
              type="file"
              name="file"
              accept=".vtt,.srt,.txt,text/plain"
              className="mt-1 block w-full text-xs text-dim file:mr-3 file:rounded-md file:border file:border-line file:bg-panel file:px-3 file:py-1.5 file:text-xs file:hover:bg-soft"
            />
          </label>
          <Textarea
            name="transcript"
            rows={5}
            placeholder="…or paste a transcript here (plain text, WebVTT, or SRT)"
            className="font-mono text-[12px] font-normal"
          />
          <Button variant="outline" size="sm" className="self-start">
            Save transcript
          </Button>
        </form>
      </Card>

      <Card className="mb-4 p-5">
        <h2 className="mb-1 text-lg font-semibold">Agent</h2>
        <p className="mb-4 text-sm text-dim">
          Drafts land in the{" "}
          <Link href="/admin/suggestions" className="underline">
            suggestion queue
          </Link>{" "}
          for your approval — the agent never publishes directly.
        </p>
        <div className="flex gap-2">
          <form action={draftLessonFromTranscript.bind(null, lesson.id, courseId)}>
            <Button
              disabled={!lesson.transcript}
              variant="outline" size="sm" className="disabled:opacity-40"
            >
              ✍️ Draft lesson from transcript
            </Button>
          </form>
          <form action={draftAnnouncement.bind(null, lesson.id, courseId)}>
            <Button variant="outline" size="sm">
              📣 Draft announcement email
            </Button>
          </form>
        </div>
      </Card>

      <form action={deleteLesson.bind(null, lesson.id, courseId)}>
        <button className="text-sm text-fail hover:underline">
          Delete lesson
        </button>
      </form>
    </Page>
  );
}
