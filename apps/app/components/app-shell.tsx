import Link from "next/link";
import { db } from "@homeroom/db";
import { getViewer } from "@/lib/session";
import { getBranding } from "@/lib/settings";
import { EnterPreviewButton, PreviewBar } from "./preview-bar";
import { Rail, type RailGroup } from "./rail";
import { SignOutButton } from "./sign-out-button";
import {
  AgentPaneSlot,
  AgentProvider,
  AgentSheetTrigger,
} from "./agent/provider";

/**
 * Console shell (docs/DESIGN.md §4). The rail is the only persistent
 * navigation; it collapses to glyphs and expands to explain itself.
 */
export async function AppShell({ children }: { children: React.ReactNode }) {
  const [{ user, previewing }, branding] = await Promise.all([
    getViewer(),
    getBranding(),
  ]);

  // Counts pull you toward work — recall that's due, drafts waiting.
  const [recallDue, draftsWaiting] = user
    ? await Promise.all([
        db.recallItem.count({
          where: { userId: user.id, dueAt: { lte: new Date() } },
        }),
        user.role === "ADMIN"
          ? db.agentSuggestion.count({ where: { status: "PENDING" } })
          : Promise.resolve(0),
      ])
    : [0, 0];

  const initials = branding.schoolName
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  const groups: RailGroup[] = [];

  if (user) {
    groups.push({
      title: "Practice",
      items: [
        {
          href: "/today",
          label: "Today",
          glyph: "●",
          hint: "One next thing, chosen for you",
        },
        {
          href: "/recall",
          label: "Recall",
          glyph: "↻",
          hint: "Quick checks on what you'd forget",
          badge: recallDue || undefined,
        },
        {
          href: "/capability",
          label: "Capability",
          glyph: "▤",
          hint: "What you've proven, and what's shaky",
        },
      ],
    });
  }

  groups.push({
    title: "School",
    items: [
      { href: "/courses", label: "Courses", glyph: "▷", hint: "Lessons and their exercises" },
      { href: "/community", label: "Community", glyph: "◇", hint: "Questions and discussion" },
      { href: "/events", label: "Events", glyph: "◉", hint: "Live sessions and recordings" },
    ],
  });

  if (user?.role === "ADMIN") {
    groups.push({
      title: "Teach",
      items: [
        { href: "/admin", label: "Admin", glyph: "◎", hint: "Courses, members, settings" },
        {
          href: "/admin/coach",
          label: "Coach",
          glyph: "◈",
          hint: "Where people are actually stuck",
        },
        {
          href: "/admin/suggestions",
          label: "Agent queue",
          glyph: "✎",
          hint: "Drafts waiting on your approval",
          badge: draftsWaiting || undefined,
        },
      ],
    });
  }

  const brand = (
    <Link
      href={user ? "/today" : "/"}
      aria-label={branding.schoolName}
      className="flex min-w-0 items-center gap-2"
    >
      <span className="grid h-[26px] w-[26px] shrink-0 place-items-center overflow-hidden rounded-[7px] bg-acc font-mono text-[11px] font-bold text-acc-ink">
        {branding.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={branding.logoUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          initials
        )}
      </span>
      <span className="hr-rail-name truncate text-[13px] font-semibold">
        {branding.schoolName}
      </span>
    </Link>
  );

  const footer = user ? (
    <>
      <span
        title={user.name}
        className="grid h-[26px] w-[26px] shrink-0 place-items-center rounded-full bg-soft text-[10px] font-bold text-dim"
      >
        {user.name.slice(0, 2).toUpperCase()}
      </span>
      {user.role === "ADMIN" && <EnterPreviewButton />}
      <SignOutButton />
    </>
  ) : (
    <Link
      href="/sign-in"
      title="Sign in"
      className="grid h-[31px] w-[31px] place-items-center rounded-[7px] text-[13px] text-dim hover:bg-soft"
    >
      →
    </Link>
  );

  return (
    // The provider sits above the rail because the mobile tutor trigger lives
    // in the rail's top bar; the pane itself draws in the content row below.
    <AgentProvider signedIn={Boolean(user)}>
      {/* Column on a phone (the rail becomes a top bar), row from lg where the
          rail is a real sidebar again. */}
      <div className="flex min-h-screen flex-col lg:flex-row">
        <Rail
          groups={groups}
          brand={brand}
          footer={footer}
          action={<AgentSheetTrigger />}
        />
        <div className="flex min-w-0 flex-1">
          {children}
          <AgentPaneSlot />
        </div>
        {previewing && <PreviewBar />}
      </div>
    </AgentProvider>
  );
}
