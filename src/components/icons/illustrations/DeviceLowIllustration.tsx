interface IllustrationProps {
  size?: number;
  className?: string;
}

/** A phone whose power gauge reads low, with a red warning badge. */
export function DeviceLowIllustration({ size = 88, className }: IllustrationProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 96 96" fill="none" aria-hidden="true" focusable="false" className={className}>
      <rect x="24" y="6" width="42" height="80" rx="11" fill="var(--color-bg)" stroke="var(--color-ink)" strokeWidth="2.5" />
      <path d="M40 13.5h10" stroke="var(--color-ink)" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M32 52a13 13 0 0 1 26 0" stroke="var(--color-line-strong)" strokeWidth="5" strokeLinecap="round" />
      <path d="M32 52a13 13 0 0 1 3.8-9.2" stroke="var(--color-bad)" strokeWidth="5" strokeLinecap="round" />
      <path d="m45 52-7.5-5" stroke="var(--color-ink)" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="45" cy="52" r="3" fill="var(--color-ink)" />
      <path d="M35 64h20M38 70.5h14" stroke="var(--color-line-strong)" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="68" cy="74" r="12" fill="var(--color-bad)" stroke="var(--color-bg)" strokeWidth="3.5" />
      <path d="M68 68v6.5" stroke="var(--color-bg)" strokeWidth="2.75" strokeLinecap="round" />
      <circle cx="68" cy="79.25" r="1.6" fill="var(--color-bg)" />
    </svg>
  );
}
