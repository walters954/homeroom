"use client";

import { useEffect, useRef, useState } from "react";

export interface AgentSource {
  lessonId: string;
  course: string;
  section: string;
  lesson: string;
}

interface Message {
  role: "user" | "assistant";
  text: string;
}

/**
 * The Console third pane (docs/DESIGN.md §4). Permanent rather than a floating
 * bubble, and rescoped by whatever page it sits on — which is also what keeps
 * a sparse screen from feeling empty: with nothing to chat about yet, the pane
 * says what the agent can see and what to ask it.
 */
export function AgentPane({
  scope,
  lessonId,
  suggestions = [],
  intro,
}: {
  /** Shown beside the title: "this lesson", "your progress", … */
  scope: string;
  lessonId?: string;
  /** Prompts offered before the first message — the pane's arrival state. */
  suggestions?: string[];
  /** One sentence on what the agent can see here. */
  intro?: string;
}) {
  const [open, setOpen] = useState(true);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const conversationRef = useRef<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  async function ask(question: string) {
    const q = question.trim();
    if (!q || busy) return;
    setInput("");
    setBusy(true);
    setMessages((m) => [...m, { role: "user", text: q }, { role: "assistant", text: "" }]);

    try {
      const res = await fetch("/api/tutor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: q,
          lessonId,
          conversationId: conversationRef.current,
        }),
      });
      if (!res.ok || !res.body) throw new Error(String(res.status));
      conversationRef.current =
        res.headers.get("X-Conversation-Id") ?? conversationRef.current;

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        setMessages((m) => {
          const next = [...m];
          next[next.length - 1] = {
            role: "assistant",
            text: next[next.length - 1].text + chunk,
          };
          return next;
        });
      }
    } catch {
      setMessages((m) => {
        const next = [...m];
        next[next.length - 1] = {
          role: "assistant",
          text: "That didn't go through. Try again in a moment.",
        };
        return next;
      });
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <aside className="sticky top-0 hidden h-screen shrink-0 border-l border-line bg-panel lg:block">
        <button
          onClick={() => setOpen(true)}
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
        <span className="ml-auto font-mono text-[10.5px] text-dim">{scope}</span>
        <button
          onClick={() => setOpen(false)}
          aria-label="Hide tutor"
          title="Hide tutor"
          className="grid h-6 w-6 place-items-center rounded-[6px] text-dim hover:bg-soft"
        >
          ›
        </button>
      </div>

      <div ref={scrollRef} className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <div className="flex flex-col gap-3">
            {intro && (
              <p className="text-[12.5px] leading-relaxed text-dim">{intro}</p>
            )}
            {suggestions.length > 0 && (
              <>
                <p className="hr-eyebrow">Try asking</p>
                <div className="flex flex-col gap-1.5">
                  {suggestions.map((s) => (
                    <button
                      key={s}
                      onClick={() => void ask(s)}
                      className="rounded-[7px] border border-line bg-bg px-3 py-2 text-left text-[12.5px] text-ink hover:border-acc"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </>
            )}
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

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void ask(input);
        }}
        className="border-t border-line p-3"
      >
        <div className="flex items-center gap-2 rounded-[8px] border border-line bg-bg px-3 py-2 focus-within:border-acc">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about this…"
            aria-label="Ask the tutor"
            className="min-w-0 flex-1 bg-transparent text-[12.5px] text-ink outline-none placeholder:text-dim"
          />
          <button
            type="submit"
            disabled={busy || !input.trim()}
            aria-label="Send"
            className="grid h-[25px] w-[25px] shrink-0 place-items-center rounded-[6px] bg-acc text-[12px] text-acc-ink disabled:opacity-40"
          >
            ↑
          </button>
        </div>
      </form>
    </aside>
  );
}
