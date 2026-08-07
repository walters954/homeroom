/** Comped access is a real Subscription row with a non-Stripe id. */
export const COMP_PREFIX = "comp_";

export function isComped(stripeSubscriptionId: string): boolean {
  return stripeSubscriptionId.startsWith(COMP_PREFIX);
}
