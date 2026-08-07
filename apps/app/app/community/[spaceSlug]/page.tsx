import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { db } from "@homeroom/db";
import { createPost } from "@/lib/actions/community";
import { getCurrentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function SpacePage({
  params,
}: {
  params: Promise<{ spaceSlug: string }>;
}) {
  const { spaceSlug } = await params;
  const [user, space] = await Promise.all([
    getCurrentUser(),
    db.space.findUnique({
      where: { slug: spaceSlug },
      include: {
        posts: {
          orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
          take: 50,
          include: {
            author: { select: { name: true } },
            _count: { select: { comments: true } },
          },
        },
      },
    }),
  ]);
  if (!space) notFound();
  if (space.visibility === "MEMBERS" && !user) redirect("/sign-in");

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <p className="mb-2 text-sm text-dim">
        <Link href="/community" className="hover:underline">
          Community
        </Link>
      </p>
      <h1 className="mb-1 text-3xl font-bold tracking-tight">#{space.name}</h1>
      {space.description && (
        <p className="mb-8 text-dim">{space.description}</p>
      )}

      {user && (
        <form
          action={createPost.bind(null, space.id)}
          className="mb-10 flex flex-col gap-2 rounded-lg border border-line p-4"
        >
          <input
            name="title"
            placeholder="Title (optional)"
            className="rounded-md border border-line px-3 py-2 text-sm"
          />
          <textarea
            name="body"
            rows={3}
            required
            placeholder="Share something… (markdown, images via ![](url), links)"
            className="rounded-md border border-line px-3 py-2 text-sm"
          />
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-xs text-dim">
              <input type="checkbox" name="isPublic" />
              Shareable public link
            </label>
            <button className="rounded-md bg-acc px-4 py-1.5 text-sm font-medium text-acc-ink hover:opacity-90">
              Post
            </button>
          </div>
        </form>
      )}

      <ul className="space-y-3">
        {space.posts.map((post) => (
          <Link
            key={post.id}
            href={`/community/${space.slug}/${post.id}`}
            className="block rounded-lg border border-line p-4 hover:border-dim"
          >
            <li>
              <p className="font-medium">
                {post.pinned && "📌 "}
                {post.title ??
                  ((post.body as { markdown?: string }).markdown ?? "").slice(0, 80)}
              </p>
              <p className="mt-1 text-xs text-dim">
                {post.author.name}
                {post.byAgent && " · 🤖 agent"} ·{" "}
                {post.createdAt.toLocaleDateString()} ·{" "}
                {post._count.comments} comments
                {post.isPublic && " · public"}
              </p>
            </li>
          </Link>
        ))}
        {space.posts.length === 0 && (
          <p className="text-sm text-dim">No posts yet — start the conversation.</p>
        )}
      </ul>
    </main>
  );
}
