import { db } from "@homeroom/db";
import { MemberImport } from "@/components/member-import";
import { Page, PageHeader } from "@/components/page-header";
import { commitImport, previewImport } from "@/lib/actions/member-import";
import { requireAdmin } from "@/lib/session";

export const metadata = { title: "Import members" };
export const dynamic = "force-dynamic";

// Invites go out one at a time to stay under Resend's rate limit, so a few
// hundred people takes minutes rather than seconds.
export const maxDuration = 300;

export default async function ImportMembersPage() {
  await requireAdmin();
  const products = await db.product.findMany({
    where: { active: true },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true },
  });

  return (
    <Page>
      <PageHeader
        crumbs={[
          { label: "Admin", href: "/admin" },
          { label: "Members", href: "/admin/members" },
          { label: "Import" },
        ]}
        title="Import members"
        subtitle="Bring a member list over from Circle or anywhere else. Everyone gets a magic link, so nobody has to invent a password — and anyone already here is left alone."
      />

      <MemberImport
        products={products}
        previewAction={previewImport}
        commitAction={commitImport}
      />
    </Page>
  );
}
