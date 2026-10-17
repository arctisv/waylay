import type { ReactNode, SVGProps } from 'react';

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'children'> {
  size?: number;
  /** Gives the icon an accessible name. Without one it is hidden from screen readers. */
  title?: string;
}

/** Base for every glyph: a 24×24 grid drawn with round 1.75px strokes in the current text colour. */
export function Icon({ size = 20, title, children, ...rest }: IconProps & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      focusable="false"
      {...rest}
    >
      {title ? <title>{title}</title> : null}
      {children}
    </svg>
  );
}
