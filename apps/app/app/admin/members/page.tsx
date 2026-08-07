import Link from "next/link";
import { db, type Prisma } from "@homeroom/db";
import { inviteMember } from "@/lib/actions/members";
import { requireAdmin } from "@/lib/session";

export const metadata = { title: "Members" };
export const dynamic = "force-dynamic";

const STATUS_STYLES: Record<string, string> = {
  ACTIVE: "bg-green-100 text-green-800",
  TRIALING: "bg-blue-100 text-blue-800",
  PAST_DUE: "bg-amber-100 text-amber-800",
  CANCELED: "bg-zinc-100 text-zinc-500",
  INCOMPLETE: "bg-zinc-100 text-zinc-500",
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
    <main className="mx-auto max-w-4xl px-6 py-10">
      <p className="mb-2 text-sm text-zinc-500">
        <Link href="/admin" className="hover:underline">
          Admin
        </Link>
      </p>
      <h1 className="mb-6 text-3xl font-bold tracking-tight">
        Members{" "}
        <span className="text-lg font-normal text-zinc-400">
          {members.length}
        </span>
      </h1>

      <div className="mb-6 flex flex-wrap items-end gap-3">
        <form className="flex gap-2">
          <input
            name="q"
            defaultValue={q ?? ""}
            placeholder="Search name or email…"
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
          />
          <button className="rounded-md border border-zinc-300 px-3 py-2 text-sm hover:bg-zinc-100">
            Search
          </button>
        </form>
        <form action={inviteMember} className="ml-auto flex gap-2">
          <input
            name="email"
            type="email"
            required
            placeholder="Invite by email…"
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
          />
          <button className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700">
            Send invite
          </button>
        </form>
      </div>

      <ul className="divide-y divide-zinc-100 rounded-lg border border-zinc-200">
        {members.map((m) => {
          const active = m.subscriptions.find((s) =>
            ["ACTIVE", "TRIALING"].includes(s.status),
          );
          const last = m.lessonProgress[0]?.updatedAt;
          return (
            <Link
              key={m.id}
              href={`/admin/members/${m.id}`}
              className="block hover:bg-zinc-50"
            >
              <li className="flex items-center justify-between gap-4 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {m.name}
                    {m.role === "ADMIN" && (
                      <span className="ml-2 rounded bg-zinc-900 px-1.5 py-0.5 text-xs text-white">
                        admin
                      </span>
                    )}
                    {!m.emailVerified && (
                      <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-800">
                        unverified
                      </span>
                    )}
                  </p>
                  <p className="truncate text-xs text-zinc-500">{m.email}</p>
                </div>
                <div className="flex shrink-0 items-center gap-3 text-xs">
                  <span className="text-zinc-400">
                    {m._count.lessonProgress} done
                    {last && ` · active ${last.toLocaleDateString()}`}
                  </span>
                  {active ? (
                    <span
                      className={`rounded px-2 py-0.5 ${STATUS_STYLES[active.status]}`}
                    >
                      {active.status.toLowerCase()}
                    </span>
                  ) : (
                    <span className="rounded bg-zinc-100 px-2 py-0.5 text-zinc-500">
                      no access
                    </span>
                  )}
                </div>
              </li>
            </Link>
          );
        })}
        {members.length === 0 && (
          <li className="px-4 py-3 text-sm text-zinc-500">
            {q ? "No members match that search." : "No members yet."}
          </li>
        )}
      </ul>
    </main>
  );
}
