import Link from "next/link";
import { db } from "@homeroom/db";
import { createSpace } from "@/lib/actions/community";
import { EmptyState } from "@/components/empty-state";
import { getCurrentUser } from "@/lib/session";
import { Page } from "@/components/page-header";

export const metadata = { title: "Community" };
export const dynamic = "force-dynamic";

export default async function CommunityPage() {
  const user = await getCurrentUser();
  const spaces = await db.space.findMany({
    orderBy: { order: "asc" },
    where: user ? {} : { visibility: "PUBLIC" },
    include: { _count: { select: { posts: true } } },
  });

  return (
    <Page width="narrow">
      <h1 className="mb-8 text-3xl font-bold tracking-tight">Community</h1>
      <ul className="divide-y divide-line rounded-lg border border-line">
        {spaces.map((space) => (
          <Link
            key={space.id}
            href={`/community/${space.slug}`}
            className="block hover:bg-bg"
          >
            <li className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="font-medium">#{space.name}</p>
                {space.description && (
                  <p className="text-sm text-dim">{space.description}</p>
                )}
              </div>
              <span className="text-sm text-dim">
                {space._count.posts} posts
              </span>
            </li>
          </Link>
        ))}

      </ul>

      {spaces.length === 0 && (
        <EmptyState
          glyph="◇"
          title="No spaces yet"
          body={
            user?.role === "ADMIN"
              ? "Spaces are where members compare notes. One general space is usually enough to start — you can split it later once traffic tells you how."
              : "The community hasn't opened yet. Check back soon."
          }
        />
      )}

      {user?.role === "ADMIN" && (
        <section className="mt-10 rounded-lg border border-line p-5">
          <h2 className="mb-3 text-lg font-semibold">New space</h2>
          <form action={createSpace} className="flex flex-col gap-3 text-sm">
            <input
              name="name"
              placeholder="Space name"
              required
              className="rounded-md border border-line px-3 py-2"
            />
            <input
              name="description"
              placeholder="Description (optional)"
              className="rounded-md border border-line px-3 py-2"
            />
            <label className="flex items-center gap-2 font-medium">
              <input type="radio" name="visibility" value="MEMBERS" defaultChecked />
              Members only
              <input type="radio" name="visibility" value="PUBLIC" className="ml-4" />
              Public
            </label>
            <button className="self-start rounded-md bg-acc px-4 py-2 font-medium text-acc-ink hover:opacity-90">
              Create space
            </button>
          </form>
        </section>
      )}
    </Page>
  );
}
