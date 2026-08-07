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
  /** Light or dark ground. Dark suits audiences who live in dark IDEs. */
  surface: "light" | "dark";
  /** One hex. Soft/deep are derived in CSS; ink is derived from luminance. */
  accent: string;
}

const BRANDING_KEY = "branding";

export const BRANDING_DEFAULTS: BrandingSettings = {
  schoolName: "Homeroom",
  tagline: "Courses and community, with a tutor that knows the material.",
  logoUrl: "",
  supportEmail: "",
  surface: "light",
  accent: "#0F766E",
};

/** Readable text colour on the accent, by relative luminance. */
export function accentInk(hex: string): string {
  const h = hex.replace("#", "");
  const full =
    h.length === 3 ? h.split("").map((c) => c + c).join("") : h.padEnd(6, "0");
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255);
  const lin = (c: number) =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  const L = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  return L > 0.45 ? "#14161A" : "#FFFFFF";
}

const HEX = /^#?[0-9a-fA-F]{6}$/;
export function normalizeAccent(input: string): string | null {
  const v = input.trim();
  return HEX.test(v) ? (v.startsWith("#") ? v : `#${v}`).toUpperCase() : null;
}

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

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

export interface NotificationSettings {
  /** Slack channel ID for platform notifications (via Vercel Connect). */
  slackChannel: string;
}

const NOTIFICATIONS_KEY = "notifications";

export async function getNotificationSettings(): Promise<NotificationSettings> {
  try {
    const row = await db.setting.findUnique({
      where: { key: NOTIFICATIONS_KEY },
    });
    const stored = (row?.value ?? {}) as Partial<NotificationSettings>;
    return { slackChannel: stored.slackChannel ?? "" };
  } catch {
    return { slackChannel: "" };
  }
}

export async function saveNotificationSettings(
  value: NotificationSettings,
): Promise<void> {
  await db.setting.upsert({
    where: { key: NOTIFICATIONS_KEY },
    create: {
      key: NOTIFICATIONS_KEY,
      value: value as unknown as Prisma.InputJsonValue,
    },
    update: { value: value as unknown as Prisma.InputJsonValue },
  });
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
