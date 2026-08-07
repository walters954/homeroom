import { defineTool } from "eve/tools";
import { z } from "zod";
import { db } from "@homeroom/db";

export default defineTool({
  description:
    "File a suggestion for creator approval (lesson draft, announcement, community reply, nudge email, SEO metadata, quiz). Payload is the proposed artifact; evidence is what you observed that justifies it — required, never empty.",
  inputSchema: z.object({
    type: z.enum([
      "LESSON_DRAFT",
      "ANNOUNCEMENT",
      "COMMUNITY_REPLY",
      "NUDGE_EMAIL",
      "SEO_META",
      "QUIZ",
    ]),
    payload: z.record(z.string(), z.unknown()),
    evidence: z.record(z.string(), z.unknown()),
  }),
  async execute({ type, payload, evidence }) {
    const suggestion = await db.agentSuggestion.create({
      data: { type, payload: payload as object, evidence: evidence as object },
    });
    return { suggestionId: suggestion.id, status: suggestion.status };
  },
});
