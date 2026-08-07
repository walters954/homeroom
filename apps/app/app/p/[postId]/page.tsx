import { notFound } from "next/navigation";
import { db } from "@homeroom/db";
import type { Metadata } from "next";
import { Markdown } from "@/components/markdown";

export const dynamic = "force-dynamic";

async function getPublicPost(postId: string) {
  const post = await db.post.findUnique({
    where: { id: postId },
    include: { space: true, author: { select: { name: true } } },
  });
  return post?.isPublic ? post : null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ postId: string }>;
}): Promise<Metadata> {
  const { postId } = await params;
  const post = await getPublicPost(postId);
  if (!post) return {};
  const markdown = (post.body as { markdown?: string }).markdown ?? "";
  return {
    title: post.title ?? `${post.author.name} in #${post.space.name}`,
    description: markdown.slice(0, 155),
  };
}

export default async function PublicPostPage({
  params,
}: {
  params: Promise<{ postId: string }>;
}) {
  const { postId } = await params;
  const post = await getPublicPost(postId);
  if (!post) notFound();
  const markdown = (post.body as { markdown?: string }).markdown ?? "";

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <p className="mb-2 text-sm text-dim">
        Shared from #{post.space.name}
      </p>
      {post.title && (
        <h1 className="mb-2 text-2xl font-bold tracking-tight">{post.title}</h1>
      )}
      <p className="mb-6 text-sm text-dim">
        {post.author.name} · {post.createdAt.toLocaleDateString()}
      </p>
      <Markdown>{markdown}</Markdown>
    </main>
  );
}
