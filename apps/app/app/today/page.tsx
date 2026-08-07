import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { Page, PageHeader } from "@/components/page-header";
import {
  dayKey,
  getPracticeSnapshot,
  MS_DAY,
  plural,
  relativeDays,
  STATUS_LABEL,
  STATUS_TAG,
  type NextAction,
} from "@/lib/practice";
import { requireUser } from "@/lib/session";

export const metadata = { title: "Today" };
export const dynamic = "force-dynamic";

export default async function TodayPage({
  searchParams,
}: {
  searchParams: Promise<{ skip?: string }>;
}) {
  const user = await requireUser();
  const { skip } = await searchParams;
  const skipped = (skip ?? "").split(",").filter(Boolean);

  const snapshot = await getPracticeSnapshot(user);
  const available = snapshot.ranked.filter((a) => !skipped.includes(a.key));
  const chosen = available[0] ?? null;
  const alternatives = available.slice(1, 4);

  const proven = snapshot.skills.filter((s) => s.status === "PROVEN").length;
  const shaky = snapshot.skills.filter((s) => s.status === "SHAKY").length;
  const untested = snapshot.skills.filter((s) => s.status === "UNTESTED").length;

  return (
    <Page width="narrow">
      <PageHeader
        crumbs={[{ label: "Today" }]}
        title={chosen ? chosen.title : "Nothing is waiting on you"}
        subtitle={
          chosen
            ? "One thing, picked from what you've proven and what's decaying. The reason is below it — disagree and skip."
            : "No recall is due and every published exercise has an attempt on it."
        }
      />

      {chosen ? (
        <ChosenCard action={chosen} skipped={skipped} hasAlternatives={alternatives.length > 0} />
      ) : (
        <EmptyState
          glyph="●"
          title="Nothing due, nothing unattempted"
          body="The next spaced check will surface here on its own — you don't have to remember to come back. If you want to get ahead, the catalog is still there."
          actionLabel="Browse courses"
          actionHref="/courses"
        >
          <Link href="/capability" className="hr-btn hr-btn-sm">
            See what you can do
          </Link>
        </EmptyState>
      )}

      {/* The seam to disagree: the agent proposes, you dispose. */}
      {chosen && alternatives.length > 0 && (
        <section className="mt-3">
          <p className="hr-eyebrow mb-2">Skip to something else</p>
          <ul className="hr-card overflow-hidden">
            {alternatives.map((alt, i) => (
              <li key={alt.key}>
                {/* Skipping everything ranked above it is what makes this one next. */}
                <Link
                  href={`/today?skip=${[...skipped, ...available.slice(0, i + 1).map((a) => a.key)].join(",")}`}
                  className="hr-row hover:bg-bg"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-ink">
                      {alt.title}
                    </span>
                    <span className="hr-ev block">{alt.evidence[0]}</span>
                  </span>
                  <span className="hr-tag hr-tag-untested shrink-0">
                    {alt.eyebrow}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          {skipped.length > 0 && (
            <p className="mt-2 text-[11.5px] text-dim">
              You skipped {plural(skipped.length, "suggestion")}.{" "}
              <Link href="/today" className="underline">
                Start over
              </Link>
            </p>
          )}
        </section>
      )}

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {/* Due for recall */}
        <section className="hr-card">
          <div className="hr-card-h">
            <span className="font-semibold">Due for recall</span>
            <span className="ml-auto hr-tag hr-tag-shaky">
              {snapshot.dueRecall.length}
            </span>
          </div>
          {snapshot.dueRecall.length === 0 ? (
            <div className="hr-card-b">
              <p className="text-[12.5px] text-dim">
                Nothing due. Checks appear two days after you first prove a
                skill, then further apart each time you get one right.
              </p>
            </div>
          ) : (
            <ul>
              {snapshot.dueRecall.slice(0, 5).map((r) => (
                <li key={r.skillId} className="hr-row">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{r.skillName}</span>
                    <span className="hr-ev block">
                      due {relativeDays(r.dueAt)} · every {r.intervalDays}d ·{" "}
                      {r.lastResult === false
                        ? "last one missed"
                        : `${r.streak} in a row`}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
          <div className="hr-card-f">
            <Link href="/recall" className="hr-btn hr-btn-sm">
              Open recall
            </Link>
          </div>
        </section>

        {/* Capability snapshot */}
        <section className="hr-card">
          <div className="hr-card-h">
            <span className="font-semibold">What you can do</span>
          </div>
          <div className="hr-card-b">
            <div className="flex gap-2">
              <span className="hr-tag hr-tag-proven">{proven} proven</span>
              <span className="hr-tag hr-tag-shaky">{shaky} shaky</span>
              <span className="hr-tag hr-tag-untested">{untested} untested</span>
            </div>
            <p className="hr-ev mt-2">
              Assessed from attempts, not from lessons marked complete.
            </p>
          </div>
          <ul>
            {snapshot.skills.slice(0, 4).map(({ skill, state, status }) => (
              <li key={skill.id} className="hr-row">
                <span className="min-w-0 flex-1 truncate">{skill.name}</span>
                <span className="hr-ev shrink-0">
                  {state && state.attemptCount > 0
                    ? `${plural(state.attemptCount, "attempt")}`
                    : "no attempts"}
                </span>
                <span className={`${STATUS_TAG[status]} shrink-0`}>
                  {STATUS_LABEL[status]}
                </span>
              </li>
            ))}
          </ul>
          <div className="hr-card-f">
            <Link href="/capability" className="hr-btn hr-btn-sm">
              See the evidence
            </Link>
          </div>
        </section>
      </div>

      <PracticeDaysStrip days={snapshot.practiceDays.days} window={7} />
    </Page>
  );
}

function ChosenCard({
  action,
  skipped,
  hasAlternatives,
}: {
  action: NextAction;
  skipped: string[];
  hasAlternatives: boolean;
}) {
  return (
    <section className="hr-card mt-5">
      <div className="hr-card-h">
        <span className="hr-eyebrow">{action.eyebrow}</span>
        <span className="ml-auto hr-path">picked for you</span>
      </div>
      <div className="hr-card-b">
        {/* Rule 2 of the agent-first test: the reason is visible. */}
        <p className="max-w-[66ch] text-[13.5px] leading-relaxed text-ink">
          {action.reason}
        </p>
        <div className="hr-cite mt-3">
          {action.evidence.map((line) => (
            <p key={line} className="text-dim">
              {line}
            </p>
          ))}
        </div>
      </div>
      <div className="hr-card-f">
        <Link href={action.href} className="hr-btn hr-btn-primary hr-btn-sm">
          {action.cta}
        </Link>
        {hasAlternatives && (
          <Link
            href={`/today?skip=${[...skipped, action.key].join(",")}`}
            className="hr-btn hr-btn-sm"
          >
            Not this — show me something else
          </Link>
        )}
      </div>
    </section>
  );
}

/**
 * Days you attempted something, not days you opened the app. No streak bonus,
 * no XP — this is a mirror, not a slot machine (docs/PLAN.md).
 */
function PracticeDaysStrip({ days, window }: { days: string[]; window: number }) {
  const attempted = new Set(days);
  const now = new Date();
  const cells = Array.from({ length: window }, (_, i) => {
    const d = new Date(now.getTime() - (window - 1 - i) * MS_DAY);
    return { key: dayKey(d), label: d.toLocaleDateString(undefined, { weekday: "narrow" }) };
  });

  return (
    <section className="hr-card mt-4">
      <div className="hr-card-b flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-1.5">
          {cells.map((c) => {
            const on = attempted.has(c.key);
            return (
              <span
                key={c.key}
                title={`${c.key}${on ? " — attempted" : " — nothing attempted"}`}
                className={`grid h-6 w-6 place-items-center rounded-[6px] border text-[10px] font-bold ${
                  on
                    ? "border-acc bg-acc-soft text-acc"
                    : "border-line bg-bg text-dim"
                }`}
              >
                {c.label}
              </span>
            );
          })}
        </div>
        <div className="min-w-0">
          <p className="text-[12.5px] text-ink">
            {attempted.size} of the last {window} days
          </p>
          <p className="hr-ev">
            Days you attempted something, not days you opened the app.
          </p>
        </div>
      </div>
    </section>
  );
}
