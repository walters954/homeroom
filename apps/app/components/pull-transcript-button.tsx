"use client";

import { useState, useTransition } from "react";
import { pullVimeoTranscript } from "@/lib/actions/transcripts";

export function PullTranscriptButton({
  lessonId,
  courseId,
}: {
  lessonId: string;
  courseId: string;
}) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await pullVimeoTranscript(lessonId, courseId);
            setMessage(result.message);
          })
        }
        className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-100 disabled:opacity-50"
      >
        {pending ? "Pulling from Vimeo…" : "Pull transcript from Vimeo captions"}
      </button>
      {message && <span className="text-sm text-zinc-500">{message}</span>}
    </div>
  );
}
