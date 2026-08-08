"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

export interface RailItem {
  href: string;
  label: string;
  glyph: string;
  /** One line explaining what the destination is for, shown when expanded. */
  hint: string;
  /** Optional count — recall due, drafts waiting. Shown as a dot when collapsed. */
  badge?: number;
}

export interface RailGroup {
  title: string;
  items: RailItem[];
}

const STORAGE_KEY = "hr-rail-expanded";

function useIsActive() {
  const pathname = usePathname();
  return (href: string) => pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * The labelled form of a destination — used by the expanded desktop rail and by
 * the mobile drawer, which want identical content and differ only in chrome.
 */
function RailLink({
  item,
  active,
  onNavigate,
}: {
  item: RailItem;
  active: boolean;
  onNavigate?: () => void;
}) {
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={`flex items-start gap-2.5 rounded-[7px] px-2 py-2 ${
        active ? "bg-acc-soft" : "hover:bg-soft"
      }`}
    >
      <span
        aria-hidden
        className={`mt-px text-[13px] leading-none ${active ? "text-acc" : "text-dim"}`}
      >
        {item.glyph}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span
            className={`text-[13px] font-medium ${active ? "text-acc" : "text-ink"}`}
          >
            {item.label}
          </span>
          {item.badge ? (
            <span className="hr-tag hr-tag-shaky ml-auto shrink-0">{item.badge}</span>
          ) : null}
        </span>
        <span className="mt-0.5 block text-[11px] leading-snug text-dim">
          {item.hint}
        </span>
      </span>
    </Link>
  );
}

function RailGroups({
  groups,
  onNavigate,
}: {
  groups: RailGroup[];
  onNavigate?: () => void;
}) {
  const isActive = useIsActive();
  return (
    <>
      {groups.map((group) => (
        <div key={group.title} className="flex flex-col gap-0.5">
          <p className="hr-eyebrow mb-1 px-2">{group.title}</p>
          {group.items.map((item) => (
            <RailLink
              key={item.href}
              item={item}
              active={isActive(item.href)}
              onNavigate={onNavigate}
            />
          ))}
        </div>
      ))}
    </>
  );
}

export function Rail({
  groups,
  brand,
  footer,
}: {
  groups: RailGroup[];
  brand: React.ReactNode;
  footer: React.ReactNode;
}) {
  const pathname = usePathname();
  const isActive = useIsActive();
  // Start collapsed on the server so markup matches; restore the preference
  // after mount to avoid a hydration mismatch.
  const [expanded, setExpanded] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setExpanded(window.localStorage.getItem(STORAGE_KEY) === "1");
  }, []);

  // A drawer that survives navigation would cover the page you just asked for.
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", onKey);
    // Stop the page scrolling underneath the drawer.
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [menuOpen]);

  function toggle() {
    setExpanded((v) => {
      window.localStorage.setItem(STORAGE_KEY, v ? "0" : "1");
      return !v;
    });
  }

  const pending = groups.reduce(
    (n, g) => n + g.items.reduce((m, i) => m + (i.badge ?? 0), 0),
    0,
  );

  return (
    <>
      {/* Desktop: the persistent rail. Below lg it would eat a seventh of the
          viewport with no way to dismiss it, so the drawer takes over. */}
      <nav
        aria-label="Main"
        data-expanded={expanded}
        className={`sticky top-0 hidden h-screen shrink-0 flex-col border-r border-line bg-panel py-3 transition-[width] duration-150 lg:flex ${
          expanded ? "w-[232px] px-3" : "w-[52px] items-center px-0"
        }`}
      >
        <div className={`mb-3 flex items-center ${expanded ? "gap-2 px-1" : ""}`}>
          {brand}
        </div>

        <div className="flex flex-1 flex-col gap-4 overflow-y-auto">
          {expanded ? (
            <RailGroups groups={groups} />
          ) : (
            groups.map((group) => (
              <div key={group.title} className="flex flex-col gap-0.5">
                {group.items.map((item) => {
                  const active = isActive(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      title={`${item.label} — ${item.hint}`}
                      aria-label={item.label}
                      aria-current={active ? "page" : undefined}
                      className={`relative mx-auto grid h-[31px] w-[31px] place-items-center rounded-[7px] text-[13px] ${
                        active ? "bg-acc-soft text-acc" : "text-dim hover:bg-soft"
                      }`}
                    >
                      <span aria-hidden>{item.glyph}</span>
                      {item.badge ? (
                        <span
                          aria-hidden
                          className="absolute right-0.5 top-0.5 h-1.5 w-1.5 rounded-full bg-warn"
                        />
                      ) : null}
                    </Link>
                  );
                })}
              </div>
            ))
          )}
        </div>

        <div
          className={`mt-3 flex ${expanded ? "items-center gap-2" : "flex-col items-center gap-2"}`}
        >
          {footer}
          <button
            type="button"
            onClick={toggle}
            aria-expanded={expanded}
            aria-label={expanded ? "Collapse sidebar" : "Expand sidebar"}
            title={expanded ? "Collapse sidebar" : "Expand sidebar"}
            className={`grid h-[31px] w-[31px] shrink-0 place-items-center rounded-[7px] text-[13px] text-dim hover:bg-soft ${
              expanded ? "ml-auto" : ""
            }`}
          >
            {expanded ? "«" : "»"}
          </button>
        </div>
      </nav>

      {/* Mobile: a bar that stays out of the way, and the same navigation
          behind it. The badge count surfaces on the button so a member sees
          there is something waiting without opening anything. */}
      <header className="sticky top-0 z-30 flex items-center gap-2 border-b border-line bg-panel px-4 py-2.5 lg:hidden">
        {brand}
        <button
          type="button"
          onClick={() => setMenuOpen(true)}
          aria-label="Open navigation"
          aria-expanded={menuOpen}
          className="relative ml-auto grid h-[34px] w-[34px] shrink-0 place-items-center rounded-[7px] text-[15px] text-dim hover:bg-soft"
        >
          <span aria-hidden>☰</span>
          {pending > 0 && (
            <span
              aria-hidden
              className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-warn"
            />
          )}
        </button>
      </header>

      {menuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            onClick={() => setMenuOpen(false)}
            className="absolute inset-0 bg-ink/40"
          />
          <nav
            aria-label="Main"
            className="absolute inset-y-0 left-0 flex w-[280px] max-w-[85vw] flex-col gap-4 overflow-y-auto border-r border-line bg-panel p-3"
          >
            <div className="flex items-center gap-2 px-1">
              {brand}
              <button
                type="button"
                onClick={() => setMenuOpen(false)}
                aria-label="Close navigation"
                className="ml-auto grid h-[31px] w-[31px] shrink-0 place-items-center rounded-[7px] text-[13px] text-dim hover:bg-soft"
              >
                ✕
              </button>
            </div>

            <div className="flex flex-1 flex-col gap-4">
              <RailGroups groups={groups} onNavigate={() => setMenuOpen(false)} />
            </div>

            <div className="flex items-center gap-2 border-t border-line pt-3">
              {footer}
            </div>
          </nav>
        </div>
      )}
    </>
  );
}
