import { openingBrief, writtenBrief } from "@/lib/agent/brief";
import { parseScope } from "@/lib/agent/scope";
import { getCurrentUser } from "@/lib/session";
import { report } from "@/lib/observe";

export const maxDuration = 60;

/**
 * The pane's arrival state, as two NDJSON lines.
 *
 * The first is derived from rows and goes out immediately; the second is the
 * model's version, and simply never arrives if the gateway is slow or down.
 * That ordering is the whole design: the pane always has something true on
 * screen, and the model can only improve on it.
 */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return Response.json({ error: "Not signed in" }, { status: 401 });
  }

  const body = (await request.json()) as { scope?: unknown };
  const scope = parseScope(body.scope);
  if (!scope) {
    return Response.json({ error: "Unknown scope" }, { status: 400 });
  }

  const opening = await openingBrief(scope, user);
  if (!opening) {
    return Response.json({ error: "Nothing to brief on" }, { status: 404 });
  }

  const encoder = new TextEncoder();
  const readable = new ReadableStream<Uint8Array>({
    async start(controller) {
      const line = (value: unknown) =>
        controller.enqueue(encoder.encode(`${JSON.stringify(value)}\n`));

      line({ type: "derived", ...opening.brief });

      try {
        const written = await writtenBrief(
          scope,
          user,
          opening.state,
          opening.brief,
        );
        if (written) line({ type: "written", text: written });
      } catch (err) {
        // The derived line is already on screen; leave it there. The design
        // is that losing this costs the nicer sentence and nothing else —
        // which is exactly why it can fail for weeks without anyone noticing.
        report("tutor.brief", err, { scope: scope.kind });
      }
      controller.close();
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
