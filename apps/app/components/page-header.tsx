import Link from "next/link";

export interface Crumb {
  label: string;
  href?: string;
}

/**
 * One page-header pattern everywhere: breadcrumb, title, a sentence of
 * context, and an actions slot on the right. Without this every page invents
 * its own vertical rhythm, which is most of what makes an app feel unfinished.
 */
export function PageHeader({
  crumbs,
  title,
  subtitle,
  actions,
}: {
  crumbs?: Crumb[];
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  return (
    <header className="mb-6 border-b border-line pb-5 md:mb-7 md:pb-6">
      {crumbs && crumbs.length > 0 && (
        <nav aria-label="Breadcrumb" className="hr-path mb-2 flex flex-wrap items-center gap-1.5">
          {crumbs.map((c, i) => (
            <span key={`${c.label}-${i}`} className="flex items-center gap-1.5">
              {i > 0 && <span aria-hidden className="text-dim/60">/</span>}
              {c.href ? (
                <Link href={c.href} className="hover:text-ink">
                  {c.label}
                </Link>
              ) : (
                <span>{c.label}</span>
              )}
            </span>
          ))}
        </nav>
      )}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="hr-title">{title}</h1>
          {subtitle && <p className="hr-sub mt-1.5">{subtitle}</p>}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}

/** Standard page container so every screen shares one measure and rhythm. */
export function Page({
  children,
  width = "wide",
}: {
  children: React.ReactNode;
  width?: "narrow" | "wide";
}) {
  return (
    // 32px of gutter on a phone is a third of the readable width — the padding
    // has to scale or every screen reads as a desktop page shrunk down.
    <main
      className={`mx-auto w-full px-4 py-6 sm:px-6 md:px-8 md:py-9 ${
        width === "narrow" ? "max-w-3xl" : "max-w-5xl"
      }`}
    >
      {children}
    </main>
  );
}
