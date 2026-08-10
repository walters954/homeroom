"use server";

import { revalidatePath } from "next/cache";
import { disconnectOrg } from "@/lib/salesforce/connect";
import { requireUser } from "@/lib/session";

/**
 * Forget a learner's org. Deletes our copy of the refresh token; the grant
 * itself lives in their org under Setup → Connected Apps, and the UI says so —
 * "disconnect" that leaves us with access they can't see would be a lie.
 */
export async function disconnectSalesforce(path: string) {
  const user = await requireUser();
  await disconnectOrg(user.id);
  revalidatePath(path);
}
