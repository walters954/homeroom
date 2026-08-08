import * as React from "react";
import { cn } from "./cn";

/**
 * A styled native <select> rather than the Radix listbox: every use in the app
 * is inside a server-action form, and a native control posts its value without
 * a hidden input or a client component.
 */
export function Select({ className, ...props }: React.ComponentProps<"select">) {
  return (
    <select
      className={cn(
        "w-full cursor-pointer rounded-[7px] border border-input bg-background px-3 py-2 text-[13px] text-foreground focus:outline-2 focus:-outline-offset-1 focus:outline-ring disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}
