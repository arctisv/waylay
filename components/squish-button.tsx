import type { ButtonHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

/* Squish pill: a flat fill of the accent. Press feedback is a scale dip;
   `scale` is a standalone CSS property in Tailwind v4, so the transition
   names it explicitly. */
export function SquishButton({
  className = "",
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={cn(
        "inline-flex cursor-pointer items-center justify-start gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-[background-color,scale] duration-150 ease-out hover:bg-(--primary-hover) active:scale-[0.96]",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
