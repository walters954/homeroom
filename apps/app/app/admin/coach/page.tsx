import Link from "next/link";
import { db } from "@homeroom/db";
import { Page, PageHeader } from "@/components/page-header";
import { isAttempt, plural, relativeDays } from "@/lib/practice";
import { requireAdmin } from "@/lib/session";

export const metadata = { title: "Coach" };
export const dynamic = "force-dynamic";

/**
 * Coach reads the attempt record so the creator doesn't have to ask anyone how
 * it's going. The distinction it exists to make: an exercise nobody passes
 * first time is either unclear or productively hard, and pass rate tells them
 * apart. (docs/DESIGN.md §1b — Events / Coach rows.)
 */

type Signal = {
  label: string;
  tag: string;
  note: string;
};

function signalFor(firstAttemptRate: number | null): Signal {
  if (firstAttemptRate === null) {
    return {
      label: "no signal",
      tag: "hr-tag hr-tag-untested",
      note: "Nobody has attempted it yet.",
    };
  }
  if (firstAttemptRate < 0.3) {
    return {
      label: "concept unclear",
      tag: "hr-tag hr-tag-fail",
      note: "Fewer than 3 in 10 pass first time — that reads as a gap in the teaching, not difficulty.",
    };
  }
  if (firstAttemptRate <= 0.7) {
    return {
      label: "productive struggle",
      tag: "hr-tag hr-tag-proven",
      note: "Where you want it. Hard enough to be worth passing.",
    };
  }
  if (firstAttemptRate <= 0.9) {
    return {
      label: "calibrated",
      tag: "hr-tag hr-tag-untested",
      note: "Comfortably passable. Fine as a confidence step.",
    };
  }
  return {
    label: "too easy",
    tag: "hr-tag hr-tag-shaky",
    note: "Almost everyone passes cold, so passing it proves little.",
  };
}

