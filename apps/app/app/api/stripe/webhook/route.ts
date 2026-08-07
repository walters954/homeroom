import type Stripe from "stripe";
import { db, type SubscriptionStatus } from "@homeroom/db";
import { stripe } from "@/lib/stripe";

const STATUS_MAP: Record<string, SubscriptionStatus> = {
  trialing: "TRIALING",
  active: "ACTIVE",
  past_due: "PAST_DUE",
  unpaid: "PAST_DUE",
  canceled: "CANCELED",
  incomplete: "INCOMPLETE",
  incomplete_expired: "INCOMPLETE",
  paused: "PAST_DUE",
};

async function upsertSubscription(sub: Stripe.Subscription) {
  const userId = sub.metadata.userId;
  const productId = sub.metadata.productId;
  if (!userId || !productId) return;

  const item = sub.items.data[0];
  await db.subscription.upsert({
    where: { stripeSubscriptionId: sub.id },
    create: {
      userId,
      productId,
      stripeCustomerId: String(sub.customer),
      stripeSubscriptionId: sub.id,
      status: STATUS_MAP[sub.status] ?? "INCOMPLETE",
      trialEndsAt: sub.trial_end ? new Date(sub.trial_end * 1000) : null,
      currentPeriodEnd: item
        ? new Date(item.current_period_end * 1000)
        : null,
      canceledAt: sub.canceled_at ? new Date(sub.canceled_at * 1000) : null,
    },
    update: {
      status: STATUS_MAP[sub.status] ?? "INCOMPLETE",
      trialEndsAt: sub.trial_end ? new Date(sub.trial_end * 1000) : null,
      currentPeriodEnd: item
        ? new Date(item.current_period_end * 1000)
        : null,
      canceledAt: sub.canceled_at ? new Date(sub.canceled_at * 1000) : null,
    },
  });
}

export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    return Response.json({ error: "Webhook not configured" }, { status: 503 });
  }
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return Response.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe().webhooks.constructEvent(
      await request.text(),
      signature,
      secret,
    );
  } catch {
    return Response.json({ error: "Invalid signature" }, { status: 400 });
  }

  switch (event.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
      await upsertSubscription(event.data.object);
      break;
    default:
      break;
  }

  return Response.json({ received: true });
}
