"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "../session";
import { saveAiModels } from "../settings";

export async function updateAiModels(formData: FormData) {
  await requireAdmin();
  const simple = String(formData.get("simple") ?? "").trim();
  const complex = String(formData.get("complex") ?? "").trim();
  if (!simple || !complex) return;
  await saveAiModels({ simple, complex });
  revalidatePath("/admin/settings");
}
