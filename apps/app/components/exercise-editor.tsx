"use client";

import { useState } from "react";
import type { ExerciseFile } from "@/lib/exercises/runner";

type BoundAction = (formData: FormData) => void | Promise<void>;

/**
 * The attempt surface: file tabs, a monospace editor per file, an action bar,
 * then the hint ladder. Everything sits in one form so a hint reveal carries
 * the learner's current code with it and never discards their work.
 *
 * Deliberately a textarea, not Monaco/CodeMirror — the real editor is its own
 * issue, and a styled textarea is honest about what this is today.
 */
export function ExerciseEditor({
  files,
  language,
  hints,
  hintsUsed,
  solutionRevealed,
  everPassed,
  runAction,
  hintAction,
  solutionAction,
  manualPassAction,
}: {
  files: ExerciseFile[];
  language: string;
  hints: string[];
  hintsUsed: number;
  solutionRevealed: boolean;
  everPassed: boolean;
  runAction: BoundAction;
  hintAction: BoundAction;
  solutionAction: BoundAction;
  manualPassAction: BoundAction | null;
}) {
  const [active, setActive] = useState(files[0]?.path ?? "");
  const lastRung = hints.length > 0 ? hints.length - 1 : 0;
  const nextRung = hintsUsed; // index of the hint a reveal would open
  const nextIsSolution = nextRung >= lastRung && hints.length > 0;

  return (
    // Running is the default submit; the other buttons override with formAction.
    <form action={runAction} className="mt-4 space-y-4">
      <div className="hr-card overflow-hidden">
        {/* Paths are long and phones are narrow: scroll the strip, don't wrap it. */}
        <div className="flex items-center gap-1 overflow-x-auto border-b border-line bg-bg px-2 py-1.5">
          {files.map((f) => (
            <button
              key={f.path}
              type="button"
              onClick={() => setActive(f.path)}
              aria-pressed={f.path === active}
              className={`shrink-0 rounded-[6px] px-2.5 py-1 font-mono text-[11.5px] ${
                f.path === active
                  ? "bg-panel text-ink"
                  : "text-dim hover:bg-soft"
              }`}
            >
              {f.path}
            </button>
          ))}
          <span className="ml-auto hr-path px-1">{language.toLowerCase()}</span>
        </div>

        {files.map((f) => (
          <div key={f.path} hidden={f.path !== active}>
            <label className="sr-only" htmlFor={`file-${f.path}`}>
              {f.path}
            </label>
            <textarea
              id={`file-${f.path}`}
              name={`file:${f.path}`}
              defaultValue={f.contents}
              spellCheck={false}
              rows={18}
              className="block w-full resize-y border-0 bg-panel px-4 py-3 font-mono text-[12.5px] leading-[1.6] text-ink outline-none"
            />
          </div>
        ))}

        <div className="hr-card-f flex-wrap">
          <button type="submit" formAction={runAction} className="hr-btn hr-btn-primary hr-btn-sm">
            Run tests
          </button>
          {manualPassAction && (
            <button
              type="submit"
              formAction={manualPassAction}
              className="hr-btn hr-btn-sm"
              title="Admin only — records an override, not a test run"
            >
              Mark as passed (manual)
            </button>
          )}
          <span className="hr-ev ml-auto">
            {everPassed
              ? "You have a passing run on this exercise."
              : "Nothing is recorded until you run."}
          </span>
        </div>
      </div>

      {hints.length > 0 && (
        <section className="hr-card">
          <div className="hr-card-h">
            <span className="font-semibold">Hints</span>
            <span className="ml-auto hr-path">
              {Math.min(hintsUsed, hints.length)}/{hints.length} opened
            </span>
          </div>
          <ol>
            {hints.map((hint, i) => {
              const opened = i < hintsUsed;
              const isSolutionRung = i === lastRung;
              return (
                <li key={i} className={`hr-row items-start ${opened ? "" : "bg-bg"}`}>
                  <span className="mt-0.5 shrink-0 font-mono text-[11.5px] text-dim">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  {opened ? (
                    <span className="min-w-0 flex-1 whitespace-pre-wrap text-ink">
                      {hint}
                    </span>
                  ) : (
                    <span className="min-w-0 flex-1 text-dim">
                      {isSolutionRung
                        ? "The full solution. Revealing it drops the proven mark on this skill — the pass still records, but it will not count as proven."
                        : "Locked. Open the one above it first."}
                    </span>
                  )}
                </li>
              );
            })}
          </ol>
          <div className="hr-card-f flex-wrap">
            {hintsUsed < hints.length && !solutionRevealed ? (
              <>
                {/* The cost is stated before the click, never after. */}
                <button
                  type="submit"
                  formAction={nextIsSolution ? solutionAction : hintAction}
                  className="hr-btn hr-btn-sm"
                >
                  {nextIsSolution
                    ? "Reveal the solution — this drops the proven mark"
                    : `Open hint ${nextRung + 1} of ${hints.length}`}
                </button>
                <span className="hr-ev">
                  {nextIsSolution
                    ? "You can still pass the tests afterwards. It just will not count as proven."
                    : "Hints cost nothing until the last one."}
                </span>
              </>
            ) : (
              <span className="hr-ev">
                {solutionRevealed
                  ? "Solution revealed — this attempt will not count as proven."
                  : "Every hint is open."}
              </span>
            )}
          </div>
        </section>
      )}
    </form>
  );
}
