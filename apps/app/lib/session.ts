import { auth } from "@homeroom/auth";
import { db, type User } from "@homeroom/db";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export async function getSession() {
  return auth.api.getSession({ headers: await headers() });
}

export async function getCurrentUser(): Promise<User | null> {
  const session = await getSession();
  if (!session) return null;
  return db.user.findUnique({ where: { id: session.user.id } });
}

export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  return user;
}

export async function requireAdmin(): Promise<User> {
  const user = await requireUser();
  if (user.role !== "ADMIN") redirect("/courses");
  return user;
}

/**
 * Can this user open this lesson's full content?
 * Entitlement enforcement (products/subscriptions) arrives with checkout;
 * until then any signed-in member can access published content.
 */
export function canAccessLesson(
  user: User | null,
  lesson: { published: boolean; isPublicPreview: boolean },
): boolean {
  if (user?.role === "ADMIN") return true;
  if (!lesson.published) return false;
  if (lesson.isPublicPreview) return true;
  return user !== null;
}
