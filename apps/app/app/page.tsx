import Link from "next/link";
import { getBranding } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const branding = await getBranding();
  return (
    <main className="mx-auto flex min-h-[70vh] max-w-2xl flex-col items-start justify-center gap-6 px-6">
      <h1 className="text-4xl font-bold tracking-tight">
        {branding.schoolName}
      </h1>
      {branding.tagline && (
        <p className="text-lg text-dim">{branding.tagline}</p>
      )}
      <div className="flex gap-3">
        <Link
          href="/courses"
          className="rounded-md bg-acc px-5 py-2.5 text-sm font-medium text-acc-ink hover:opacity-90"
        >
          Browse courses
        </Link>
        <Link
          href="/community"
          className="rounded-md border border-line px-5 py-2.5 text-sm font-medium hover:bg-soft"
        >
          Community
        </Link>
      </div>
    </main>
  );
}
