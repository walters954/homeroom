import Anthropic from "@anthropic-ai/sdk";

/**
 * Model calls route through Vercel AI Gateway (provider keys live in the
 * gateway). Auth, in order: explicit AI_GATEWAY_API_KEY, else the Vercel
 * deployment's OIDC token (injected automatically on Vercel — no key to
 * manage). Falls back to the direct Anthropic API when neither exists.
 */
function gatewayAuth(): { apiKey?: string; authToken?: string } | null {
  if (process.env.AI_GATEWAY_API_KEY) {
    return { apiKey: process.env.AI_GATEWAY_API_KEY };
  }
  if (process.env.VERCEL_OIDC_TOKEN) {
    return { authToken: process.env.VERCEL_OIDC_TOKEN };
  }
  return null;
}

export function defaultModel(): string {
  return (
    process.env.TUTOR_MODEL ??
    (gatewayAuth() ? "anthropic/claude-opus-5" : "claude-opus-5")
  );
}

export type AiTask = "simple" | "complex";

/**
 * Resolve the model for a task from admin settings (/admin/settings).
 * Without gateway auth, non-Anthropic slugs can't be served — fall back to
 * the direct-API default.
 */
export async function modelFor(task: AiTask): Promise<string> {
  if (process.env.TUTOR_MODEL) return process.env.TUTOR_MODEL;
  if (!gatewayAuth()) return "claude-opus-5";
  const { getAiModels } = await import("./settings");
  const models = await getAiModels();
  return task === "simple" ? models.simple : models.complex;
}

export function makeAnthropic(): Anthropic {
  const auth = gatewayAuth();
  if (auth) {
    return new Anthropic({
      ...auth,
      baseURL: "https://ai-gateway.vercel.sh",
    });
  }
  return new Anthropic();
}
