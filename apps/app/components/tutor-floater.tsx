"use client";

import { useEffect, useRef, useState } from "react";

interface ChatMessage {
  role: "user" | "assistant";
  text: string;
}

export function TutorFloater({ lessonId }: { lessonId?: string }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const conversationRef = useRef<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, open]);

  async function send() {
    const question = input.trim();
    if (!question || busy) return;
    setInput("");
    setBusy(true);
    setMessages((m) => [
      ...m,
      { role: "user", text: question },
      { role: "assistant", text: "" },
    ]);

    try {
      const res = await fetch("/api/tutor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: question,
          lessonId,
          conversationId: conversationRef.current,
        }),
      });
      if (!res.ok || !res.body) {
        throw new Error(`Tutor request failed (${res.status})`);
      }
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
          text: "Something went wrong — try again.",
        };
        return next;
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed bottom-5 right-5 z-50">
      {open ? (
        <div className="flex h-[480px] w-[360px] flex-col overflow-hidden rounded-xl border border-line bg-panel shadow-xl">
          <div className="flex items-center justify-between border-b border-soft px-4 py-2.5">
            <span className="text-sm font-semibold">Tutor</span>
            <button
              onClick={() => setOpen(false)}
              className="text-dim hover:text-ink"
              aria-label="Close tutor"
            >
              ✕
            </button>
          </div>
          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
            {messages.length === 0 && (
              <p className="text-sm text-dim">
                Ask anything about {lessonId ? "this lesson" : "the course"} —
                answers come from the course material, with citations.
              </p>
            )}
            {messages.map((m, i) => (
              <div
                key={i}
                className={
                  m.role === "user"
                    ? "ml-8 rounded-lg bg-acc px-3 py-2 text-sm text-white"
                    : "mr-4 whitespace-pre-wrap rounded-lg bg-soft px-3 py-2 text-sm text-ink"
                }
              >
                {m.text || (busy && i === messages.length - 1 ? "…" : m.text)}
              </div>
            ))}
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void send();
            }}
            className="flex gap-2 border-t border-soft p-3"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask the tutor…"
              className="flex-1 rounded-md border border-line px-3 py-1.5 text-sm"
            />
            <button
              type="submit"
              disabled={busy || !input.trim()}
              className="rounded-md bg-acc px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40"
            >
              Send
            </button>
          </form>
        </div>
      ) : (
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-2 rounded-full bg-acc px-4 py-3 text-sm font-medium text-white shadow-lg hover:opacity-90"
        >
          💬 Ask the tutor
        </button>
      )}
    </div>
  );
}
