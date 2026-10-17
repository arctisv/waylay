import type { StreamdownProps } from "streamdown";

import { cn } from "@/lib/utils";

/* Tables for assistant prose, replacing Streamdown's default (double
   frame, padded gutter, controls rows). One filled box in the house
   style: a tinted rounded container, a header band a step darker with
   muted normal-case labels, and alternate rows a shade apart — no rules,
   no shadows, no footer bar. Wide tables scroll sideways inside the box;
   columns never squeeze below their content's word width. */

export const TABLE_COMPONENTS: NonNullable<StreamdownProps["components"]> = {
  table: ({ node: _node, className, children, ...props }) => (
    <div className="my-4 w-full overflow-hidden rounded-2xl bg-well">
      <div className="w-full overflow-x-auto [scrollbar-width:thin]">
        <table
          className={cn("w-full border-collapse text-[14px]/6", className)}
          {...props}
        >
          {children}
        </table>
      </div>
    </div>
  ),
  thead: ({ node: _node, className, ...props }) => (
    <thead className={cn("bg-black/[0.035] dark:bg-white/[0.04]", className)} {...props} />
  ),
  tbody: ({ node: _node, className, ...props }) => (
    <tbody className={className} {...props} />
  ),
  tr: ({ node: _node, className, ...props }) => (
    <tr
      className={cn("even:bg-black/[0.02] dark:even:bg-white/[0.02]", className)}
      {...props}
    />
  ),
  th: ({ node: _node, className, ...props }) => (
    <th
      className={cn(
        "px-4 py-2.5 text-left align-bottom text-[13.5px]/5 font-medium text-muted-foreground",
        className,
      )}
      {...props}
    />
  ),
  td: ({ node: _node, className, ...props }) => (
    <td
      className={cn("px-4 py-2.5 align-top", className)}
      {...props}
    />
  ),
};
