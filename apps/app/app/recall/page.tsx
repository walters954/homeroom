import Link from "next/link";
import { db } from "@homeroom/db";
import { EmptyState } from "@/components/empty-state";
import { Page, PageHeader } from "@/components/page-header";
import { answerRecall } from "@/lib/actions/practice";
import {
  accessibleCourseIds,
  plural,
  RECALL_LADDER,
  relativeDays,
} from "@/lib/practice";
import { requireUser } from "@/lib/session";
import { Card, CardContent, CardFooter, CardHeader } from "@homeroom/ui";

export const metadata = { title: "Recall" };
export const dynamic = "force-dynamic";

function options(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String) : [];
}

export default async function RecallPage({
  searchParams,
}: {
  searchParams: Promise<{ answered?: string; choice?: string }>;
}) {
  const user = await requireUser();
  const { answered, choice } = await searchParams;
  const courseIds = await accessibleCourseIds(user);

  if (answered) {
    return <Outcome userId={user.id} questionId={answered} choice={Number(choice)} />;
  }

  const now = new Date();
  const due = await db.recallItem.findMany({
    where: { userId: user.id, dueAt: { lte: now }, skill: { courseId: { in: courseIds } } },
    orderBy: { dueAt: "asc" },
    include: { skill: { include: { recallQuestions: true } } },
  });
  const item = due.find((d) => d.skill.recallQuestions.length > 0);

  if (!item) {
    const next = await db.recallItem.findFirst({
      where: { userId: user.id, skill: { courseId: { in: courseIds } } },
      orderBy: { dueAt: "asc" },
      include: { skill: true },
    });
    return (
      <Page width="narrow">
        <PageHeader
          crumbs={[{ label: "Recall" }]}
          title="Nothing due"
          subtitle="Checks are scheduled, not offered — they appear when the interval says you are about to lose something, and not before."
        />
        <EmptyState
          glyph="↻"
          title={next ? `Next up: ${next.skill.name}` : "Nothing proven yet"}
          body={
            next
              ? `Due ${relativeDays(next.dueAt)} on a ${next.intervalDays}-day interval — streak ${next.streak}, ${next.lastResult === false ? "last one missed" : "last one correct"}. It will surface on Today when it lands.`
              : "There is nothing to keep yet. Pass an exercise without revealing the solution and the first check lands two days later."
          }
          actionLabel="What to do instead"
          actionHref="/today"
        />
      </Page>
    );
  }

  // Rotate through the bank so a repeat interval isn't the same wording twice.
  const questions = item.skill.recallQuestions;
  const question = questions[item.streak % questions.length];
  const opts = options(question.options);
  const overdue = item.dueAt <= now;

  const why =
    item.lastResult === false
      ? `You missed the last check on ${item.skill.name}, so the schedule dropped back to ${plural(item.intervalDays, "day")}. This is that check.`
      : item.streak > 0
        ? `You've got ${plural(item.streak, "check")} right in a row on ${item.skill.name}. The interval stretched to ${item.intervalDays} days — long enough that this is a real test of memory.`
        : `You proved ${item.skill.name} and this is its first spaced check, two days later. Retrieving it now is what makes it stay.`;

  return (
    <Page width="narrow">
      <PageHeader
        crumbs={[{ label: "Recall" }, { label: item.skill.name }]}
        title="One question"
        subtitle={why}
      />

      <div className="mb-3">
        <ScheduleDots current={item.intervalDays} streak={item.streak} />
        <p className="hr-ev">
          {overdue ? `due ${relativeDays(item.dueAt)}` : "due today"} · interval{" "}
          {item.intervalDays}d · streak {item.streak} ·{" "}
          {due.length > 1 ? `${due.length - 1} more waiting` : "last one due"}
        </p>
      </div>

      <Card>
        <CardHeader>
          <span className="font-semibold">{item.skill.name}</span>
          <span className="ml-auto hr-tag hr-tag-shaky">due</span>
        </CardHeader>
        <CardContent>
          <p className="max-w-[66ch] text-[13.5px] leading-relaxed text-ink">
            {question.prompt}
          </p>
        </CardContent>
        <form action={answerRecall.bind(null, question.id)}>
          <ul>
            {opts.map((opt, i) => (
              <li key={i} className="border-b border-soft last:border-b-0">
                <button
                  type="submit"
                  name="choice"
                  value={i}
                  className="flex w-full cursor-pointer items-start gap-3 px-4 py-3 text-left text-[13px] hover:bg-bg"
                >
                  <span className="mt-px shrink-0 font-mono text-[11.5px] text-dim">
                    {String.fromCharCode(65 + i)}
                  </span>
                  <span className="min-w-0 flex-1 text-ink">{opt}</span>
                </button>
              </li>
            ))}
          </ul>
        </form>
        <CardFooter>
          <p className="hr-ev">
            Answering wrong is not a penalty — it re-tightens the schedule so you
            see this again in two days.
          </p>
        </CardFooter>
      </Card>
    </Page>
  );
}

