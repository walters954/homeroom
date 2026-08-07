import Link from "next/link";
import { getCurrentUser } from "@/lib/session";
import { getBranding } from "@/lib/settings";
import { RailLink } from "./rail-link";
import { SignOutButton } from "./sign-out-button";

/**
 * Console shell (docs/DESIGN.md §4): a narrow icon rail, then the page. The
 * rail is the only persistent navigation — pages own everything else.
 */
export async function AppShell({ children }: { children: React.ReactNode }) {
  const [user, branding] = await Promise.all([getCurrentUser(), getBranding()]);

  const initials = branding.schoolName
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  return (
    <div className="grid min-h-screen grid-cols-[52px_minmax(0,1fr)]">
      <nav className="flex flex-col items-center gap-1 border-r border-line bg-panel py-3">
        <Link
          href="/"
          aria-label={branding.schoolName}
          className="mb-3 grid h-[26px] w-[26px] place-items-center rounded-[7px] bg-acc font-mono text-[11px] font-bold text-acc-ink"
        >
          {branding.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={branding.logoUrl} alt="" className="h-full w-full rounded-[7px] object-cover" />
          ) : (
            initials
          )}
        </Link>

        <RailLink href="/courses" label="Courses" glyph="▷" />
        <RailLink href="/community" label="Community" glyph="◇" />
        <RailLink href="/events" label="Events" glyph="◉" />
        {user?.role === "ADMIN" && (
          <>
            <span className="my-1 h-px w-6 bg-line" />
            <RailLink href="/admin" label="Admin" glyph="◎" />
            <RailLink href="/admin/suggestions" label="Agent queue" glyph="✎" />
          </>
        )}

        <div className="mt-auto flex flex-col items-center gap-2">
          {user ? (
            <>
              <span
                title={user.name}
                className="grid h-[26px] w-[26px] place-items-center rounded-full bg-soft text-[10px] font-bold text-dim"
              >
                {user.name.slice(0, 2).toUpperCase()}
              </span>
              <SignOutButton />
            </>
          ) : (
            <Link
              href="/sign-in"
              className="grid h-[31px] w-[31px] place-items-center rounded-[7px] text-[13px] text-dim hover:bg-soft"
              title="Sign in"
            >
              →
            </Link>
          )}
        </div>
      </nav>

      <div className="min-w-0">{children}</div>
    </div>
  );
}
