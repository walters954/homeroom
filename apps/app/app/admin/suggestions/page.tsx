import Link from "next/link";
import { db } from "@homeroom/db";
import {
  approveSuggestion,
  rejectSuggestion,
} from "@/lib/actions/agent";
import { requireAdmin } from "@/lib/session";

export const metadata = { title: "Agent suggestions — Admin" };
export const dynamic = "force-dynamic";

const TYPE_LABELS: Record<string, string> = {
  LESSON_DRAFT: "Lesson draft",
  ANNOUNCEMENT: "Announcement email",
  COMMUNITY_REPLY: "Community reply",
  NUDGE_EMAIL: "Nudge email",
  SEO_META: "SEO metadata",
  QUIZ: "Quiz",
};

export default async function SuggestionsPage() {
  await requireAdmin();
  const [pending, resolved] = await Promise.all([
    db.agentSuggestion.findMany({
      where: { status: "PENDING" },
      orderBy: { createdAt: "asc" },
    }),
    db.agentSuggestion.findMany({
      where: { status: { not: "PENDING" } },
      orderBy: { resolvedAt: "desc" },
      take: 10,
    }),
  ]);

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <p className="mb-2 text-sm text-zinc-500">
        <Link href="/admin" className="hover:underline">
          Admin
        </Link>
      </p>
      <h1 className="mb-2 text-3xl font-bold tracking-tight">
        Agent suggestions
      </h1>
      <p className="mb-8 text-sm text-zinc-500">
        The agent drafts; you approve. Nothing the agent isn&apos;t certain of
        ships without your sign-off.
      </p>

      <section className="space-y-4">
        {pending.map((s) => {
          const payload = s.payload as Record<string, unknown>;
          const evidence = s.evidence as Record<string, unknown>;
          return (
            <div key={s.id} className="rounded-lg border border-zinc-200 p-5">
              <div className="mb-2 flex items-center justify-between">
                <span className="rounded bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">
                  {TYPE_LABELS[s.type] ?? s.type}
                </span>
                <span className="text-xs text-zinc-400">
                  {s.createdAt.toLocaleString()}
                </span>
              </div>

              {"subject" in payload && (
                <p className="mb-1 text-sm font-semibold">
                  {String(payload.subject)}
                </p>
              )}
              <pre className="mb-3 max-h-64 overflow-y-auto whitespace-pre-wrap rounded bg-zinc-50 p-3 text-xs text-zinc-700">
                {String(
                  payload.bodyMarkdown ?? payload.bodyHtml ?? JSON.stringify(payload, null, 2),
                ).slice(0, 3000)}
              </pre>
              <details className="mb-3 text-xs text-zinc-500">
                <summary className="cursor-pointer">Evidence</summary>
                <pre className="mt-1 whitespace-pre-wrap rounded bg-zinc-50 p-2">
                  {JSON.stringify(evidence, null, 2)}
                </pre>
              </details>

              <div className="flex gap-2">
                <form action={approveSuggestion.bind(null, s.id)}>
                  <button className="rounded-md bg-zinc-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-zinc-700">
                    Approve{s.type === "ANNOUNCEMENT" ? " & send" : s.type === "NUDGE_EMAIL" ? " & send" : " & apply"}
                  </button>
                </form>
                <form action={rejectSuggestion.bind(null, s.id)}>
                  <button className="rounded-md border border-zinc-300 px-4 py-1.5 text-sm hover:bg-zinc-100">
                    Reject
                  </button>
                </form>
              </div>
            </div>
          );
        })}
        {pending.length === 0 && (
          <p className="text-sm text-zinc-500">
            Queue is clear — the agent has nothing waiting for you.
          </p>
        )}
      </section>

      {resolved.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-400">
            Recently resolved
          </h2>
          <ul className="space-y-1 text-sm text-zinc-500">
            {resolved.map((s) => (
              <li key={s.id}>
                {s.status === "APPROVED" ? "✅" : "❌"}{" "}
                {TYPE_LABELS[s.type] ?? s.type} ·{" "}
                {s.resolvedAt?.toLocaleString()}
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
