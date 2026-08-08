import { db } from "@homeroom/db";
import { formatPrice } from "@/lib/access";
import {
  createProduct,
  toggleEntitlement,
  toggleProductActive,
} from "@/lib/actions/products";
import { EmptyState } from "@/components/empty-state";
import { Page, PageHeader } from "@/components/page-header";
import { requireAdmin } from "@/lib/session";
import { stripeConfigured } from "@/lib/stripe";
import { Button, Card, Input } from "@homeroom/ui";

export const metadata = { title: "Products — Admin" };
export const dynamic = "force-dynamic";

export default async function AdminProductsPage() {
  await requireAdmin();
  const [products, courses] = await Promise.all([
    db.product.findMany({
      orderBy: { createdAt: "asc" },
      include: { entitlements: true },
    }),
    db.course.findMany({ orderBy: { createdAt: "asc" } }),
  ]);

  return (
    <Page width="narrow">
      <PageHeader
        crumbs={[{ label: "Admin", href: "/admin" }, { label: "Products" }]}
        title="Products &amp; pricing"
        subtitle="A product grants access to courses. Set trial days here — that is what lets someone start before their old subscription ends."
      />
      {!stripeConfigured() && (
        <p className="mb-6 rounded-md bg-warn-soft p-3 text-sm text-warn">
          STRIPE_SECRET_KEY is not set — products created now won&apos;t have
          Stripe checkout until it is.
        </p>
      )}

      <section className="mb-10 space-y-4">
        {products.map((product) => (
          <div key={product.id} className="hr-card mb-4 p-5">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h2 className="font-semibold">
                  {product.name}{" "}
                  <span className="font-normal text-dim">
                    {formatPrice(product)}
                    {product.trialDays > 0 && ` · ${product.trialDays}-day trial`}
                  </span>
                </h2>
                <p className="text-xs text-dim">
                  {product.stripePriceId ?? "no Stripe price"}
                </p>
              </div>
              <form action={toggleProductActive.bind(null, product.id)}>
                <button
                  className={
                    product.active
                      ? "rounded bg-acc-soft px-2 py-1 text-xs text-acc"
                      : "rounded bg-soft px-2 py-1 text-xs text-dim"
                  }
                >
                  {product.active ? "active" : "inactive"}
                </button>
              </form>
            </div>
            <p className="mb-2 text-sm font-medium">Unlocks courses:</p>
            <div className="flex flex-wrap gap-2">
              {courses.map((course) => {
                const entitled = product.entitlements.some(
                  (e) => e.courseId === course.id,
                );
                return (
                  <form
                    key={course.id}
                    action={toggleEntitlement.bind(null, product.id, course.id)}
                  >
                    <button
                      className={
                        entitled
                          ? "rounded-full bg-acc px-3 py-1 text-xs text-acc-ink"
                          : "rounded-full border border-line px-3 py-1 text-xs text-dim hover:bg-soft"
                      }
                    >
                      {course.title}
                    </button>
                  </form>
                );
              })}
              {courses.length === 0 && (
                <span className="hr-ev">
                  No courses exist yet, so there is nothing to grant.
                </span>
              )}
            </div>
          </div>
        ))}
        {products.length === 0 && (
          <EmptyState
            glyph="⛁"
            title="No products yet"
            body="Until a course is attached to a product it is free for any signed-in member. Create one below to charge for access — and set trial days if people are arriving mid-subscription somewhere else."
          />
        )}
      </section>

      <Card className="mb-4 p-5">
        <h2 className="mb-4 text-[13px] font-semibold">New product</h2>
        <form action={createProduct} className="flex flex-col gap-3 text-sm">
          <Input
            name="name"
            placeholder="e.g. Revenue Engineer Membership"
            required
            
          />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 font-medium">
              Monthly price (USD)
              <Input
                name="price"
                type="number"
                step="0.01"
                min="1"
                required
                className="font-normal"
              />
            </label>
            <label className="flex flex-col gap-1 font-medium">
              Trial days (0 = none)
              <Input
                name="trialDays"
                type="number"
                defaultValue={0}
                min={0}
                className="font-normal"
              />
            </label>
          </div>
          <Button size="sm"className=" self-start">
            Create product{stripeConfigured() ? " in Stripe" : ""}
          </Button>
        </form>
      </Card>
    </Page>
  );
}
