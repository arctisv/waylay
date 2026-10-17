"use client";

import type { CSSProperties } from "react";

import { ACCENT_OPTIONS, type Accent } from "@/lib/accent";
import { cn } from "@/lib/utils";

/* A row of paint dabs, one per accent, each tinted for whichever mode is
   active via a pair of inline swatch vars. The picked one carries a dot
   punched out in the surface tone, which reads on pale and dark dabs
   alike. */
export function AccentPicker({
  value,
  onChange,
  "aria-label": ariaLabel,
}: {
  value: Accent;
  onChange: (value: Accent) => void;
  "aria-label"?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className="flex flex-wrap gap-3"
    >
      {ACCENT_OPTIONS.map(({ value: option, label, swatch }) => {
        const selected = value === option;
        return (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={label}
            title={label}
            onClick={() => onChange(option)}
            style={
              {
                "--swatch-light": swatch.light,
                "--swatch-dark": swatch.dark,
              } as CSSProperties
            }
            className="flex size-8 cursor-pointer items-center justify-center rounded-full bg-(--swatch-light) transition-[scale] duration-150 hover:scale-110 active:scale-95 dark:bg-(--swatch-dark)"
          >
            <span
              className={cn(
                "size-2.5 rounded-full bg-surface transition-[scale,opacity] duration-150",
                selected ? "scale-100 opacity-100" : "scale-50 opacity-0",
              )}
            />
          </button>
        );
      })}
    </div>
  );
}
