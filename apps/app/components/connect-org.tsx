import { Badge, Button, Card, CardContent, CardHeader } from "@homeroom/ui";
import { disconnectSalesforce } from "@/lib/actions/salesforce";
import { getConnection, isSalesforceConfigured } from "@homeroom/runner-apex";
import { ORG_DOCS } from "@homeroom/runner-apex";
import { relativeDays } from "@/lib/practice";

/**
 * Apex runs in an org the learner brings (issue #29).
 *
 * Renders nothing when the deployment has no Salesforce app configured, so a
 * school that doesn't teach Salesforce never sees it — same convention as
 * lib/notify.ts, where an unconfigured integration is absent rather than broken.
 */
export async function ConnectOrg({
  userId,
  returnTo,
  status,
  refusedType,
}: {
  userId: string;
  /** Where the OAuth round trip should land back. */
  returnTo: string;
  status?: string;
  refusedType?: string;
}) {
  if (!isSalesforceConfigured()) return null;

  const connection = await getConnection(userId);
  const connect = `/api/salesforce/authorize?returnTo=${encodeURIComponent(returnTo)}`;

  if (connection) {
    return (
      <Card className="mb-4">
        <CardHeader>
          <span className="font-semibold">Your Salesforce org</span>
          <Badge variant="proven" className="ml-auto">
            connected
          </Badge>
        </CardHeader>
        <CardContent>
          <p className="text-[12.5px] text-ink">{connection.username}</p>
          <p className="hr-ev mt-1">
            {connection.orgType}
            {connection.isSandbox ? " · sandbox" : ""} · connected{" "}
            {relativeDays(connection.connectedAt)}
          </p>
          <form
            action={async () => {
              "use server";
              await disconnectSalesforce(returnTo);
            }}
            className="mt-3"
          >
            <Button type="submit" variant="ghost" size="sm">
              Disconnect
            </Button>
            <span className="hr-ev ml-2">
              Removes our copy of the token. To revoke it at the source, use Setup
              → Connected Apps in your org.
            </span>
          </form>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mb-4">
      <CardHeader>
        <span className="font-semibold">Connect a Salesforce org to run this</span>
      </CardHeader>
      <CardContent>
        {status === "refused" && (
          <p className="mb-3 rounded-[7px] bg-fail-soft px-3 py-2 text-[12.5px] text-fail">
            That looked like a production org{refusedType ? ` (${refusedType})` : ""}, so
            we didn&apos;t connect it. Exercises run real Apex — use a playground, a
            Developer Edition org, or a sandbox.
          </p>
        )}
        {status === "failed" && (
          <p className="mb-3 rounded-[7px] bg-fail-soft px-3 py-2 text-[12.5px] text-fail">
            That didn&apos;t complete. Worth trying again.
          </p>
        )}

        <p className="max-w-[66ch] text-[12.5px] leading-relaxed text-dim">
          Apex only runs inside Salesforce, so exercises run in an org you own rather
          than one we lend you. Your code and its results stay yours, and anything an
          exercise writes is rolled back when it finishes.
        </p>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button asChild size="sm">
            <a href={connect}>Connect an org</a>
          </Button>
          <a href={`${connect}&env=sandbox`} className="hr-ev underline">
            Use a sandbox instead
          </a>
        </div>

        <p className="hr-eyebrow mt-4">Don&apos;t have one?</p>
        <ul className="mt-1 flex flex-col gap-1">
          {ORG_DOCS.map((doc) => (
            <li key={doc.href} className="text-[12.5px]">
              <a
                href={doc.href}
                target="_blank"
                rel="noreferrer"
                className="text-acc underline"
              >
                {doc.label}
              </a>
              <span className="hr-ev ml-2">{doc.note}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
