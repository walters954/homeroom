import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "./cn";

/**
 * Status vocabulary, not decoration: proven / shaky / untested / fail map to
 * the four things the product ever asserts about a person or a record.
 */
const badgeVariants = cva(
  "inline-flex items-center rounded-[4px] px-2 py-[3px] text-[10px] font-bold tracking-[0.03em]",
  {
    variants: {
      variant: {
        proven: "bg-acc-soft text-acc",
        shaky: "bg-warn-soft text-warn",
        untested: "bg-muted text-muted-foreground",
        fail: "bg-fail-soft text-fail",
      },
    },
    defaultVariants: { variant: "untested" },
  },
);

export function Badge({
  className,
  variant,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { badgeVariants };
