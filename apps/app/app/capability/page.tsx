import Link from "next/link";
import { db } from "@homeroom/db";
import { Page, PageHeader } from "@/components/page-header";
import {
  accessibleCourseIds,
  isAttempt,
  plural,
  relativeDays,
  STATUS_LABEL,
  STATUS_TAG,
} from "@/lib/practice";
import { parseTestResults } from "@/lib/exercises/runner";
import { requireUser } from "@/lib/session";
import { EmptyState } from "@/components/empty-state";

export const metadata = { title: "Capability" };
export const dynamic = "force-dynamic";

export default async function CapabilityPage() {
  const user = await requireUser();
  const courseIds = await accessibleCourseIds(user);

  const [skills, states, submissions] = await Promise.all([
    db.skill.findMany({
      where: { courseId: { in: courseIds } },
      orderBy: [{ courseId: "asc" }, { order: "asc" }],
      include: {
        course: { select: { title: true } },
        exercises: { where: { published: true }, orderBy: { order: "asc" } },
      },
    }),
    db.skillState.findMany({ where: { userId: user.id } }),
    db.submission.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "asc" },
      include: { exercise: { include: { skill: true } } },
    }),
  ]);

  const stateBySkill = new Map(states.map((s) => [s.skillId, s]));
  const attempts = submissions.filter(isAttempt);

  // Error patterns: which named test keeps failing, across how many exercises.
  const patterns = new Map<
    string,
    { name: string; skill: string; failures: number; exercises: Set<string>; last: Date }
  >();
  for (const s of attempts) {
    for (const r of parseTestResults(s.testResults)) {
      if (r.passed) continue;
      const key = `${s.exercise.skillId}::${r.name}`;
      const existing = patterns.get(key);
      if (existing) {
        existing.failures += 1;
        existing.exercises.add(s.exercise.title);
        existing.last = s.createdAt;
      } else {
        patterns.set(key, {
          name: r.name,
          skill: s.exercise.skill.name,
          failures: 1,
          exercises: new Set([s.exercise.title]),
          last: s.createdAt,
        });
      }
    }
  }
  const repeated = [...patterns.values()]
    .filter((p) => p.failures > 1)
    .sort((a, b) => b.failures - a.failures);

  const proven = skills.filter(
    (s) => (stateBySkill.get(s.id)?.status ?? "UNTESTED") === "PROVEN",
  ).length;

  return (
    <Page width="narrow">
      <PageHeader
        crumbs={[{ label: "Capability" }]}
        title="What you can actually do"
        subtitle={`Assessed from attempts, not from lessons watched. ${proven} of ${skills.length} skills read as proven right now — every line below shows the evidence it was drawn from.`}
      />

      <section className="hr-card">
        <div className="hr-card-h">
          <span className="font-semibold">Skills</span>
          <span className="ml-auto hr-path">{skills.length}</span>
        </div>
        {skills.length === 0 ? (
          <div className="hr-card-b">
            <EmptyState
              glyph="▤"
              title="Nothing to assess yet"
              body="A skill is what an exercise proves, and none are defined on the courses you can open. This map fills itself in as you pass exercises — it never counts lessons watched."
              actionLabel="Browse courses"
              actionHref="/courses"
            />
          </div>
        ) : (
          <ul>
            {skills.map((skill) => {
              const state = stateBySkill.get(skill.id);
              const status = state?.status ?? "UNTESTED";
              const evidence = [
                state && state.provenCount > 0
                  ? `proven ${state.provenCount}×`
                  : "never proven",
                state && state.attemptCount > 0
                  ? plural(state.attemptCount, "attempt")
                  : "no attempts",
                state?.everUsedHints ? "hints used" : "no hints used",
                state?.lastProvenAt ? relativeDays(state.lastProvenAt) : null,
              ].filter(Boolean);

              return (
                <li key={skill.id} className="hr-row items-start">
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium text-ink">{skill.name}</span>
                    <span className="hr-ev block">{evidence.join(" · ")}</span>
                    {skill.description && (
                      <span className="hr-ev block">{skill.description}</span>
                    )}
                  </span>
                  <span className="shrink-0 text-right">
                    <span className={STATUS_TAG[status]}>
                      {STATUS_LABEL[status]}
                    </span>
                    {skill.exercises[0] && (
                      <Link
                        href={`/exercises/${skill.exercises[0].slug}`}
                        className="hr-ev block underline"
                      >
                        {status === "PROVEN" ? "prove it again" : "attempt it"}
                      </Link>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="hr-card mt-4">
        <div className="hr-card-h">
          <span className="font-semibold">Error patterns</span>
          <span className="ml-auto hr-path">{repeated.length}</span>
        </div>
        {repeated.length === 0 ? (
          <div className="hr-card-b">
            <p className="text-[12.5px] text-dim">
              Nothing has failed twice yet. A pattern only appears here once the
              same named test has failed more than once — a single miss is not a
              pattern, and calling it one would be a guess.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-[12.5px]">
              <thead>
                <tr className="border-b border-line">
                  <th className="px-4 py-2 font-medium text-dim">Failing check</th>
                  <th className="px-4 py-2 font-medium text-dim">Skill</th>
                  <th className="px-4 py-2 text-right font-medium text-dim">
                    Failures
                  </th>
                  <th className="px-4 py-2 font-medium text-dim">Last seen</th>
                </tr>
              </thead>
              <tbody>
                {repeated.map((p) => (
                  <tr key={`${p.skill}-${p.name}`} className="border-b border-soft last:border-b-0">
                    <td className="px-4 py-2">
                      <span className="block font-mono text-[12px] text-ink">
                        {p.name}
                      </span>
                      <span className="hr-ev block">
                        across {plural(p.exercises.size, "exercise")}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-ink">{p.skill}</td>
                    <td className="px-4 py-2 text-right font-mono tabular-nums text-fail">
                      {p.failures}
                    </td>
                    <td className="px-4 py-2 text-dim">{relativeDays(p.last)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="hr-card-f">
          <Link href="/today" className="hr-btn hr-btn-sm">
            Work on the weakest one
          </Link>
        </div>
      </section>
    </Page>
  );
}
