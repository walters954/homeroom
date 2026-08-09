"use client";

import { useEffect, useRef } from "react";
import { ChevronRight } from "lucide-react";
import { Button } from "@homeroom/ui";
import type { ScopePresentation } from "@/lib/agent/scope";

export interface AgentMessage {
  role: "user" | "assistant";
  text: string;
}

/**
 * The conversation itself. Shared by the docked desktop pane and the mobile
 * sheet so the two presentations can't drift apart.
 */
export function AgentPaneBody({
  presentation,
  messages,
  busy,
  onAsk,
}: {
  presentation: ScopePresentation;
  messages: AgentMessage[];
  busy: boolean;
  onAsk: (question: string) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const input = inputRef.current;
    if (!input) return;
    const question = input.value.trim();
    if (!question || busy) return;
    input.value = "";
    onAsk(question);
  }

  return (
    <>
      <div ref={scrollRef} className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <div className="flex flex-col gap-3">
            <p className="text-[12.5px] leading-relaxed text-dim">
              {presentation.intro}
            </p>
            <p className="hr-eyebrow">Try asking</p>
            <div className="flex flex-col gap-1.5">
              {presentation.suggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => onAsk(s)}
                  disabled={busy}
                  className="rounded-[7px] border border-line bg-bg px-3 py-2 text-left text-[12.5px] text-ink hover:border-acc disabled:opacity-50"
                >
                  {s}
                </button>
              ))}
            </div>
            <p className="mt-1 text-[11px] leading-relaxed text-dim">
              Answers come from this school&apos;s own material, and cite the
              lesson they came from. If it isn&apos;t in the course, the tutor
              says so instead of guessing.
            </p>
          </div>
        ) : (
          messages.map((m, i) => (
            <div
              key={i}
              className={
                m.role === "user"
                  ? "self-end max-w-[88%] rounded-[9px] border border-line bg-bg px-3 py-2 text-[12.5px]"
                  : "whitespace-pre-wrap text-[12.5px] leading-relaxed text-ink"
              }
            >
              {m.text || (busy && i === messages.length - 1 ? "…" : "")}
            </div>
          ))
        )}
      </div>

      <form onSubmit={submit} className="border-t border-line p-3">
        <div className="flex items-center gap-2 rounded-[8px] border border-line bg-bg px-3 py-2 focus-within:border-acc">
          <input
            ref={inputRef}
            placeholder="Ask about this…"
            aria-label="Ask the tutor"
            className="min-w-0 flex-1 bg-transparent text-[12.5px] text-ink outline-none placeholder:text-dim"
          />
          <button
            type="submit"
            disabled={busy}
            aria-label="Send"
            className="grid h-[25px] w-[25px] shrink-0 place-items-center rounded-[6px] bg-acc text-[12px] text-acc-ink disabled:opacity-40"
          >
            ↑
          </button>
        </div>
      </form>
    </>
  );
}

/**
 * The Console third pane (docs/DESIGN.md §4) — docked from `lg`, collapsing to
 * a spine. Below `lg` there is no room for a third column, so the same body is
 * served as a sheet from the top bar instead.
 */
export function AgentDock({
  presentation,
  messages,
  busy,
  expanded,
  onExpandedChange,
  onAsk,
}: {
  presentation: ScopePresentation;
  messages: AgentMessage[];
  busy: boolean;
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  onAsk: (question: string) => void;
}) {
  if (!expanded) {
    return (
      <aside className="sticky top-0 hidden h-screen shrink-0 border-l border-line bg-panel lg:block">
        <button
          onClick={() => onExpandedChange(true)}
          aria-label="Show tutor"
          title="Show tutor"
          className="grid h-full w-[44px] place-items-center text-dim hover:bg-soft"
        >
          <span className="[writing-mode:vertical-rl] text-[11px] font-semibold tracking-[0.14em] uppercase">
            Tutor
          </span>
        </button>
      </aside>
    );
  }

  return (
    <aside className="sticky top-0 hidden h-screen w-[340px] shrink-0 flex-col border-l border-line bg-panel lg:flex">
      <div className="flex items-center gap-2 border-b border-line px-4 py-3">
        <span aria-hidden className="h-[7px] w-[7px] rounded-full bg-acc" />
        <h2 className="text-[12.5px] font-semibold">Tutor</h2>
        <span className="ml-auto font-mono text-[10.5px] text-dim">
          {presentation.label}
        </span>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onExpandedChange(false)}
          aria-label="Hide tutor"
          title="Hide tutor"
          className="h-6 w-6"
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </Button>
      </div>

      <AgentPaneBody
        presentation={presentation}
        messages={messages}
        busy={busy}
        onAsk={onAsk}
      />
    </aside>
  );
}
