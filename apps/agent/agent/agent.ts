import { defineAgent } from "eve";

export default defineAgent({
  // Routed through Vercel AI Gateway (BYOK). Mirrors the "complex" model in
  // Homeroom's admin settings — change both together.
  model: process.env.AGENT_MODEL ?? "minimax/minimax-m3",
});
