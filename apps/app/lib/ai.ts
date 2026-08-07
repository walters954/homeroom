import Anthropic from "@anthropic-ai/sdk";

/**
 * Model calls route through Vercel AI Gateway when AI_GATEWAY_API_KEY is set
 * (provider keys live in the gateway); direct Anthropic API otherwise.
 */
export const useGateway = Boolean(process.env.AI_GATEWAY_API_KEY);

export function defaultModel(): string {
  return (
    process.env.TUTOR_MODEL ??
    (useGateway ? "anthropic/claude-opus-5" : "claude-opus-5")
  );
}

export function makeAnthropic(): Anthropic {
  if (useGateway) {
    return new Anthropic({
      apiKey: process.env.AI_GATEWAY_API_KEY,
      baseURL: "https://ai-gateway.vercel.sh",
    });
  }
  return new Anthropic();
}
