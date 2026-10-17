interface IllustrationProps {
  size?: number;
  className?: string;
}

/** A browser window whose graphics chip is missing (dashed), with a red "no" badge. */
export function BrowserBlockedIllustration({ size = 88, className }: IllustrationProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 96 96" fill="none" aria-hidden="true" focusable="false" className={className}>
      <rect x="8" y="16" width="76" height="60" rx="12" fill="var(--color-bg)" stroke="var(--color-ink)" strokeWidth="2.5" />
      <path d="M8 30h76" stroke="var(--color-ink)" strokeWidth="2.5" />
      <circle cx="18.5" cy="23" r="2.25" fill="var(--color-ink)" />
      <circle cx="26" cy="23" r="2.25" fill="var(--color-ink-3)" />
      <circle cx="33.5" cy="23" r="2.25" fill="var(--color-ink-3)" />
      <rect x="36" y="43" width="20" height="20" rx="4.5" fill="var(--color-accent-soft)" stroke="var(--color-accent)" strokeWidth="2.25" strokeDasharray="4 3.4" />
      <path d="M41 38.5v-2.5M51 38.5v-2.5M41 70v-2.5M51 70v-2.5M31.5 48H29M31.5 58H29M63 48h-2.5M63 58h-2.5" stroke="var(--color-accent)" strokeWidth="2.25" strokeLinecap="round" />
      <circle cx="78" cy="72" r="12" fill="var(--color-bad)" stroke="var(--color-bg)" strokeWidth="3.5" />
      <path d="m74 68 8 8m0-8-8 8" stroke="var(--color-bg)" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}
