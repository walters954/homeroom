"use client";

import * as React from "react";
import * as LabelPrimitive from "@radix-ui/react-label";
import { cn } from "./cn";

/** The eyebrow treatment is the Console form label — small, tracked, dim. */
export function Label({
  className,
  ...props
}: React.ComponentProps<typeof LabelPrimitive.Root>) {
  return (
    <LabelPrimitive.Root
      className={cn(
        "mb-1 block text-[10px] font-bold uppercase tracking-[0.13em] text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}
