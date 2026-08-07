import { db } from "@homeroom/db";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { stripe, stripeConfigured } from "@/lib/stripe";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  if (!stripeConfigured()) redirect("/courses");

  const sub = await db.subscription.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  });
  if (!sub) redirect("/courses");

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;
  const session = await stripe().billingPortal.sessions.create({
    customer: sub.stripeCustomerId,
    return_url: `${appUrl}/courses`,
  });
  redirect(session.url);
}
