import { cookies } from "next/headers";

/**
 * "View as student" — an admin previewing the member experience.
 *
 * The preview is a real privilege *reduction*, not a UI trick: while it is on,
 * `getCurrentUser()` reports the admin as a MEMBER, so entitlement checks,
 * unpublished-lesson hiding and `requireAdmin()` all behave exactly as they
 * would for a paying member. That is the only way a preview is worth trusting —
 * if it merely hid the Teach nav, you would still be seeing admin-only content
 * and wouldn't know it.
 *
 * Because it only ever removes privilege, the cookie is safe to trust: the
 * worst a forged one can do is show its holder less than they're entitled to.
 */
export const VIEW_AS_COOKIE = "hr-view-as";
export const VIEW_AS_MEMBER = "member";

export async function isPreviewing(): Promise<boolean> {
  const jar = await cookies();
  return jar.get(VIEW_AS_COOKIE)?.value === VIEW_AS_MEMBER;
}
