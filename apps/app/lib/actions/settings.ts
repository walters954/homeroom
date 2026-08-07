"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "../session";
import { postToSlack } from "../notify";
import {
  saveAiModels,
  saveBranding,
  saveNotificationSettings,
} from "../settings";

export async function updateAiModels(formData: FormData) {
  await requireAdmin();
  const simple = String(formData.get("simple") ?? "").trim();
  const complex = String(formData.get("complex") ?? "").trim();
  if (!simple || !complex) return;
  await saveAiModels({ simple, complex });
  revalidatePath("/admin/settings");
}

export async function updateNotifications(formData: FormData) {
  await requireAdmin();
  const slackChannel = String(formData.get("slackChannel") ?? "").trim();
  await saveNotificationSettings({ slackChannel });
  if (slackChannel) {
    await postToSlack(
      "✅ Connected. New lessons, community posts, events, and subscriptions will land here.",
    );
  }
  revalidatePath("/admin/settings");
}

export async function updateBranding(formData: FormData) {
  await requireAdmin();
  const schoolName = String(formData.get("schoolName") ?? "").trim();
  if (!schoolName) return;
  await saveBranding({
    schoolName,
    tagline: String(formData.get("tagline") ?? "").trim(),
    logoUrl: String(formData.get("logoUrl") ?? "").trim(),
    supportEmail: String(formData.get("supportEmail") ?? "").trim(),
  });
  revalidatePath("/", "layout");
}
