import Link from "next/link";
import { db } from "@homeroom/db";
import { formatPrice } from "@/lib/access";
import {
  createProduct,
  toggleEntitlement,
  toggleProductActive,
} from "@/lib/actions/products";
import { requireAdmin } from "@/lib/session";
import { stripeConfigured } from "@/lib/stripe";

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
    <main className="mx-auto max-w-3xl px-6 py-10">
      <p className="mb-2 text-sm text-zinc-500">
        <Link href="/admin" className="hover:underline">
          Admin
        </Link>
      </p>
      <h1 className="mb-2 text-3xl font-bold tracking-tight">Products</h1>
      {!stripeConfigured() && (
        <p className="mb-6 rounded-md bg-amber-50 p-3 text-sm text-amber-800">
          STRIPE_SECRET_KEY is not set — products created now won&apos;t have
          Stripe checkout until it is.
        </p>
      )}

      <section className="mb-10 space-y-4">
        {products.map((product) => (
          <div key={product.id} className="rounded-lg border border-zinc-200 p-5">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h2 className="font-semibold">
                  {product.name}{" "}
                  <span className="font-normal text-zinc-500">
                    {formatPrice(product)}
                    {product.trialDays > 0 && ` · ${product.trialDays}-day trial`}
                  </span>
                </h2>
                <p className="text-xs text-zinc-400">
                  {product.stripePriceId ?? "no Stripe price"}
                </p>
              </div>
              <form action={toggleProductActive.bind(null, product.id)}>
                <button
                  className={
                    product.active
                      ? "rounded bg-green-100 px-2 py-1 text-xs text-green-800"
                      : "rounded bg-zinc-100 px-2 py-1 text-xs text-zinc-500"
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
                          ? "rounded-full bg-zinc-900 px-3 py-1 text-xs text-white"
                          : "rounded-full border border-zinc-300 px-3 py-1 text-xs text-zinc-600 hover:bg-zinc-100"
                      }
                    >
                      {course.title}
                    </button>
                  </form>
                );
              })}
              {courses.length === 0 && (
                <span className="text-sm text-zinc-400">No courses yet.</span>
              )}
            </div>
          </div>
        ))}
        {products.length === 0 && (
          <p className="text-sm text-zinc-500">
            No products yet. Courses without a product are free for any
            signed-in member.
          </p>
        )}
      </section>

      <section className="rounded-lg border border-zinc-200 p-5">
        <h2 className="mb-4 text-lg font-semibold">New product</h2>
        <form action={createProduct} className="flex flex-col gap-3 text-sm">
          <input
            name="name"
            placeholder="e.g. Revenue Engineer Membership"
            required
            className="rounded-md border border-zinc-300 px-3 py-2"
          />
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 font-medium">
              Monthly price (USD)
              <input
                name="price"
                type="number"
                step="0.01"
                min="1"
                required
                className="rounded-md border border-zinc-300 px-3 py-2 font-normal"
              />
            </label>
            <label className="flex flex-col gap-1 font-medium">
              Trial days (0 = none)
              <input
                name="trialDays"
                type="number"
                defaultValue={0}
                min={0}
                className="rounded-md border border-zinc-300 px-3 py-2 font-normal"
              />
            </label>
          </div>
          <button className="self-start rounded-md bg-zinc-900 px-4 py-2 font-medium text-white hover:bg-zinc-700">
            Create product{stripeConfigured() ? " in Stripe" : ""}
          </button>
        </form>
      </section>
    </main>
  );
}
