import * as React from "react";
import { cn } from "./cn";

export function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      className={cn(
        "w-full rounded-[7px] border border-input bg-background px-3 py-2 text-[13px] text-foreground placeholder:text-muted-foreground focus:outline-2 focus:-outline-offset-1 focus:outline-ring disabled:opacity-50",
        "file:mr-3 file:rounded-[6px] file:border file:border-input file:bg-card file:px-3 file:py-1 file:text-[11.5px] file:text-foreground",
        className,
      )}
      {...props}
    />
  );
}
