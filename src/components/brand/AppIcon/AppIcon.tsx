// Mirrors src/assets/brand/app-icon.svg, which the favicon and PWA icons are generated from.
const INK = '#0E1014';
const MARK = '#FFFFFF';
const ACCENT = '#7C8CFF';

interface AppIconProps {
  size?: number;
  className?: string;
  /** Gives the icon an accessible name. Without one it is decorative. */
  title?: string;
}

/** The Waylay app icon: two Vs forming a W, the left one tucked under the right. */
export function AppIcon({ size = 32, className, title }: AppIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={className}
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      focusable="false"
    >
      {title ? <title>{title}</title> : null}
      <rect width="100" height="100" rx="23" fill={INK} />
      <g fill="none" strokeWidth="11" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 32 L38 68 L49 43.25" stroke={MARK} />
        <path d="M46 32 L62 68 L78 32" stroke={INK} strokeWidth="18" />
        <path d="M46 32 L62 68 L78 32" stroke={ACCENT} />
      </g>
    </svg>
  );
}
