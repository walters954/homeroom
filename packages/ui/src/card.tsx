import * as React from "react";
import { cn } from "./cn";

export function Card({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("rounded-[10px] border border-border bg-card", className)}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 border-b border-border px-4 py-3 text-[12.5px]",
        className,
      )}
      {...props}
    />
  );
}

export function CardTitle({ className, ...props }: React.ComponentProps<"span">) {
  return <span className={cn("font-semibold", className)} {...props} />;
}

export function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("p-4", className)} {...props} />;
}

export function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 border-t border-border bg-background px-4 py-3",
        className,
      )}
      {...props}
    />
  );
}

/** A list row inside a Card — the densest unit in the app. */
export function CardRow({ className, ...props }: React.ComponentProps<"li">) {
  return (
    <li
      className={cn(
        "flex items-center gap-3 border-b border-muted px-4 py-2.5 text-[12.5px] last:border-b-0",
        className,
      )}
      {...props}
    />
  );
}
