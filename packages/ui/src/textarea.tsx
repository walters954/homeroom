import * as React from "react";
import { cn } from "./cn";

export function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      className={cn(
        "w-full rounded-[7px] border border-input bg-background px-3 py-2 text-[13px] text-foreground placeholder:text-muted-foreground focus:outline-2 focus:-outline-offset-1 focus:outline-ring disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}