export default async function CoachPage() {
  await requireAdmin();

  const [exercises, submissions, conversations] = await Promise.all([
    db.exercise.findMany({
      orderBy: [{ skillId: "asc" }, { order: "asc" }],
      include: { skill: true },
    }),
    db.submission.findMany({
      orderBy: { createdAt: "asc" },
      include: { user: { select: { id: true, name: true, email: true } } },
    }),
    db.tutorConversation.groupBy({ by: ["userId"], _count: { _all: true } }),
  ]);

  const attempts = submissions.filter(isAttempt);
  const talkedToTutor = new Set(conversations.map((c) => c.userId));

  const rows = exercises.map((exercise) => {
    const mine = attempts.filter((s) => s.exerciseId === exercise.id);
    const byUser = new Map<string, typeof mine>();
    for (const s of mine) {
      byUser.set(s.userId, [...(byUser.get(s.userId) ?? []), s]);
    }
    const learners = [...byUser.values()];
    const firstAttemptPasses = learners.filter((l) => l[0]?.passed).length;
    const firstAttemptRate =
      learners.length > 0 ? firstAttemptPasses / learners.length : null;
    const avgAttempts =
      learners.length > 0
        ? mine.length / learners.length
        : 0;
    const everPassed = learners.filter((l) => l.some((s) => s.passed)).length;

    return {
      exercise,
      learners: learners.length,
      firstAttemptRate,
      avgAttempts,
      everPassed,
      signal: signalFor(firstAttemptRate),
    };
  });

  // Struggling quietly: repeated failure on one exercise, never asked the tutor.
  const quiet: {
    userId: string;
    name: string;
    email: string;
    exercise: string;
    fails: number;
    last: Date;
  }[] = [];
  for (const exercise of exercises) {
    const mine = attempts.filter((s) => s.exerciseId === exercise.id);
    const byUser = new Map<string, typeof mine>();
    for (const s of mine) {
      byUser.set(s.userId, [...(byUser.get(s.userId) ?? []), s]);
    }
    for (const [userId, list] of byUser) {
      const fails = list.filter((s) => !s.passed);
      if (fails.length < 3) continue;
      if (list.some((s) => s.passed)) continue;
      if (talkedToTutor.has(userId)) continue;
      const who = list[0].user;
      quiet.push({
        userId,
        name: who.name,
        email: who.email,
        exercise: exercise.title,
        fails: fails.length,
        last: fails[fails.length - 1].createdAt,
      });
    }
  }
  quiet.sort((a, b) => b.fails - a.fails);

  const worst = rows
    .filter((r) => r.firstAttemptRate !== null)
    .sort((a, b) => (a.firstAttemptRate ?? 1) - (b.firstAttemptRate ?? 1))[0];

  return (
    <Page>
      <PageHeader
        crumbs={[{ label: "Admin", href: "/admin" }, { label: "Coach" }]}
        title={worst ? worst.exercise.title : "Nothing has been attempted yet"}
        subtitle={
          worst
            ? `Lowest first-attempt pass rate of ${rows.filter((r) => r.firstAttemptRate !== null).length} exercises with attempts. ${worst.signal.note}`
            : "Publish an exercise and the attempt record starts here — pass rates, clustered failures, and who is stuck without saying so."
        }
      />

      {worst && (
        <div className="hr-cite">
          <p className="text-dim">
            {Math.round((worst.firstAttemptRate ?? 0) * 100)}% first-attempt pass
            · {worst.avgAttempts.toFixed(1)} attempts on average ·{" "}
            {plural(worst.learners, "learner")} · {worst.everPassed} eventually
            passed
          </p>
        </div>
      )}

      <section className="hr-card mt-4">
        <div className="hr-card-h">
          <span className="font-semibold">Exercises</span>
          <span className="ml-auto hr-path">{exercises.length}</span>
        </div>
        {exercises.length === 0 ? (
          <div className="hr-card-b">
            <p className="text-[12.5px] text-dim">
              No exercises exist yet. Every concept video should be paired with
              one — that pairing is what turns watching into proving.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-[12.5px]">
              <thead>
                <tr className="border-b border-line">
                  <th className="px-4 py-2 font-medium text-dim">Exercise</th>
                  <th className="px-4 py-2 text-right font-medium text-dim">
                    1st-attempt
                  </th>
                  <th className="px-4 py-2 text-right font-medium text-dim">
                    Avg attempts
                  </th>
                  <th className="px-4 py-2 font-medium text-dim">Signal</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr
                    key={r.exercise.id}
                    className="border-b border-soft last:border-b-0"
                  >
                    <td className="px-4 py-2">
                      <Link
                        href={`/exercises/${r.exercise.slug}`}
                        className="block text-ink hover:underline"
                      >
                        {r.exercise.title}
                      </Link>
                      <span className="hr-ev block">
                        {r.exercise.skill.name} ·{" "}
                        {r.exercise.published ? "published" : "draft"} ·{" "}
                        {plural(r.learners, "learner")}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right font-mono tabular-nums text-ink">
                      {r.firstAttemptRate === null
                        ? "—"
                        : `${Math.round(r.firstAttemptRate * 100)}%`}
                    </td>
                    <td className="px-4 py-2 text-right font-mono tabular-nums text-ink">
                      {r.learners === 0 ? "—" : r.avgAttempts.toFixed(1)}
                    </td>
                    <td className="px-4 py-2">
                      <span className={r.signal.tag}>{r.signal.label}</span>
                      <span className="hr-ev block max-w-[34ch]">
                        {r.signal.note}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="hr-card mt-4">
        <div className="hr-card-h">
          <span className="font-semibold">Struggling quietly</span>
          <span className="ml-auto hr-tag hr-tag-fail">{quiet.length}</span>
        </div>
        <div className="hr-card-b">
          <p className="text-[12.5px] text-dim">
            Three or more failed attempts on one exercise, never passed, and no
            tutor conversation on record. These are the people who drop without
            ever asking.
          </p>
        </div>
        {quiet.length === 0 ? (
          <div className="hr-card-b border-t border-soft">
            <p className="text-[12.5px] text-dim">
              Nobody matches. Either everyone stuck is asking, or nobody has
              failed an exercise three times yet.
            </p>
          </div>
        ) : (
          <ul>
            {quiet.map((q) => (
              <li key={`${q.userId}-${q.exercise}`} className="hr-row items-start">
                <span className="min-w-0 flex-1">
                  <Link
                    href={`/admin/members/${q.userId}`}
                    className="block font-medium text-ink hover:underline"
                  >
                    {q.name}
                  </Link>
                  <span className="hr-ev block">
                    {q.email} · {plural(q.fails, "failed attempt")} on{" "}
                    {q.exercise} · last {relativeDays(q.last)}
                  </span>
                </span>
                <span className="hr-tag hr-tag-fail shrink-0">no tutor use</span>
              </li>
            ))}
          </ul>
        )}
        <div className="hr-card-f">
          <Link href="/admin/suggestions" className="hr-btn hr-btn-sm">
            Agent queue
          </Link>
          <span className="hr-ev">
            Nothing here is sent to anyone. Reaching out is your call.
          </span>
        </div>
      </section>
    </Page>
  );
}
