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
  // Start collapsed on the server so markup matches; restore the preference
  // after mount to avoid a hydration mismatch.
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    setExpanded(window.localStorage.getItem(STORAGE_KEY) === "1");
  }, []);

  function toggle() {
    setExpanded((v) => {
      window.localStorage.setItem(STORAGE_KEY, v ? "0" : "1");
      return !v;
    });
  }

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  return (
    <nav
      aria-label="Main"
      data-expanded={expanded}
      className={`sticky top-0 flex h-screen shrink-0 flex-col border-r border-line bg-panel py-3 transition-[width] duration-150 ${
        expanded ? "w-[232px] px-3" : "w-[52px] items-center px-0"
      }`}
    >
      <div className={`mb-3 flex items-center ${expanded ? "gap-2 px-1" : ""}`}>
        {brand}
      </div>

      <div className="flex flex-1 flex-col gap-4 overflow-y-auto">
        {groups.map((group) => (
          <div key={group.title} className="flex flex-col gap-0.5">
            {expanded && (
              <p className="hr-eyebrow mb-1 px-2">{group.title}</p>
            )}
            {group.items.map((item) => {
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={expanded ? undefined : `${item.label} — ${item.hint}`}
                  aria-label={item.label}
                  aria-current={active ? "page" : undefined}
                  className={
                    expanded
                      ? `flex items-start gap-2.5 rounded-[7px] px-2 py-2 ${
                          active ? "bg-acc-soft" : "hover:bg-soft"
                        }`
                      : `relative mx-auto grid h-[31px] w-[31px] place-items-center rounded-[7px] text-[13px] ${
                          active ? "bg-acc-soft text-acc" : "text-dim hover:bg-soft"
                        }`
                  }
                >
                  <span
                    className={
                      expanded
                        ? `mt-px text-[13px] leading-none ${active ? "text-acc" : "text-dim"}`
                        : ""
                    }
                    aria-hidden
                  >
                    {item.glyph}
                  </span>

                  {expanded ? (
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span
                          className={`text-[13px] font-medium ${active ? "text-acc" : "text-ink"}`}
                        >
                          {item.label}
                        </span>
                        {item.badge ? (
                          <span className="hr-tag hr-tag-shaky ml-auto shrink-0">
                            {item.badge}
                          </span>
                        ) : null}
                      </span>
                      <span className="mt-0.5 block text-[11px] leading-snug text-dim">
                        {item.hint}
                      </span>
                    </span>
                  ) : item.badge ? (
                    <span
                      aria-hidden
                      className="absolute right-0.5 top-0.5 h-1.5 w-1.5 rounded-full bg-warn"
                    />
                  ) : null}
                </Link>
              );
            })}
          </div>
        ))}
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
  );
}
