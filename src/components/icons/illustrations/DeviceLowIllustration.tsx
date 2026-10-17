interface IllustrationProps {
  size?: number;
  className?: string;
}

/** A phone whose power gauge reads low, with a red warning badge. */
export function DeviceLowIllustration({ size = 88, className }: IllustrationProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 96 96" fill="none" aria-hidden="true" focusable="false" className={className}>
      <rect x="22" y="4" width="46" height="86" rx="14" fill="var(--color-surface-2)" />
      <rect x="39" y="9" width="12" height="3.5" rx="1.75" fill="var(--color-ink-3)" />
      <rect x="27" y="17" width="36" height="67" rx="8" fill="var(--color-bg)" />
      <path d="M34 50a11 11 0 0 1 22 0" stroke="var(--color-surface-2)" strokeWidth="5" strokeLinecap="round" />
      <path d="M34 50a11 11 0 0 1 3.2-7.8" stroke="var(--color-bad)" strokeWidth="5" strokeLinecap="round" />
      <path d="m45 50-7-4.5" stroke="var(--color-ink)" strokeWidth="2.75" strokeLinecap="round" />
      <circle cx="45" cy="50" r="3" fill="var(--color-ink)" />
      <rect x="35" y="61" width="20" height="3.5" rx="1.75" fill="var(--color-surface-2)" />
      <rect x="38" y="68" width="14" height="3.5" rx="1.75" fill="var(--color-surface-2)" />
      <circle cx="68" cy="75" r="12.5" fill="var(--color-bad)" stroke="var(--color-bg)" strokeWidth="3.5" />
      <path d="M68 69v6.5" stroke="var(--color-bg)" strokeWidth="2.75" strokeLinecap="round" />
      <circle cx="68" cy="80.25" r="1.6" fill="var(--color-bg)" />
    </svg>
  );
}
