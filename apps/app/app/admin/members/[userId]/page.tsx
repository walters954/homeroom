import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@homeroom/db";
import {
  grantAccess,
  revokeAccess,
  sendSignInLink,
  setMemberRole,
} from "@/lib/actions/members";
import { isComped } from "@/lib/comp";
import { requireAdmin } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function MemberDetailPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  await requireAdmin();
  const { userId } = await params;
  const [member, products] = await Promise.all([
    db.user.findUnique({
      where: { id: userId },
      include: {
        subscriptions: {
          orderBy: { createdAt: "desc" },
          include: { product: true },
        },
        lessonProgress: {
          where: { completedAt: { not: null } },
          orderBy: { completedAt: "desc" },
          take: 10,
          include: {
            lesson: {
              select: {
                title: true,
                section: { select: { course: { select: { title: true } } } },
              },
            },
          },
        },
      },
    }),
    db.product.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
  ]);
  if (!member) notFound();

  const grantable = products.filter(
    (p) =>
      !member.subscriptions.some(
        (s) => s.productId === p.id && ["ACTIVE", "TRIALING"].includes(s.status),
      ),
  );

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <p className="mb-2 text-sm text-dim">
        <Link href="/admin/members" className="hover:underline">
          Members
        </Link>
      </p>
      <h1 className="text-3xl font-bold tracking-tight">{member.name}</h1>
      <p className="mb-8 text-sm text-dim">
        {member.email} · joined {member.createdAt.toLocaleDateString()} ·{" "}
        {member.emailVerified ? "verified" : "email unverified"}
      </p>

      <section className="mb-8 rounded-lg border border-line p-5">
        <h2 className="mb-4 text-lg font-semibold">Access</h2>
        {member.subscriptions.length === 0 && (
          <p className="mb-4 text-sm text-dim">No subscriptions.</p>
        )}
        <ul className="mb-4 space-y-2">
          {member.subscriptions.map((s) => (
            <li
              key={s.id}
              className="flex items-center justify-between rounded-md bg-bg px-3 py-2 text-sm"
            >
              <span>
                {s.product.name}{" "}
                <span className="text-dim">
                  · {s.status.toLowerCase()}
                  {isComped(s.stripeSubscriptionId) && " · comped"}
                  {s.trialEndsAt &&
                    ` · trial ends ${s.trialEndsAt.toLocaleDateString()}`}
                </span>
              </span>
              {["ACTIVE", "TRIALING"].includes(s.status) && (
                <form action={revokeAccess.bind(null, s.id, member.id)}>
                  <button className="text-xs text-fail hover:underline">
                    revoke
                  </button>
                </form>
              )}
            </li>
          ))}
        </ul>

        {grantable.length > 0 && (
          <form
            action={grantAccess.bind(null, member.id)}
            className="flex items-end gap-2"
          >
            <label className="flex flex-1 flex-col gap-1 text-sm font-medium">
              Grant access (no charge)
              <select
                name="productId"
                className="rounded-md border border-line px-3 py-2 font-normal"
              >
                {grantable.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <button className="rounded-md bg-acc px-4 py-2 text-sm font-medium text-acc-ink hover:opacity-90">
              Grant
            </button>
          </form>
        )}
        <p className="mt-3 text-xs text-dim">
          Granting creates a comped subscription — use it for migrated members
          and comps. Revoking a real Stripe subscription marks it canceled here;
          cancel the billing in Stripe too.
        </p>
      </section>

      <section className="mb-8 rounded-lg border border-line p-5">
        <h2 className="mb-4 text-lg font-semibold">Account</h2>
        <div className="flex flex-wrap items-end gap-3">
          <form
            action={setMemberRole.bind(null, member.id)}
            className="flex items-end gap-2"
          >
            <label className="flex flex-col gap-1 text-sm font-medium">
              Role
              <select
                name="role"
                defaultValue={member.role}
                className="rounded-md border border-line px-3 py-2 font-normal"
              >
                <option value="MEMBER">Member</option>
                <option value="ADMIN">Admin</option>
              </select>
            </label>
            <button className="rounded-md border border-line px-3 py-2 text-sm hover:bg-soft">
              Save role
            </button>
          </form>
          <form action={sendSignInLink.bind(null, member.id)}>
            <button className="rounded-md border border-line px-3 py-2 text-sm hover:bg-soft">
              Email sign-in link
            </button>
          </form>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-dim">
          Recent progress
        </h2>
        {member.lessonProgress.length === 0 ? (
          <p className="text-sm text-dim">No lessons completed yet.</p>
        ) : (
          <ul className="space-y-1 text-sm text-dim">
            {member.lessonProgress.map((p) => (
              <li key={p.id}>
                ✅ {p.lesson.title}{" "}
                <span className="text-dim">
                  · {p.lesson.section.course.title} ·{" "}
                  {p.completedAt?.toLocaleDateString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
