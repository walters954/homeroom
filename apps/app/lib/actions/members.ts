"use server";

import { auth } from "@homeroom/auth";
import { db } from "@homeroom/db";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { APP_URL } from "../notify";
import { COMP_PREFIX, isComped } from "../comp";
import { requireAdmin } from "../session";

/** Give a member access to a product without payment (migrations, comps). */
export async function grantAccess(userId: string, formData: FormData) {
  await requireAdmin();
  const productId = String(formData.get("productId") ?? "");
  if (!productId) return;

  const existing = await db.subscription.findFirst({
    where: { userId, productId, status: { in: ["ACTIVE", "TRIALING"] } },
  });
  if (existing) return;

  await db.subscription.create({
    data: {
      userId,
      productId,
      stripeCustomerId: `${COMP_PREFIX}${userId}`,
      stripeSubscriptionId: `${COMP_PREFIX}${userId}_${productId}`,
      status: "ACTIVE",
    },
  });
  revalidatePath(`/admin/members/${userId}`);
  revalidatePath("/admin/members");
}

/**
 * Revoke access. Comped rows are deleted outright; real Stripe subscriptions
 * are only marked canceled here — cancel the actual billing in Stripe.
 */
export async function revokeAccess(subscriptionId: string, userId: string) {
  await requireAdmin();
  const sub = await db.subscription.findUnique({
    where: { id: subscriptionId },
  });
  if (!sub) return;

  if (isComped(sub.stripeSubscriptionId)) {
    await db.subscription.delete({ where: { id: subscriptionId } });
  } else {
    await db.subscription.update({
      where: { id: subscriptionId },
      data: { status: "CANCELED", canceledAt: new Date() },
    });
  }
  revalidatePath(`/admin/members/${userId}`);
  revalidatePath("/admin/members");
}

export async function setMemberRole(userId: string, formData: FormData) {
  const admin = await requireAdmin();
  const role = formData.get("role") === "ADMIN" ? "ADMIN" : "MEMBER";
  // Don't let the last admin demote themselves out of the school.
  if (role === "MEMBER" && userId === admin.id) {
    const admins = await db.user.count({ where: { role: "ADMIN" } });
    if (admins <= 1) return;
  }
  await db.user.update({ where: { id: userId }, data: { role } });
  revalidatePath(`/admin/members/${userId}`);
  revalidatePath("/admin/members");
}

/** Invite by email: magic link, no password for them to invent. */
export async function inviteMember(formData: FormData) {
  await requireAdmin();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email) return;
  await auth.api.signInMagicLink({
    body: { email, callbackURL: `${APP_URL}/courses` },
    headers: await headers(),
  });
  revalidatePath("/admin/members");
}

/** Send a fresh sign-in link to an existing member who's locked out. */
export async function sendSignInLink(userId: string) {
  await requireAdmin();
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) return;
  await auth.api.signInMagicLink({
    body: { email: user.email, callbackURL: `${APP_URL}/courses` },
    headers: await headers(),
  });
  revalidatePath(`/admin/members/${userId}`);
}
