import { cookies } from "next/headers";
import {
  authorizeUrl,
  createPkce,
  createState,
  isSalesforceConfigured,
} from "@/lib/salesforce/connect";
import { getCurrentUser } from "@/lib/session";

/** Long enough to sign in to Salesforce, short enough not to linger. */
const HANDSHAKE_MAX_AGE = 600;

export const HANDSHAKE_COOKIE = "hr-sf-handshake";

/**
 * Start the OAuth handshake. The verifier and state live in a short-lived
 * httpOnly cookie rather than in the URL, so neither the authorization request
 * nor Salesforce's redirect can be replayed by anyone who saw them.
 */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return Response.redirect(new URL("/sign-in", request.url), 302);
  }
  if (!isSalesforceConfigured()) {
    return Response.redirect(
      new URL("/today?org=unavailable", request.url),
      302,
    );
  }

  const url = new URL(request.url);
  const sandbox = url.searchParams.get("env") === "sandbox";
  const returnTo = url.searchParams.get("returnTo") ?? "/today";

  const { verifier, challenge } = createPkce();
  const state = createState();

  const jar = await cookies();
  jar.set(HANDSHAKE_COOKIE, JSON.stringify({ verifier, state, sandbox, returnTo }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: HANDSHAKE_MAX_AGE,
  });

  return Response.redirect(authorizeUrl(challenge, state, sandbox), 302);
}
