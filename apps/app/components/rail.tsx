"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Badge,
  Button,
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@homeroom/ui";
import { ChevronLeft, ChevronRight, Menu } from "lucide-react";

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
            <Badge variant="shaky" className="ml-auto shrink-0">
              {item.badge}
            </Badge>
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
  action,
}: {
  groups: RailGroup[];
  brand: React.ReactNode;
  footer: React.ReactNode;
  /** Sits beside the menu button on the mobile top bar — the tutor trigger. */
  action?: React.ReactNode;
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
          <Button
            variant="ghost"
            size="icon"
            onClick={toggle}
            aria-expanded={expanded}
            aria-label={expanded ? "Collapse sidebar" : "Expand sidebar"}
            title={expanded ? "Collapse sidebar" : "Expand sidebar"}
            className={expanded ? "ml-auto" : ""}
          >
            {expanded ? (
              <ChevronLeft className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </Button>
        </div>
      </nav>

      {/* Mobile: a bar that stays out of the way, and the same navigation
          behind it. The badge count surfaces on the button so a member sees
          there is something waiting without opening anything. */}
      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <header className="sticky top-0 z-30 flex items-center gap-2 border-b border-border bg-card px-4 py-2.5 lg:hidden">
          {brand}
          <div className="ml-auto flex items-center gap-0.5">
            {action}
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Open navigation"
                className="relative h-[34px] w-[34px]"
              >
                <Menu className="h-4 w-4" />
                {pending > 0 && (
                  <span
                    aria-hidden
                    className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-warn"
                  />
                )}
              </Button>
            </SheetTrigger>
          </div>
        </header>

        <SheetContent side="left" className="lg:hidden">
          <div className="flex items-center gap-2 px-1">
            {brand}
            <SheetTitle className="sr-only">Navigation</SheetTitle>
          </div>

          <div className="flex flex-1 flex-col gap-4">
            <RailGroups groups={groups} onNavigate={() => setMenuOpen(false)} />
          </div>

          <div className="flex items-center gap-2 border-t border-border pt-3">
            {footer}
          </div>
        </SheetContent>
      </Sheet>

    </>
  );
}
