"use client";

import { usePathname } from "next/navigation";
import { endStudentPreview, startStudentPreview } from "@/lib/actions/viewer";

/**
 * The two halves of "view as student": a quiet control in the rail to enter,
 * and an unmissable bar to leave. Both carry the current path so you land
 * where you were rather than back at the top.
 */

export function EnterPreviewButton({ expanded }: { expanded?: boolean }) {
  const pathname = usePathname();
  return (
    <form action={startStudentPreview}>
      <input type="hidden" name="redirectTo" value={pathname} />
      <button
        type="submit"
        title="View as student"
        aria-label="View as student"
        className={
          expanded
            ? "flex shrink-0 items-center gap-2 rounded-[7px] border border-line px-3 py-1.5 text-[12px] text-dim hover:bg-soft"
            : "grid h-[31px] w-[31px] place-items-center rounded-[7px] text-[13px] text-dim hover:bg-soft"
        }
      >
        <span aria-hidden>◐</span>
        {expanded && <span>View as student</span>}
      </button>
    </form>
  );
}

export function PreviewBar() {
  const pathname = usePathname();
  return (
    <div
      role="status"
      className="fixed inset-x-0 bottom-0 z-50 flex justify-center px-4 pb-4"
    >
      <div className="pointer-events-auto flex items-center gap-3 rounded-full border border-warn bg-warn-soft px-4 py-2 text-[12.5px] shadow-lg">
        <span aria-hidden className="text-warn">
          ◐
        </span>
        <span className="text-ink">
          Viewing as a student. Paywalls and draft lessons apply to you right
          now.
        </span>
        <form action={endStudentPreview}>
          <input type="hidden" name="redirectTo" value={pathname} />
          <button
            type="submit"
            className="rounded-full border border-warn px-3 py-1 text-[11.5px] font-semibold text-warn hover:bg-panel"
          >
            Back to admin
          </button>
        </form>
      </div>
    </div>
  );
}
