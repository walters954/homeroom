"use server";

import { db } from "@homeroom/db";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "../session";
import { slugify } from "../slug";
import { stripe, stripeConfigured } from "../stripe";

export async function createProduct(formData: FormData) {
  await requireAdmin();
  const name = String(formData.get("name") ?? "").trim();
  const priceCents = Math.round(
    parseFloat(String(formData.get("price") ?? "0")) * 100,
  );
  const trialDays = parseInt(String(formData.get("trialDays") ?? "0"), 10) || 0;
  if (!name || !priceCents) return;

  let stripeProductId: string | null = null;
  let stripePriceId: string | null = null;
  if (stripeConfigured()) {
    const product = await stripe().products.create({ name });
    const price = await stripe().prices.create({
      product: product.id,
      unit_amount: priceCents,
      currency: "usd",
      recurring: { interval: "month" },
    });
    stripeProductId = product.id;
    stripePriceId = price.id;
  }

  await db.product.create({
    data: {
      name,
      slug: slugify(name) || `product-${Date.now()}`,
      priceCents,
      trialDays,
      stripeProductId,
      stripePriceId,
    },
  });
  revalidatePath("/admin/products");
}

export async function toggleEntitlement(
  productId: string,
  courseId: string,
  formData: FormData,
) {
  void formData;
  await requireAdmin();
  const existing = await db.entitlement.findUnique({
    where: { productId_courseId: { productId, courseId } },
  });
  if (existing) {
    await db.entitlement.delete({ where: { id: existing.id } });
  } else {
    await db.entitlement.create({ data: { productId, courseId } });
  }
  revalidatePath("/admin/products");
}

export async function toggleProductActive(productId: string) {
  await requireAdmin();
  const product = await db.product.findUnique({ where: { id: productId } });
  if (!product) return;
  await db.product.update({
    where: { id: productId },
    data: { active: !product.active },
  });
  revalidatePath("/admin/products");
}
