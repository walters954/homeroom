import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { db } from "@homeroom/db";
import { Markdown } from "@/components/markdown";
import {
  createComment,
  deletePost,
  toggleReaction,
} from "@/lib/actions/community";
import { getCurrentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

const EMOJIS = ["👍", "❤️", "🎉", "💡"];

export default async function PostPage({
  params,
}: {
  params: Promise<{ spaceSlug: string; postId: string }>;
}) {
  const { spaceSlug, postId } = await params;
  const [user, post] = await Promise.all([
    getCurrentUser(),
    db.post.findUnique({
      where: { id: postId },
      include: {
        space: true,
        author: { select: { id: true, name: true } },
        comments: {
          orderBy: { createdAt: "asc" },
          include: { author: { select: { name: true } } },
        },
      },
    }),
  ]);
  if (!post || post.space.slug !== spaceSlug) notFound();
  if (post.space.visibility === "MEMBERS" && !user) redirect("/sign-in");

  const reactions = await db.reaction.findMany({
    where: { targetType: "POST", targetId: post.id },
  });
  const path = `/community/${spaceSlug}/${postId}`;
  const markdown = (post.body as { markdown?: string }).markdown ?? "";

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <p className="mb-2 text-sm text-dim">
        <Link href="/community" className="hover:underline">
          Community
        </Link>{" "}
        ·{" "}
        <Link href={`/community/${spaceSlug}`} className="hover:underline">
          #{post.space.name}
        </Link>
        {post.isPublic && (
          <>
            {" · "}
            <Link href={`/p/${post.id}`} className="underline">
              public link
            </Link>
          </>
        )}
      </p>
      {post.title && (
        <h1 className="mb-2 text-2xl font-bold tracking-tight">{post.title}</h1>
      )}
      <p className="mb-6 text-sm text-dim">
        {post.author.name}
        {post.byAgent && " · 🤖 agent"} · {post.createdAt.toLocaleString()}
      </p>
      <Markdown>{markdown}</Markdown>

      <div className="mt-6 flex items-center gap-2">
        {EMOJIS.map((emoji) => {
          const count = reactions.filter((r) => r.emoji === emoji).length;
          const mine = reactions.some(
            (r) => r.emoji === emoji && r.userId === user?.id,
          );
          return (
            <form
              key={emoji}
              action={toggleReaction.bind(null, "POST", post.id, emoji, path)}
            >
              <button
                disabled={!user}
                className={`rounded-full border px-2.5 py-1 text-sm ${
                  mine
                    ? "border-acc bg-acc text-acc-ink"
                    : "border-line hover:bg-soft"
                }`}
              >
                {emoji}
                {count > 0 && ` ${count}`}
              </button>
            </form>
          );
        })}
        {(user?.id === post.author.id || user?.role === "ADMIN") && (
          <form action={deletePost.bind(null, post.id, spaceSlug)} className="ml-auto">
            <button className="text-xs text-fail hover:underline">delete</button>
          </form>
        )}
      </div>

      <section className="mt-10 border-t border-line pt-6">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-dim">
          Comments
        </h2>
        <ul className="space-y-4">
          {post.comments.map((comment) => (
            <li key={comment.id} className="rounded-lg bg-bg p-3">
              <p className="mb-1 text-xs text-dim">
                {comment.author.name}
                {comment.byAgent && " · 🤖 agent"} ·{" "}
                {comment.createdAt.toLocaleString()}
              </p>
              <Markdown>
                {(comment.body as { markdown?: string }).markdown ?? ""}
              </Markdown>
            </li>
          ))}
        </ul>
        {user && (
          <form
            action={createComment.bind(null, post.id, path)}
            className="mt-4 flex flex-col gap-2"
          >
            <textarea
              name="body"
              rows={2}
              required
              placeholder="Add a comment…"
              className="rounded-md border border-line px-3 py-2 text-sm"
            />
            <button className="self-start rounded-md bg-acc px-4 py-1.5 text-sm font-medium text-acc-ink hover:opacity-90">
              Comment
            </button>
          </form>
        )}
      </section>
    </main>
  );
}
