interface IllustrationProps {
  size?: number;
  className?: string;
}

/** A browser window whose graphics chip is greyed out, with a red "no" badge. */
export function BrowserBlockedIllustration({ size = 88, className }: IllustrationProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 96 96" fill="none" aria-hidden="true" focusable="false" className={className}>
      <rect x="6" y="14" width="80" height="64" rx="16" fill="var(--color-surface-2)" />
      <circle cx="18" cy="24" r="2.75" fill="var(--color-ink)" />
      <circle cx="26.5" cy="24" r="2.75" fill="var(--color-ink-3)" />
      <circle cx="35" cy="24" r="2.75" fill="var(--color-ink-3)" />
      <rect x="12" y="33" width="68" height="39" rx="10" fill="var(--color-bg)" />
      <path
        d="M41 39.5v3M51 39.5v3M41 62.5v3M51 62.5v3M33.5 47h3M33.5 57h3M55.5 47h3M55.5 57h3"
        stroke="var(--color-accent)"
        strokeOpacity="0.35"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <rect x="37" y="43" width="18" height="18" rx="5" fill="var(--color-accent-soft)" />
      <rect x="42" y="48" width="8" height="8" rx="2.5" fill="var(--color-accent)" fillOpacity="0.35" />
      <circle cx="79" cy="73" r="12.5" fill="var(--color-bad)" stroke="var(--color-bg)" strokeWidth="3.5" />
      <path d="m75 69 8 8m0-8-8 8" stroke="var(--color-bg)" strokeWidth="2.75" strokeLinecap="round" />
    </svg>
  );
}
