import Anthropic from "@anthropic-ai/sdk";
import { getVercelOidcToken } from "@vercel/oidc";

/**
 * Model calls route through Vercel AI Gateway (provider keys live in the
 * gateway). Auth, in order: explicit AI_GATEWAY_API_KEY, else the Vercel
 * deployment's OIDC identity — no key to manage. Falls back to the direct
 * Anthropic API when neither exists.
 *
 * The OIDC token has to come from `@vercel/oidc`, not `process.env`: in a
 * deployed function it arrives per request on the `x-vercel-oidc-token`
 * header and only falls back to the environment locally. Reading the env var
 * alone made every model call in production fall through to the direct
 * Anthropic API with no key, which is a 500.
 */
async function gatewayAuth(): Promise<{ apiKey?: string; authToken?: string } | null> {
  if (process.env.AI_GATEWAY_API_KEY) {
    return { apiKey: process.env.AI_GATEWAY_API_KEY };
  }
  try {
    const token = await getVercelOidcToken();
    if (token) return { authToken: token };
  } catch {
    // No OIDC identity here (local dev without `vercel env pull`, or a
    // non-Vercel host). Fall through to the direct API.
  }
  return null;
}

export async function defaultModel(): Promise<string> {
  return (
    process.env.TUTOR_MODEL ??
    ((await gatewayAuth()) ? "anthropic/claude-opus-5" : "claude-opus-5")
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
  if (!(await gatewayAuth())) return "claude-opus-5";
  const { getAiModels } = await import("./settings");
  const models = await getAiModels();
  return task === "simple" ? models.simple : models.complex;
}

export async function makeAnthropic(): Promise<Anthropic> {
  const auth = await gatewayAuth();
  if (auth) {
    return new Anthropic({
      ...auth,
      baseURL: "https://ai-gateway.vercel.sh",
    });
  }
  return new Anthropic();
}
