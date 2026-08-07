import Link from "next/link";
import { db } from "@homeroom/db";
import { createSpace } from "@/lib/actions/community";
import { getCurrentUser } from "@/lib/session";

export const metadata = { title: "Community — Homeroom" };
export const dynamic = "force-dynamic";

export default async function CommunityPage() {
  const user = await getCurrentUser();
  const spaces = await db.space.findMany({
    orderBy: { order: "asc" },
    where: user ? {} : { visibility: "PUBLIC" },
    include: { _count: { select: { posts: true } } },
  });

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="mb-8 text-3xl font-bold tracking-tight">Community</h1>
      <ul className="divide-y divide-zinc-100 rounded-lg border border-zinc-200">
        {spaces.map((space) => (
          <Link
            key={space.id}
            href={`/community/${space.slug}`}
            className="block hover:bg-zinc-50"
          >
            <li className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="font-medium">#{space.name}</p>
                {space.description && (
                  <p className="text-sm text-zinc-500">{space.description}</p>
                )}
              </div>
              <span className="text-sm text-zinc-400">
                {space._count.posts} posts
              </span>
            </li>
          </Link>
        ))}
        {spaces.length === 0 && (
          <li className="px-4 py-3 text-sm text-zinc-500">No spaces yet.</li>
        )}
      </ul>

      {user?.role === "ADMIN" && (
        <section className="mt-10 rounded-lg border border-zinc-200 p-5">
          <h2 className="mb-3 text-lg font-semibold">New space</h2>
          <form action={createSpace} className="flex flex-col gap-3 text-sm">
            <input
              name="name"
              placeholder="Space name"
              required
              className="rounded-md border border-zinc-300 px-3 py-2"
            />
            <input
              name="description"
              placeholder="Description (optional)"
              className="rounded-md border border-zinc-300 px-3 py-2"
            />
            <label className="flex items-center gap-2 font-medium">
              <input type="radio" name="visibility" value="MEMBERS" defaultChecked />
              Members only
              <input type="radio" name="visibility" value="PUBLIC" className="ml-4" />
              Public
            </label>
            <button className="self-start rounded-md bg-zinc-900 px-4 py-2 font-medium text-white hover:bg-zinc-700">
              Create space
            </button>
          </form>
        </section>
      )}
    </main>
  );
}
