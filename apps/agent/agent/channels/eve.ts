import { eveChannel } from "eve/channels/eve";
import { auth } from "@homeroom/auth";
import { db } from "@homeroom/db";

/**
 * The agent is mounted same-origin on the Homeroom app (see withEve in
 * apps/app/next.config.ts), so callers arrive with the app's own session
 * cookie. Authenticate them with Better Auth — no separate credential.
 */
export default eveChannel({
  auth: async (request: Request) => {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) return null;

    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, email: true, name: true, role: true },
    });
    if (!user) return null;

    return {
      authenticator: "homeroom-better-auth",
      principalType: "user",
      principalId: user.id,
      subject: user.email,
      attributes: { role: user.role, name: user.name },
    };
  },
});
