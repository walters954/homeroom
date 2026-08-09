import { db } from "@homeroom/db";
import {
  approveSuggestion,
  rejectSuggestion,
} from "@/lib/actions/agent";
import { Page, PageHeader } from "@/components/page-header";
import { requireAdmin } from "@/lib/session";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@homeroom/ui";

export const metadata = { title: "Agent suggestions" };
export const dynamic = "force-dynamic";
// Model calls + fan-out can run long; Pro allows well past the default.
export const maxDuration = 300;

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
    <Page width="narrow">
      <PageHeader
        crumbs={[{ label: "Admin", href: "/admin" }, { label: "Agent queue" }]}
        title="Agent suggestions"
        subtitle="The agent drafts; you approve. Nothing the agent isn't certain of ships without your sign-off."
      />

      <section className="space-y-4">
        {pending.map((s) => {
          const payload = s.payload as Record<string, unknown>;
          const evidence = s.evidence as Record<string, unknown>;
          return (
            <div key={s.id} className="hr-card mb-4 p-5">
              <div className="mb-2 flex items-center justify-between">
                <span className="rounded bg-acc-soft px-2 py-0.5 text-xs font-medium text-acc">
                  {TYPE_LABELS[s.type] ?? s.type}
                </span>
                <span className="text-xs text-dim">
                  {s.createdAt.toLocaleString()}
                </span>
              </div>

              {"subject" in payload && (
                <p className="mb-1 text-sm font-semibold">
                  {String(payload.subject)}
                </p>
              )}
              <pre className="mb-3 max-h-64 overflow-y-auto whitespace-pre-wrap rounded bg-bg p-3 text-xs text-ink">
                {String(
                  payload.bodyMarkdown ?? payload.bodyHtml ?? JSON.stringify(payload, null, 2),
                ).slice(0, 3000)}
              </pre>
              <details className="mb-3 text-xs text-dim">
                <summary className="cursor-pointer">Evidence</summary>
                <pre className="mt-1 whitespace-pre-wrap rounded bg-bg p-2">
                  {JSON.stringify(evidence, null, 2)}
                </pre>
              </details>

              <div className="flex gap-2">
                <form action={approveSuggestion.bind(null, s.id)}>
                  <Button size="sm">
                    Approve{s.type === "ANNOUNCEMENT" ? " & send" : s.type === "NUDGE_EMAIL" ? " & send" : " & apply"}
                  </Button>
                </form>
                <form action={rejectSuggestion.bind(null, s.id)}>
                  <Button variant="outline" size="sm">
                    Reject
                  </Button>
                </form>
              </div>
            </div>
          );
        })}
        {pending.length === 0 && (
          <EmptyState
            glyph="✓"
            title="Queue is clear"
            body="The agent has nothing waiting on you. It drafts overnight from lesson transcripts, so the fastest way to fill this is to add a transcript to a lesson that doesn't have one."
            actionLabel="Go to courses"
            actionHref="/admin"
          />
        )}
      </section>

      {resolved.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-dim">
            Recently resolved
          </h2>
          <ul className="space-y-1 text-sm text-dim">
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
    </Page>
  );
}
