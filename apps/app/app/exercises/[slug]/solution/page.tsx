import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { db } from "@homeroom/db";
import type { Metadata } from "next";
import { Markdown } from "@/components/markdown";
import { Page, PageHeader } from "@/components/page-header";
import { parseFiles } from "@/lib/exercises/runner";
import { isAttempt, isGenuinePass, relativeDays } from "@/lib/practice";
import { requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const exercise = await db.exercise.findUnique({ where: { slug } });
  return { title: exercise ? `${exercise.title} — solution` : "Solution" };
}

export default async function SolutionPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const user = await requireUser();
  const exercise = await db.exercise.findUnique({
    where: { slug },
    include: { skill: true },
  });
  if (!exercise) notFound();

  const submissions = await db.submission.findMany({
    where: { userId: user.id, exerciseId: exercise.id },
    orderBy: { createdAt: "asc" },
  });
  const attempts = submissions.filter(isAttempt);
  const pass = attempts.filter((s) => s.passed).at(-1);

  // Worked solutions unlock only after a pass — the whole point of the ladder.
  if (!pass) redirect(`/exercises/${slug}`);

  const proven = attempts.some(isGenuinePass);
  const yours = parseFiles(pass.files);
  const reference = parseFiles(exercise.solutionFiles);

  return (
    <Page>
      <PageHeader
        crumbs={[
          { label: exercise.title, href: `/exercises/${slug}` },
          { label: exercise.skill.name },
        ]}
        title="Yours, beside the reference"
        subtitle={`You passed ${relativeDays(pass.createdAt)}${
          proven ? " without revealing the solution" : " after revealing the solution"
        }, so this is open. Read the difference, not the verdict — both versions pass.`}
      />

      <div className="grid gap-4 md:grid-cols-2">
        <FileColumn
          title="Your version"
          badge={
            proven ? (
              <span className="hr-tag hr-tag-proven">proven</span>
            ) : (
              <span className="hr-tag hr-tag-shaky">solution revealed</span>
            )
          }
          files={yours}
          empty="Your passing run recorded no files."
        />
        <FileColumn
          title="Reference version"
          badge={<span className="hr-path">from the course</span>}
          files={reference}
          empty="No reference solution was written for this exercise."
        />
      </div>

      <section className="hr-card mt-4">
        <div className="hr-card-h">
          <span className="font-semibold">What the difference costs you</span>
        </div>
        <div className="hr-card-b">
          {exercise.differenceNotes ? (
            <Markdown>{exercise.differenceNotes}</Markdown>
          ) : (
            <p className="text-[12.5px] text-dim">
              No difference notes have been written for this exercise yet. The
              creator adds them so a pass that works and a pass that scales are
              not read as the same thing.
            </p>
          )}
        </div>
        <div className="hr-card-f">
          <Link href={`/exercises/${slug}`} className="hr-btn hr-btn-sm">
            Back to the attempt
          </Link>
          <Link href="/today" className="hr-btn hr-btn-sm">
            What&apos;s next
          </Link>
        </div>
      </section>
    </Page>
  );
}

function FileColumn({
  title,
  badge,
  files,
  empty,
}: {
  title: string;
  badge: React.ReactNode;
  files: { path: string; contents: string }[];
  empty: string;
}) {
  return (
    <section className="hr-card">
      <div className="hr-card-h">
        <span className="font-semibold">{title}</span>
        <span className="ml-auto">{badge}</span>
      </div>
      <div className="hr-card-b space-y-3">
        {files.length === 0 ? (
          <p className="text-[12.5px] text-dim">{empty}</p>
        ) : (
          files.map((f) => (
            <div key={f.path}>
              <p className="hr-path mb-1">{f.path}</p>
              <pre className="overflow-x-auto rounded-[7px] border border-line bg-bg p-3 font-mono text-[12.5px] leading-[1.6] text-ink">
                {f.contents}
              </pre>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
