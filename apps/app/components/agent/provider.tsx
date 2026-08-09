"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { usePathname } from "next/navigation";
import { Button, Sheet, SheetContent, SheetTitle } from "@homeroom/ui";
import { MessagesSquare } from "lucide-react";
import {
  presentationFor,
  scopeKey,
  type AgentScope as Scope,
} from "@/lib/agent/scope";
import { AgentDock, AgentPaneBody, type AgentMessage } from "./pane";

interface Thread {
  messages: AgentMessage[];
  busy: boolean;
  conversationId: string | null;
}

const EMPTY_THREAD: Thread = { messages: [], busy: false, conversationId: null };

interface AgentContextValue {
  register: (scope: Scope, path: string) => void;
  /** False where the pane has no business existing — signed out, or admin. */
  visible: boolean;
  openSheet: () => void;
  /** Everything `<AgentPaneSlot>` needs to draw the current conversation. */
  pane: {
    presentation: ReturnType<typeof presentationFor>;
    messages: AgentMessage[];
    busy: boolean;
    ask: (question: string) => void;
    expanded: boolean;
    setExpanded: (expanded: boolean) => void;
    sheetOpen: boolean;
    setSheetOpen: (open: boolean) => void;
  };
}

const AgentContext = createContext<AgentContextValue | null>(null);

function useAgent(): AgentContextValue {
  const value = useContext(AgentContext);
  if (!value) {
    throw new Error("Agent components must be rendered inside <AgentProvider>");
  }
  return value;
}

const EXPANDED_KEY = "hr-agent-expanded";

/**
 * Creator screens are for reviewing the agent's work, not talking to it
 * (docs/DESIGN.md §4). Hiding the whole of /admin also keeps the queue clean,
 * which is the case the design calls out by name.
 */
function paneAllowed(pathname: string): boolean {
  return !pathname.startsWith("/admin");
}

/**
 * Owns the tutor pane for the whole app.
 *
 * The pane is mounted once, in the shell, so a conversation survives moving
 * between pages — a pane that forgot the thread every time you opened the next
 * lesson would be worse than the floater it replaces. Pages declare what it is
 * looking at with `<AgentScope>`; everything else lives here.
 */
export function AgentProvider({
  signedIn,
  children,
}: {
  signedIn: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [registration, setRegistration] = useState<{
    scope: Scope;
    path: string;
  } | null>(null);
  const [threads, setThreads] = useState<Record<string, Thread>>({});
  const [expanded, setExpanded] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);

  const threadsRef = useRef<Record<string, Thread>>({});
  const controllers = useRef(new Set<AbortController>());

  useEffect(() => {
    const stored = window.localStorage.getItem(EXPANDED_KEY);
    if (stored !== null) setExpanded(stored === "1");
  }, []);

  // A sheet that survived navigation would cover the page you just asked for.
  useEffect(() => {
    setSheetOpen(false);
  }, [pathname]);

  // Streams outlive a page transition (the pane doesn't unmount), but not the
  // app — without this, closing the tab mid-answer leaks the reader.
  useEffect(() => {
    const inFlight = controllers.current;
    return () => {
      for (const controller of inFlight) controller.abort();
      inFlight.clear();
    };
  }, []);

  const register = useCallback((scope: Scope, path: string) => {
    setRegistration((current) =>
      current &&
      current.path === path &&
      scopeKey(current.scope) === scopeKey(scope)
        ? current
        : { scope, path },
    );
  }, []);

  // Comparing the registered path against the current one is what makes a
  // stale scope impossible: a page that registers nothing can't inherit the
  // previous page's subject, however the two unmounted relative to each other.
  const scope = useMemo<Scope>(
    () =>
      registration && registration.path === pathname
        ? registration.scope
        : { kind: "progress" },
    [registration, pathname],
  );

  const key = scopeKey(scope);
  const thread = threads[key] ?? EMPTY_THREAD;
  const presentation = presentationFor(scope);
  const visible = signedIn && paneAllowed(pathname);

  const write = useCallback((at: string, change: (thread: Thread) => Thread) => {
    const next = {
      ...threadsRef.current,
      [at]: change(threadsRef.current[at] ?? EMPTY_THREAD),
    };
    threadsRef.current = next;
    setThreads(next);
  }, []);

  const ask = useCallback(
    async (question: string) => {
      const text = question.trim();
      const at = scopeKey(scope);
      const current = threadsRef.current[at] ?? EMPTY_THREAD;
      if (!text || current.busy) return;

      write(at, (t) => ({
        ...t,
        busy: true,
        messages: [
          ...t.messages,
          { role: "user", text },
          { role: "assistant", text: "" },
        ],
      }));

      const controller = new AbortController();
      controllers.current.add(controller);

      try {
        const res = await fetch("/api/tutor", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: text,
            scope,
            conversationId: current.conversationId,
          }),
          signal: controller.signal,
        });
        if (!res.ok || !res.body) throw new Error(String(res.status));

        const conversationId = res.headers.get("X-Conversation-Id");
        if (conversationId) write(at, (t) => ({ ...t, conversationId }));

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          write(at, (t) => {
            const messages = [...t.messages];
            const last = messages[messages.length - 1];
            messages[messages.length - 1] = {
              role: "assistant",
              text: last.text + chunk,
            };
            return { ...t, messages };
          });
        }
      } catch (err) {
        // An abort is the tab closing, not a failure worth reporting.
        if (!(err instanceof DOMException && err.name === "AbortError")) {
          write(at, (t) => {
            const messages = [...t.messages];
            messages[messages.length - 1] = {
              role: "assistant",
              text: "That didn't go through. Try again in a moment.",
            };
            return { ...t, messages };
          });
        }
      } finally {
        controllers.current.delete(controller);
        write(at, (t) => ({ ...t, busy: false }));
      }
    },
    [scope, write],
  );

  const openSheet = useCallback(() => setSheetOpen(true), []);

  const changeExpanded = useCallback((next: boolean) => {
    setExpanded(next);
    window.localStorage.setItem(EXPANDED_KEY, next ? "1" : "0");
  }, []);

  const context = useMemo<AgentContextValue>(
    () => ({
      register,
      visible,
      openSheet,
      pane: {
        presentation,
        messages: thread.messages,
        busy: thread.busy,
        ask,
        expanded,
        setExpanded: changeExpanded,
        sheetOpen,
        setSheetOpen,
      },
    }),
    [
      register,
      visible,
      openSheet,
      presentation,
      thread.messages,
      thread.busy,
      ask,
      expanded,
      changeExpanded,
      sheetOpen,
    ],
  );

  return (
    <AgentContext.Provider value={context}>{children}</AgentContext.Provider>
  );
}

