/**
 * What the agent pane is looking at.
 *
 * The pane lives in the shell and never unmounts, so it can't infer its subject
 * from the page it happens to be rendered inside — pages declare it instead,
 * with `<AgentScope>`. Everything the pane says about itself is derived from
 * `kind`, so the copy stays consistent instead of being retyped per page.
 */
export type AgentScope =
  | { kind: "lesson"; lessonId: string }
  | { kind: "exercise"; exerciseId: string }
  | { kind: "progress" }
  | { kind: "thread"; postId: string };

export type AgentScopeKind = AgentScope["kind"];

/**
 * Stable identity for a scope. Keys the client's per-scope threads and the
 * `TutorConversation` row, so returning to a lesson returns to its conversation
 * rather than starting a fresh one.
 */
export function scopeKey(scope: AgentScope): string {
  switch (scope.kind) {
    case "lesson":
      return `lesson:${scope.lessonId}`;
    case "exercise":
      return `exercise:${scope.exerciseId}`;
    case "thread":
      return `thread:${scope.postId}`;
    case "progress":
      return "progress";
  }
}

export interface ScopePresentation {
  /** Shown beside the pane title: "this lesson", "your progress", … */
  label: string;
  /** One sentence on what the agent can see here, and what it won't do. */
  intro: string;
  /** Offered before the first message — the pane's arrival state. */
  suggestions: string[];
}

/**
 * Per-kind copy. The exercise and thread intros say plainly what the tutor
 * will refuse before it refuses: a guardrail a learner discovers by hitting it
 * reads as the tool being broken.
 */
const PRESENTATION: Record<AgentScopeKind, ScopePresentation> = {
  lesson: {
    label: "this lesson",
    intro:
      "The tutor has read this lesson's transcript and can point you at the exact moment something is explained.",
    suggestions: [
      "Summarise the key point of this lesson",
      "I didn't follow the part about the trade-offs",
      "What should I be able to do after this?",
    ],
  },
  exercise: {
    label: "this exercise",
    intro:
      "The tutor can see the exercise and how your attempts went, but not the tests or the solution — so it will explain the idea and won't hand you the answer.",
    suggestions: [
      "What is this exercise actually testing?",
      "Explain the concept again, briefly",
      "Why would my approach fail in production?",
    ],
  },
  progress: {
    label: "your progress",
    intro:
      "The tutor can see what you've proven, what's gone shaky, and where your attempts keep failing.",
    suggestions: [
      "What should I work on next?",
      "Which mistake do I keep repeating?",
      "What have I actually proven so far?",
    ],
  },
  thread: {
    label: "this thread",
    intro:
      "The tutor has read this thread and the course material it touches, and answers from the school's own lessons.",
    suggestions: [
      "Summarise where this thread got to",
      "Which lesson covers this?",
      "Is there an exercise that would prove I understand this?",
    ],
  },
};

export function presentationFor(scope: AgentScope): ScopePresentation {
  return PRESENTATION[scope.kind];
}

/** Narrow an untrusted request body to a scope. */
export function parseScope(value: unknown): AgentScope | null {
  if (!value || typeof value !== "object") return null;
  const scope = value as Record<string, unknown>;
  switch (scope.kind) {
    case "lesson":
      return typeof scope.lessonId === "string"
        ? { kind: "lesson", lessonId: scope.lessonId }
        : null;
    case "exercise":
      return typeof scope.exerciseId === "string"
        ? { kind: "exercise", exerciseId: scope.exerciseId }
        : null;
    case "thread":
      return typeof scope.postId === "string"
        ? { kind: "thread", postId: scope.postId }
        : null;
    case "progress":
      return { kind: "progress" };
    default:
      return null;
  }
}
