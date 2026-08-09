"use client";

import { useState, useTransition } from "react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
  Label,
  Select,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Textarea,
} from "@homeroom/ui";
import type { ImportPreview, ImportResult } from "@/lib/actions/member-import";
import type { RowAction } from "@/lib/members/import";

const ACTION_BADGE: Record<RowAction, "proven" | "shaky" | "untested" | "fail"> = {
  COMP: "proven",
  INVITE: "untested",
  EXISTS: "shaky",
  SKIP: "fail",
};

const ACTION_LABEL: Record<RowAction, string> = {
  COMP: "grant access",
  INVITE: "invite",
  EXISTS: "already here",
  SKIP: "skip",
};

export function MemberImport({
  products,
  previewAction,
  commitAction,
}: {
  products: { id: string; name: string }[];
  previewAction: (csv: string) => Promise<ImportPreview>;
  commitAction: (csv: string, productId: string | null) => Promise<ImportResult>;
}) {
  const [csv, setCsv] = useState("");
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [productId, setProductId] = useState(products[0]?.id ?? "");
  const [pending, startTransition] = useTransition();

  function runPreview(text: string) {
    setError(null);
    setResult(null);
    startTransition(async () => {
      try {
        setPreview(await previewAction(text));
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    });
  }

  async function onFile(file: File) {
    const text = await file.text();
    setCsv(text);
    runPreview(text);
  }

  function commit() {
    setError(null);
    startTransition(async () => {
      try {
        setResult(await commitAction(csv, productId || null));
        setPreview(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    });
  }

  const willComp = preview?.summary.COMP ?? 0;
  const actionable = (preview?.summary.COMP ?? 0) + (preview?.summary.INVITE ?? 0);

  if (result) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Import finished</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-[13px]">
            {result.invited} invited · {result.comped} granted access ·{" "}
            {result.skipped} skipped
          </p>
          <p className="hr-ev">
            Everyone invited has a sign-in link valid for 7 days. Nobody has an
            account until they use it, so the members list shows them as
            unverified until then.
          </p>
          {result.failures.length > 0 && (
            <div className="mt-3">
              <p className="hr-eyebrow mb-1">
                {result.failures.length} failed — these were not invited
              </p>
              <ul className="space-y-1">
                {result.failures.map((f) => (
                  <li key={f.email} className="text-[12.5px]">
                    <span className="font-mono">{f.email}</span>
                    <span className="hr-ev block">{f.reason}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
        <CardFooter>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setResult(null);
              setCsv("");
            }}
          >
            Import another file
          </Button>
        </CardFooter>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>1 · The file</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label htmlFor="csv-file">Upload a CSV</Label>
            <input
              id="csv-file"
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void onFile(f);
              }}
              className="block w-full text-[12px] text-muted-foreground file:mr-3 file:rounded-[6px] file:border file:border-input file:bg-card file:px-3 file:py-1.5 file:text-[11.5px] file:text-foreground"
            />
          </div>
          <div>
            <Label htmlFor="csv-text">…or paste it</Label>
            <Textarea
              id="csv-text"
              rows={5}
              value={csv}
              onChange={(e) => setCsv(e.target.value)}
              placeholder={"Email,Name,Status\nada@example.com,Ada Lovelace,active"}
              className="font-mono text-[12px]"
            />
          </div>
        </CardContent>
        <CardFooter>
          <Button size="sm" disabled={!csv.trim() || pending} onClick={() => runPreview(csv)}>
            {pending ? "Reading…" : "Preview"}
          </Button>
          <span className="hr-ev">
            Nothing is created until you confirm on the next step.
          </span>
        </CardFooter>
      </Card>

      {error && (
        <Card>
          <CardContent>
            <p className="text-[13px] text-fail">{error}</p>
          </CardContent>
        </Card>
      )}

      {preview && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>2 · What will happen</CardTitle>
              <span className="ml-auto hr-path">{preview.rows.length} rows</span>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-[12.5px]">
                {preview.summary.COMP} granted access · {preview.summary.INVITE}{" "}
                invited · {preview.summary.EXISTS} already here ·{" "}
                {preview.summary.SKIP} skipped
              </p>
              <p className="hr-ev">
                Read from{" "}
                <span className="font-mono">{preview.matched.email ?? "no email column found"}</span>
                {preview.matched.name && (
                  <>
                    {" · "}
                    <span className="font-mono">{preview.matched.name}</span>
                  </>
                )}
                {preview.matched.status ? (
                  <>
                    {" · "}
                    <span className="font-mono">{preview.matched.status}</span>
                  </>
                ) : (
                  " · no status column, so nobody will be granted access"
                )}
              </p>
            </CardContent>
          </Card>

          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Line</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Will</TableHead>
                  <TableHead>Why</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {preview.rows.map((r) => (
                  <TableRow key={`${r.line}-${r.email}`}>
                    <TableCell className="font-mono text-muted-foreground">{r.line}</TableCell>
                    <TableCell className="font-mono">{r.email || "—"}</TableCell>
                    <TableCell>{r.name || "—"}</TableCell>
                    <TableCell>
                      <Badge variant={ACTION_BADGE[r.action]}>
                        {ACTION_LABEL[r.action]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{r.reason}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>3 · Send</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {willComp > 0 && (
                <div>
                  <Label htmlFor="product">
                    Product to grant the {willComp} paying members
                  </Label>
                  {products.length > 0 ? (
                    <Select
                      id="product"
                      value={productId}
                      onChange={(e) => setProductId(e.target.value)}
                    >
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </Select>
                  ) : (
                    <p className="text-[12.5px] text-warn">
                      No products exist yet, so nobody can be granted access.
                      They will still be invited — create a product first if
                      these people should keep their access.
                    </p>
                  )}
                  <p className="hr-ev">
                    Granted as a comp, not a Stripe subscription. No card is
                    charged and no invoice is raised.
                  </p>
                </div>
              )}
            </CardContent>
            <CardFooter>
              <Button size="sm" disabled={pending || actionable === 0} onClick={commit}>
                {pending ? "Sending…" : `Invite ${actionable} people`}
              </Button>
              <span className="hr-ev">
                Sends {actionable} emails. Safe to re-run — anyone already here
                is skipped.
              </span>
            </CardFooter>
          </Card>
        </>
      )}
    </div>
  );
}