async function Outcome({
  userId,
  questionId,
  choice,
}: {
  userId: string;
  questionId: string;
  choice: number;
}) {
  const question = await db.recallQuestion.findUnique({
    where: { id: questionId },
    include: { skill: true },
  });
  if (!question) {
    return (
      <Page width="narrow">
        <EmptyState
          glyph="↻"
          title="That check no longer exists"
          body="The question was removed after you answered it. Your schedule was still updated."
          actionLabel="Back to recall"
          actionHref="/recall"
        />
      </Page>
    );
  }

  const item = await db.recallItem.findUnique({
    where: { userId_skillId: { userId, skillId: question.skillId } },
  });
  const opts = options(question.options);
  const correct = choice === question.correctIndex;

  return (
    <Page width="narrow">
      <PageHeader
        crumbs={[{ label: "Recall", href: "/recall" }, { label: question.skill.name }]}
        title={correct ? "Right — kept." : "Missed — back to two days."}
        subtitle={
          correct
            ? `The next check on ${question.skill.name} moves out to ${item?.intervalDays ?? 0} days. Nothing to do about it — it will find you.`
            : `${question.skill.name} reads as shaky again, and the schedule tightened to ${item?.intervalDays ?? 2} days.`
        }
      />

      <Card>
        <CardHeader>
          <span className="font-semibold">{question.prompt}</span>
        </CardHeader>
        <ul>
          {opts.map((opt, i) => {
            const isAnswer = i === question.correctIndex;
            const isYours = i === choice;
            return (
              <li key={i} className="hr-row items-start">
                <span
                  aria-hidden
                  className={`mt-0.5 grid h-[15px] w-[15px] shrink-0 place-items-center rounded-[3px] text-[10px] font-bold ${
                    isAnswer
                      ? "bg-acc-soft text-acc"
                      : isYours
                        ? "bg-fail-soft text-fail"
                        : "bg-soft text-dim"
                  }`}
                >
                  {isAnswer ? "✓" : isYours ? "✕" : String.fromCharCode(65 + i)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-ink">{opt}</span>
                  {(isAnswer || isYours) && (
                    <span className="hr-ev block">
                      {isAnswer && isYours
                        ? "your answer · correct"
                        : isAnswer
                          ? "the correct answer"
                          : "your answer"}
                    </span>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
        <CardFooter>
          <Link href="/recall" className="hr-btn hr-btn-primary hr-btn-sm">
            Next check
          </Link>
          <Link href="/today" className="hr-btn hr-btn-sm">
            Back to today
          </Link>
          {item && (
            <span className="hr-ev ml-auto">
              interval {item.intervalDays}d · streak {item.streak} · next{" "}
              {relativeDays(item.dueAt)}
            </span>
          )}
        </CardFooter>
      </Card>
    </Page>
  );
}

/** The 2 → 7 → 30 → 90 → 180 ladder, with where this skill currently sits. */
function ScheduleDots({ current, streak }: { current: number; streak: number }) {
  return (
    <div className="flex items-center gap-1.5">
      {RECALL_LADDER.map((d) => {
        const reached = d <= current;
        const here = d === current;
        return (
          <span
            key={d}
            title={`${d}-day interval${here ? " — you are here" : ""}`}
            className={`rounded-[4px] border px-1.5 py-0.5 font-mono text-[10px] ${
              here
                ? "border-acc bg-acc-soft text-acc"
                : reached
                  ? "border-line bg-soft text-dim"
                  : "border-line bg-bg text-dim"
            }`}
          >
            {d}d
          </span>
        );
      })}
      <span className="hr-ev ml-1">
        {streak > 0 ? `${streak} in a row` : "no streak"}
      </span>
    </div>
  );
}
