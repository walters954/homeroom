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

// ---------------------------------------------------------------------------
// Branding — what students see. Homeroom is the software; the school is theirs.
// ---------------------------------------------------------------------------

export interface BrandingSettings {
  schoolName: string;
  tagline: string;
  logoUrl: string;
  supportEmail: string;
}

const BRANDING_KEY = "branding";

export const BRANDING_DEFAULTS: BrandingSettings = {
  schoolName: "Homeroom",
  tagline:
    "Courses and community, with a tutor that knows the material.",
  logoUrl: "",
  supportEmail: "",
};

export async function getBranding(): Promise<BrandingSettings> {
  try {
    const row = await db.setting.findUnique({ where: { key: BRANDING_KEY } });
    const stored = (row?.value ?? {}) as Partial<BrandingSettings>;
    return { ...BRANDING_DEFAULTS, ...stored };
  } catch {
    // Branding is rendered on every page — never let a DB hiccup blank the app.
    return BRANDING_DEFAULTS;
  }
}

export async function saveBranding(value: BrandingSettings): Promise<void> {
  await db.setting.upsert({
    where: { key: BRANDING_KEY },
    create: {
      key: BRANDING_KEY,
      value: value as unknown as Prisma.InputJsonValue,
    },
    update: { value: value as unknown as Prisma.InputJsonValue },
  });
}
