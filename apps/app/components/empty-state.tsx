import Link from "next/link";
import { Button, Card } from "@homeroom/ui";

/**
 * An empty state is a decision point, not a dead end — it says what's missing,
 * why the screen is blank, and gives the one action that fixes it. A bare
 * "No courses yet." is the loudest unfinished signal an app can send.
 */
export function EmptyState({
  glyph = "◌",
  title,
  body,
  actionLabel,
  actionHref,
  children,
}: {
  glyph?: string;
  title: string;
  body: string;
  actionLabel?: string;
  actionHref?: string;
  children?: React.ReactNode;
}) {
  return (
    <Card className="flex flex-col items-center gap-3 px-6 py-12 text-center">
      <span
        aria-hidden
        className="grid h-10 w-10 place-items-center rounded-full bg-muted text-[16px] text-muted-foreground"
      >
        {glyph}
      </span>
      <h2 className="text-[15px] font-semibold text-foreground">{title}</h2>
      <p className="max-w-[46ch] text-[13px] leading-relaxed text-muted-foreground">
        {body}
      </p>
      {actionLabel && actionHref && (
        <Button asChild className="mt-1">
          <Link href={actionHref}>{actionLabel}</Link>
        </Button>
      )}
      {children}
    </Card>
  );
}
