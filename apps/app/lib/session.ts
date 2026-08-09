import { auth } from "@homeroom/auth";
import { db, type User } from "@homeroom/db";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { isPreviewing } from "./viewer";

export async function getSession() {
  return auth.api.getSession({ headers: await headers() });
}

/**
 * The signed-in user with their real role, ignoring any student preview.
 * Only use this to decide who may *leave* a preview or to render the preview
 * banner — every access decision should go through `getCurrentUser()`.
 */
export async function getActualUser(): Promise<User | null> {
  const session = await getSession();
  if (!session) return null;
  return db.user.findUnique({ where: { id: session.user.id } });
}

/**
 * The user as the app should treat them right now. While an admin is
 * previewing as a student their role reads MEMBER, so every downstream check
 * (entitlements, draft lessons, `requireAdmin`) sees the member's world.
 */
export async function getCurrentUser(): Promise<User | null> {
  const user = await getActualUser();
  if (!user) return null;
  if (user.role === "ADMIN" && (await isPreviewing())) {
    return { ...user, role: "MEMBER" };
  }
  return user;
}

export interface Viewer {
  user: User | null;
  /** True when an admin is currently looking at the member experience. */
  previewing: boolean;
}

/** One round-trip for shells that need both the effective user and the badge. */
export async function getViewer(): Promise<Viewer> {
  const actual = await getActualUser();
  if (!actual) return { user: null, previewing: false };
  const previewing = actual.role === "ADMIN" && (await isPreviewing());
  return {
    user: previewing ? { ...actual, role: "MEMBER" } : actual,
    previewing,
  };
}

export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  return user;
}

export async function requireAdmin(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  // Previewing lands here too, and should: an admin pretending to be a member
  // must not be able to open /admin without stepping out of the preview first.
  if (user.role !== "ADMIN") redirect("/courses");
  return user;
}
