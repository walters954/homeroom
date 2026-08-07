"use server";

import { db, type ReactionTarget } from "@homeroom/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { APP_URL, postToSlack } from "../notify";
import { requireAdmin, requireUser } from "../session";
import { slugify } from "../slug";

export async function createSpace(formData: FormData) {
  await requireAdmin();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;
  await db.space.create({
    data: {
      name,
      slug: slugify(name) || `space-${Date.now()}`,
      description: String(formData.get("description") ?? "").trim() || null,
      visibility:
        formData.get("visibility") === "PUBLIC" ? "PUBLIC" : "MEMBERS",
    },
  });
  revalidatePath("/community");
}

export async function createPost(spaceId: string, formData: FormData) {
  const user = await requireUser();
  const title = String(formData.get("title") ?? "").trim();
  const markdown = String(formData.get("body") ?? "").trim();
  if (!markdown) return;

  const space = await db.space.findUnique({ where: { id: spaceId } });
  if (!space) return;

  const post = await db.post.create({
    data: {
      spaceId,
      authorId: user.id,
      title: title || null,
      body: { markdown },
      isPublic: formData.get("isPublic") === "on",
    },
  });

  await postToSlack(
    `💬 New post in #${space.name}${title ? `: *${title}*` : ""} by ${user.name}\n${APP_URL}/community/${space.slug}/${post.id}`,
  );

  revalidatePath(`/community/${space.slug}`);
  redirect(`/community/${space.slug}/${post.id}`);
}

export async function createComment(
  postId: string,
  path: string,
  formData: FormData,
) {
  const user = await requireUser();
  const markdown = String(formData.get("body") ?? "").trim();
  if (!markdown) return;
  await db.comment.create({
    data: { postId, authorId: user.id, body: { markdown } },
  });
  revalidatePath(path);
}

export async function toggleReaction(
  targetType: ReactionTarget,
  targetId: string,
  emoji: string,
  path: string,
) {
  const user = await requireUser();
  const existing = await db.reaction.findUnique({
    where: {
      targetType_targetId_userId_emoji: {
        targetType,
        targetId,
        userId: user.id,
        emoji,
      },
    },
  });
  if (existing) {
    await db.reaction.delete({ where: { id: existing.id } });
  } else {
    await db.reaction.create({
      data: { targetType, targetId, userId: user.id, emoji },
    });
  }
  revalidatePath(path);
}

export async function deletePost(postId: string, spaceSlug: string) {
  const user = await requireUser();
  const post = await db.post.findUnique({ where: { id: postId } });
  if (!post) return;
  if (post.authorId !== user.id && user.role !== "ADMIN") return;
  await db.post.delete({ where: { id: postId } });
  revalidatePath(`/community/${spaceSlug}`);
  redirect(`/community/${spaceSlug}`);
}