/**
 * Where the pane actually draws. Separate from the provider because the dock is
 * the third column of the shell's flex row, while the provider has to sit above
 * the rail so the mobile trigger can reach it.
 */
export function AgentPaneSlot() {
  const { visible, pane } = useAgent();
  if (!visible) return null;

  return (
    <>
      <AgentDock
        presentation={pane.presentation}
        messages={pane.messages}
        busy={pane.busy}
        expanded={pane.expanded}
        onExpandedChange={pane.setExpanded}
        onAsk={pane.ask}
      />
      <Sheet open={pane.sheetOpen} onOpenChange={pane.setSheetOpen}>
        <SheetContent
          side="right"
          className="w-[340px] gap-0 p-0 lg:hidden"
          aria-describedby={undefined}
        >
          <div className="flex items-center gap-2 border-b border-line px-4 py-3">
            <span aria-hidden className="h-[7px] w-[7px] rounded-full bg-acc" />
            <SheetTitle>Tutor</SheetTitle>
            <span className="ml-auto font-mono text-[10.5px] text-dim">
              {pane.presentation.label}
            </span>
          </div>
          <AgentPaneBody
            presentation={pane.presentation}
            messages={pane.messages}
            busy={pane.busy}
            onAsk={pane.ask}
          />
        </SheetContent>
      </Sheet>
    </>
  );
}

/**
 * Declares what the pane is looking at on this page. Renders nothing — the
 * pane itself lives in the shell.
 */
export function AgentScope({ scope }: { scope: Scope }) {
  const { register } = useAgent();
  const pathname = usePathname();
  const key = scopeKey(scope);
  const latest = useRef(scope);
  latest.current = scope;

  useEffect(() => {
    register(latest.current, pathname);
    // `key` stands in for `scope`: same key, same subject.
  }, [register, key, pathname]);

  return null;
}

/** Opens the pane as a sheet below `lg`, where there's no room to dock it. */
export function AgentSheetTrigger() {
  const { visible, openSheet } = useAgent();
  if (!visible) return null;
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={openSheet}
      aria-label="Open tutor"
      title="Open tutor"
      className="h-[34px] w-[34px] lg:hidden"
    >
      <MessagesSquare className="h-4 w-4" />
    </Button>
  );
}
