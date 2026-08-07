import { db, type Prisma } from "@homeroom/db";

export interface AiModelSettings {
  /** Everyday interactions: tutor chat. Cheap + fast. */
  simple: string;
  /** Heavy lifting: lesson drafts, announcements. Best quality. */
  complex: string;
}

const KEY = "aiModels";

export const AI_MODEL_DEFAULTS: AiModelSettings = {
  simple: "minimax/minimax-m2.7",
  complex: "anthropic/claude-opus-5",
};

export async function getAiModels(): Promise<AiModelSettings> {
  const row = await db.setting.findUnique({ where: { key: KEY } });
  const stored = (row?.value ?? {}) as Partial<AiModelSettings>;
  return { ...AI_MODEL_DEFAULTS, ...stored };
}

export async function saveAiModels(value: AiModelSettings): Promise<void> {
  await db.setting.upsert({
    where: { key: KEY },
    create: { key: KEY, value: value as unknown as Prisma.InputJsonValue },
    update: { value: value as unknown as Prisma.InputJsonValue },
  });
}
