import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { db } from "@homeroom/db";
import type { Metadata } from "next";
import { ExerciseEditor } from "@/components/exercise-editor";
import { Markdown } from "@/components/markdown";
import { Page, PageHeader } from "@/components/page-header";
import { AgentPane } from "@/components/agent-pane";
import { getCourseAccess } from "@/lib/access";
import {
  markPassedManual,
  revealHint,
  revealSolution,
  submitAttempt,
} from "@/lib/actions/practice";
import { planFor, unsupportedMessage } from "@/lib/exercises/harness";
import {
  parseFiles,
  parseTestResults,
  parseTestSpec,
} from "@/lib/exercises/runner";
import {
  formatTimecode,
  isAttempt,
  isGenuinePass,
  plural,
  relativeDays,
} from "@/lib/practice";
import { requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

// Submitting runs the tests inline: provisioning a sandbox plus a 60s run cap
// outlives the default budget, and the attempt has to finish to be recorded.
export const maxDuration = 300;

async function getExercise(slug: string) {
  return db.exercise.findUnique({
    where: { slug },
    include: {
      skill: { include: { course: true } },
      lesson: { include: { section: true } },
    },
  });
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const exercise = await getExercise(slug);
  return { title: exercise ? exercise.title : "Attempt" };
}

export default async function ExercisePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const user = await requireUser();
  const exercise = await getExercise(slug);
  if (!exercise) notFound();
  if (!exercise.published && user.role !== "ADMIN") notFound();

  const access = await getCourseAccess(user, exercise.skill.courseId);
  if (!access.hasAccess) redirect(`/courses/${exercise.skill.course.slug}`);

  const submissions = await db.submission.findMany({
    where: { userId: user.id, exerciseId: exercise.id },
    orderBy: { createdAt: "asc" },
  });
  const attempts = submissions.filter(isAttempt);
  const latest = submissions[submissions.length - 1] ?? null;
  const lastRun = attempts[attempts.length - 1] ?? null;

  const starter = parseFiles(exercise.starterFiles);
  const working = latest ? parseFiles(latest.files) : [];
  const files = starter.map((f) => ({
    path: f.path,
    contents: working.find((w) => w.path === f.path)?.contents ?? f.contents,
  }));

  const hints = (Array.isArray(exercise.hints) ? exercise.hints : []).map(String);
  const hintsUsed = latest?.hintsUsed ?? 0;
  const solutionRevealed = latest?.solutionRevealed ?? false;
  const everPassed = attempts.some((s) => s.passed);
  const proven = attempts.some(isGenuinePass);

  const spec = parseTestSpec(exercise.testSpec);
  const results = lastRun ? parseTestResults(lastRun.testResults) : [];
  const solutionFiles = solutionRevealed ? parseFiles(exercise.solutionFiles) : [];

  const lessonHref = exercise.lesson
    ? `/courses/${exercise.skill.course.slug}/${exercise.lesson.slug}${
        exercise.lessonTimecode != null ? `?t=${exercise.lessonTimecode}` : ""
      }`
    : null;

  return (
    <>
    <Page width="narrow">
      <PageHeader
        crumbs={[
          { label: "Today", href: "/today" },
          { label: exercise.skill.name },
        ]}
        title={exercise.title}
        subtitle="Video teaches; this proves it. Progress moves when the tests pass — nothing here advances by marking it complete."
      />

      <div className="flex flex-wrap items-center gap-3">
        <AttemptPips
          attempts={attempts.map((a) => ({
            passed: a.passed,
            proven: isGenuinePass(a),
            at: a.createdAt,
          }))}
        />
        {lessonHref && (
          <Link href={lessonHref} className="hr-btn hr-btn-sm">
            ↩ {exercise.lesson?.title}
            {exercise.lessonTimecode != null && (
              <span className="ml-1.5 font-mono text-[11px] text-dim">
                {formatTimecode(exercise.lessonTimecode)}
              </span>
            )}
          </Link>
        )}
        {everPassed && (
          <Link href={`/exercises/${slug}/solution`} className="hr-btn hr-btn-sm">
            Worked solution
          </Link>
        )}
      </div>

      <section className="hr-card mt-5">
        <div className="hr-card-h">
          <span className="font-semibold">What to build</span>
          <span className="ml-auto hr-path">{exercise.language.toLowerCase()}</span>
        </div>
        <div className="hr-card-b">
          <Markdown>{exercise.prompt}</Markdown>
        </div>
      </section>

      <ExerciseEditor
        files={files}
        language={exercise.language}
        hints={hints}
        hintsUsed={hintsUsed}
        solutionRevealed={solutionRevealed}
        everPassed={everPassed}
        runAction={submitAttempt.bind(null, slug)}
        hintAction={revealHint.bind(null, slug)}
        solutionAction={revealSolution.bind(null, slug)}
        manualPassAction={
          user.role === "ADMIN" ? markPassedManual.bind(null, slug) : null
        }
      />

      <section className="hr-card mt-4">
        <div className="hr-card-h">
          <span className="font-semibold">Tests</span>
          <span className="ml-auto hr-path">
            {lastRun
              ? `last run ${relativeDays(lastRun.createdAt)}`
              : `${plural(spec.length, "test")} specified`}
          </span>
        </div>
        {results.length > 0 ? (
          <ul>
            {results.map((r) => (
              <li key={r.name} className="hr-row items-start">
                <span
                  aria-hidden
                  className={`mt-0.5 grid h-[15px] w-[15px] shrink-0 place-items-center rounded-[3px] text-[10px] font-bold ${
                    r.passed
                      ? "bg-acc-soft text-acc"
                      : "bg-fail-soft text-fail"
                  }`}
                >
                  {r.passed ? "✓" : "✕"}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-mono text-[12px]">{r.name}</span>
                  <span className="hr-ev block">
                    <span className="sr-only">
                      {r.passed ? "passed: " : "failed: "}
                    </span>
                    {r.message}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <ul>
            {spec.map((t) => (
              <li key={t.name} className="hr-row items-start">
                <span
                  aria-hidden
                  className="mt-0.5 grid h-[15px] w-[15px] shrink-0 place-items-center rounded-[3px] bg-soft text-[10px] font-bold text-dim"
                >
                  ·
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-mono text-[12px]">{t.name}</span>
                  {t.description && (
                    <span className="hr-ev block">{t.description}</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
        <div className="hr-card-f">
          <p className="hr-ev">
            {planFor(exercise.language)
              ? "Your files run against these tests in an isolated sandbox with no network access. A failing run is a failing run, and nothing here fakes a pass."
              : `${unsupportedMessage(exercise.language)} Attempts are still recorded, and nothing here fakes a pass.`}
          </p>
        </div>
      </section>

      {solutionRevealed && solutionFiles.length > 0 && (
        <section className="hr-card mt-4">
          <div className="hr-card-h">
            <span className="font-semibold">Reference solution</span>
            <span className="ml-auto hr-tag hr-tag-fail">not proven</span>
          </div>
          <div className="hr-card-b space-y-3">
            <p className="text-[12.5px] text-dim">
              You opened this, so this skill will not read as proven from this
              exercise. Passing it still records the attempt.
            </p>
            {solutionFiles.map((f) => (
              <div key={f.path}>
                <p className="hr-path mb-1">{f.path}</p>
                <pre className="overflow-x-auto rounded-[7px] border border-line bg-bg p-3 font-mono text-[12.5px] leading-[1.6] text-ink">
                  {f.contents}
                </pre>
              </div>
            ))}
          </div>
        </section>
      )}

      {proven && (
        <p className="mt-4 text-[12.5px] text-acc">
          Proven — no hints, no solution revealed.
        </p>
      )}

    </Page>
      <AgentPane
        scope="this exercise"
        lessonId={exercise.lessonId ?? undefined}
        intro="Ask about the concept behind this exercise. The tutor answers from the lesson it came from and won't hand you the solution — that's what the hints are for."
        suggestions={[
          "What is this exercise actually testing?",
          "Explain the concept again, briefly",
          "Why would my approach fail in production?",
        ]}
      />
    </>
  );
}

/** One pip per run: what happened, in order. */
function AttemptPips({
  attempts,
}: {
  attempts: { passed: boolean; proven: boolean; at: Date }[];
}) {
  if (attempts.length === 0) {
    return <span className="hr-ev">No attempts yet.</span>;
  }
  return (
    <span className="flex items-center gap-1.5">
      <span className="flex gap-1">
        {attempts.map((a, i) => (
          <span
            key={i}
            title={`Attempt ${i + 1} — ${a.passed ? (a.proven ? "passed" : "passed, solution revealed") : "failed"} ${relativeDays(a.at)}`}
            className={`h-[9px] w-[9px] rounded-[2px] ${
              a.passed
                ? a.proven
                  ? "bg-acc"
                  : "bg-warn"
                : "bg-fail"
            }`}
          />
        ))}
      </span>
      <span className="hr-ev">
        {plural(attempts.length, "attempt")} ·{" "}
        {attempts.filter((a) => a.passed).length} passed
      </span>
    </span>
  );
}
