import * as React from "react";
import { cn } from "./cn";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "outline" | "ghost";
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50",
        variant === "default" && "bg-zinc-900 text-white hover:bg-zinc-700",
        variant === "outline" &&
          "border border-zinc-300 bg-transparent hover:bg-zinc-100",
        variant === "ghost" && "bg-transparent hover:bg-zinc-100",
        className,
      )}
      {...props}
    />
  ),
);
Button.displayName = "Button";
