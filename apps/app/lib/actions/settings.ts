"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "../session";
import { saveAiModels, saveBranding } from "../settings";

export async function updateAiModels(formData: FormData) {
  await requireAdmin();
  const simple = String(formData.get("simple") ?? "").trim();
  const complex = String(formData.get("complex") ?? "").trim();
  if (!simple || !complex) return;
  await saveAiModels({ simple, complex });
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
