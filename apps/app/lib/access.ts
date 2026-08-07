import { db, type Product, type User } from "@homeroom/db";

export interface CourseAccess {
  hasAccess: boolean;
  /** First active product that unlocks this course (for the subscribe CTA). */
  product: Product | null;
}

/**
 * Course-level entitlement. A course with no product entitlements is free to
 * any signed-in member; otherwise an active/trialing subscription to an
 * entitling product is required. Admins always have access.
 */
export async function getCourseAccess(
  user: User | null,
  courseId: string,
): Promise<CourseAccess> {
  const entitlements = await db.entitlement.findMany({
    where: { courseId, product: { active: true } },
    include: { product: true },
  });
  const product = entitlements[0]?.product ?? null;

  if (user?.role === "ADMIN") return { hasAccess: true, product };
  if (entitlements.length === 0) return { hasAccess: Boolean(user), product };
  if (!user) return { hasAccess: false, product };

  const sub = await db.subscription.findFirst({
    where: {
      userId: user.id,
      status: { in: ["ACTIVE", "TRIALING"] },
      productId: { in: entitlements.map((e) => e.productId) },
    },
  });
  return { hasAccess: Boolean(sub), product };
}

export function lessonAccessible(
  user: User | null,
  lesson: { published: boolean; isPublicPreview: boolean },
  hasCourseAccess: boolean,
): boolean {
  if (user?.role === "ADMIN") return true;
  if (!lesson.published) return false;
  if (lesson.isPublicPreview) return true;
  return hasCourseAccess;
}

export function formatPrice(product: Product): string {
  const amount = (product.priceCents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: product.currency.toUpperCase(),
  });
  return `${amount}/${product.interval}`;
}
