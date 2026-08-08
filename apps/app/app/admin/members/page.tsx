import Link from "next/link";
import { db, type Prisma } from "@homeroom/db";
import { EmptyState } from "@/components/empty-state";
import { Page, PageHeader } from "@/components/page-header";
import { inviteMember } from "@/lib/actions/members";
import { plural, relativeDays } from "@/lib/practice";
import { requireAdmin } from "@/lib/session";

export const metadata = { title: "Members" };
export const dynamic = "force-dynamic";

const STATUS_TAG: Record<string, string> = {
  ACTIVE: "hr-tag-proven",
  TRIALING: "hr-tag-proven",
  PAST_DUE: "hr-tag-shaky",
  CANCELED: "hr-tag-untested",
  INCOMPLETE: "hr-tag-untested",
};

export default async function MembersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await requireAdmin();
  const { q } = await searchParams;
  const where: Prisma.UserWhereInput = q
    ? {
        OR: [
          { email: { contains: q, mode: "insensitive" } },
          { name: { contains: q, mode: "insensitive" } },
        ],
      }
    : {};

  const members = await db.user.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 200,
    include: {
      subscriptions: {
        orderBy: { createdAt: "desc" },
        include: { product: { select: { name: true } } },
      },
      lessonProgress: {
        orderBy: { updatedAt: "desc" },
        take: 1,
        select: { updatedAt: true },
      },
      _count: {
        select: { lessonProgress: { where: { completedAt: { not: null } } } },
      },
    },
  });

  return (
    <Page>
      <PageHeader
        crumbs={[{ label: "Admin", href: "/admin" }, { label: "Members" }]}
        title="Members"
        subtitle={
          q
            ? `Matching "${q}".`
            : "Everyone with an account, newest first. Access comes from a subscription or a comp — open a member to change it."
        }
        actions={
          <form action={inviteMember} className="flex gap-2">
            <input
              name="email"
              type="email"
              required
              placeholder="Invite by email…"
              className="hr-input w-[190px]"
            />
            <button className="hr-btn hr-btn-primary hr-btn-sm shrink-0">
              Invite
            </button>
          </form>
        }
      />

      <form className="mb-4 flex gap-2">
        <input
          name="q"
          defaultValue={q ?? ""}
          placeholder="Search name or email…"
          className="hr-input max-w-xs"
        />
        <button className="hr-btn hr-btn-sm shrink-0">Search</button>
      </form>

      {members.length === 0 ? (
        <EmptyState
          title={q ? "Nobody matches that search" : "No members yet"}
          body={
            q
              ? "Try an email fragment, or clear the search to see everyone."
              : "Invite the first one by email above — they get a magic link, so there is no password for them to invent."
          }
        />
      ) : (
        <section className="hr-card">
          <div className="hr-card-h">
            <span className="font-semibold">
              {q ? "Matches" : "Everyone"}
            </span>
            <span className="ml-auto hr-path">{plural(members.length, "member")}</span>
          </div>
          <ul>
            {members.map((m) => {
              const active = m.subscriptions.find((s) =>
                ["ACTIVE", "TRIALING"].includes(s.status),
              );
              const last = m.lessonProgress[0]?.updatedAt;
              return (
                <li key={m.id} className="hr-row items-start">
                  <span className="min-w-0 flex-1">
                    <Link
                      href={`/admin/members/${m.id}`}
                      className="flex flex-wrap items-center gap-2 font-medium text-ink hover:underline"
                    >
                      {m.name}
                      {m.role === "ADMIN" && (
                        <span className="hr-tag hr-tag-proven">admin</span>
                      )}
                      {!m.emailVerified && (
                        <span className="hr-tag hr-tag-shaky">unverified</span>
                      )}
                    </Link>
                    <span className="hr-ev block truncate">
                      {m.email} · {m._count.lessonProgress} completed
                      {last && ` · active ${relativeDays(last)}`}
                    </span>
                  </span>
                  <span
                    className={`hr-tag shrink-0 ${
                      active ? STATUS_TAG[active.status] : "hr-tag-untested"
                    }`}
                  >
                    {active ? active.status.toLowerCase() : "no access"}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </Page>
  );
}
