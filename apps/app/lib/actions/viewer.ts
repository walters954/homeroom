"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getActualUser } from "../session";
import { VIEW_AS_COOKIE, VIEW_AS_MEMBER } from "../viewer";

/** Only an actual admin can drop into the member experience. */
export async function startStudentPreview(formData: FormData) {
  const user = await getActualUser();
  if (user?.role !== "ADMIN") return;

  const jar = await cookies();
  jar.set(VIEW_AS_COOKIE, VIEW_AS_MEMBER, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    // Long enough to actually walk the course; short enough that nobody
    // forgets they're in it a week later.
    maxAge: 60 * 60 * 8,
  });

  const to = String(formData.get("redirectTo") ?? "/today");
  // Admin-only pages become inaccessible the moment the preview starts, so
  // stepping in from one lands on the member's home instead of a redirect loop.
  redirect(to.startsWith("/admin") ? "/today" : to);
}

/**
 * Deliberately unconditional — clearing the cookie can only ever restore
 * privilege the session already has, and nobody should be able to get stuck
 * in a preview because a role check failed.
 */
export async function endStudentPreview(formData: FormData) {
  const jar = await cookies();
  jar.delete(VIEW_AS_COOKIE);
  redirect(String(formData.get("redirectTo") ?? "/admin"));
}
