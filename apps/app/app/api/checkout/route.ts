import { db } from "@homeroom/db";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { stripe, stripeConfigured } from "@/lib/stripe";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  const url = new URL(request.url);
  const productId = url.searchParams.get("productId");
  if (!user) redirect(`/sign-up`);
  if (!productId) redirect("/courses");
  if (!stripeConfigured()) {
    return Response.json(
      { error: "Payments are not configured." },
      { status: 503 },
    );
  }

  const product = await db.product.findUnique({ where: { id: productId } });
  if (!product?.stripePriceId || !product.active) redirect("/courses");

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? url.origin;
  const session = await stripe().checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: product.stripePriceId, quantity: 1 }],
    customer_email: user.email,
    client_reference_id: user.id,
    subscription_data: {
      metadata: { userId: user.id, productId: product.id },
      ...(product.trialDays > 0
        ? { trial_period_days: product.trialDays }
        : {}),
    },
    success_url: `${appUrl}/courses?subscribed=1`,
    cancel_url: `${appUrl}/courses`,
  });

  redirect(session.url ?? "/courses");
}
