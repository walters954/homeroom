import { cookies } from "next/headers";
import {
  exchangeCode,
  fetchOrgIdentity,
  saveConnection,
  verdictFor,
} from "@homeroom/runner-apex";
import { getCurrentUser } from "@/lib/session";
import { HANDSHAKE_COOKIE } from "../authorize/route";

interface Handshake {
  verifier: string;
  state: string;
  sandbox: boolean;
  returnTo: string;
}

function readHandshake(raw: string | undefined): Handshake | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<Handshake>;
    if (typeof parsed.verifier !== "string" || typeof parsed.state !== "string") {
      return null;
    }
    return {
      verifier: parsed.verifier,
      state: parsed.state,
      sandbox: parsed.sandbox === true,
      returnTo: typeof parsed.returnTo === "string" ? parsed.returnTo : "/today",
    };
  } catch {
    return null;
  }
}

/** Only ever bounce back inside the app. */
function safeReturn(returnTo: string): string {
  return returnTo.startsWith("/") && !returnTo.startsWith("//") ? returnTo : "/today";
}

function back(request: Request, returnTo: string, params: Record<string, string>) {
  const url = new URL(safeReturn(returnTo), request.url);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return Response.redirect(url, 302);
}

/**
 * Finish the handshake, then ask the org what it is.
 *
 * A production org is refused here rather than warned about later: exercises
 * run real Apex against whatever is connected, and the savepoint rollback that
 * keeps it clean is our code running in someone else's business.
 */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.redirect(new URL("/sign-in", request.url), 302);

  const jar = await cookies();
  const handshake = readHandshake(jar.get(HANDSHAKE_COOKIE)?.value);
  jar.delete(HANDSHAKE_COOKIE);

  const url = new URL(request.url);
  const returnTo = handshake?.returnTo ?? "/today";

  if (url.searchParams.get("error")) {
    return back(request, returnTo, { org: "cancelled" });
  }
  const code = url.searchParams.get("code");
  if (!handshake || !code || url.searchParams.get("state") !== handshake.state) {
    return back(request, returnTo, { org: "failed" });
  }

  const token = await exchangeCode(code, handshake.verifier, handshake.sandbox);
  if (!token?.refresh_token) {
    // No refresh token means the app is missing the offline-access scope, and
    // the connection would silently stop working within hours.
    return back(request, returnTo, { org: "failed" });
  }

  const identity = await fetchOrgIdentity(token.instance_url, token.access_token, token.id);
  if (!identity) return back(request, returnTo, { org: "failed" });

  const verdict = verdictFor(identity);
  if (!verdict.allowed) {
    return back(request, returnTo, { org: "refused", orgType: identity.organizationType });
  }

  await saveConnection(user.id, identity, token.instance_url, token.refresh_token);
  return back(request, returnTo, { org: "connected" });
}
