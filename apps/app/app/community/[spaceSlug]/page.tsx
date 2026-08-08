import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { db } from "@homeroom/db";
import { createPost } from "@/lib/actions/community";
import { getCurrentUser } from "@/lib/session";
import { Page, PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";

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
    <Page width="narrow">
      <PageHeader
        crumbs={[
          { label: "Community", href: "/community" },
          { label: `#${space.name}` },
        ]}
        title={`#${space.name}`}
        subtitle={space.description ?? undefined}
      />

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
          <EmptyState
            glyph="◇"
            title="Nothing posted in here yet"
            body={
              user
                ? "Somebody has to go first. A question you had this week works better than an introduction — it gives people something to answer."
                : "This space is quiet so far. Check back, or ask in a space you can post to."
            }
          />
        )}
      </ul>
    </Page>
  );
}
