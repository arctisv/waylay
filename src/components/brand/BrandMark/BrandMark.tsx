import styles from './BrandMark.module.css';

/** The W mark drawn large and faint as the page backdrop. Each stroke draws itself in on load. */
export function BrandMark() {
  return (
    <svg className={styles.mark} viewBox="14 22 76 56" fill="none" aria-hidden="true" focusable="false">
      <g strokeWidth="11" strokeLinecap="round" strokeLinejoin="round">
        <path className={styles.stroke} d="M22 32 L38 68 L49 43.25" stroke="var(--color-surface-2)" pathLength={1} />
        <path className={`${styles.stroke} ${styles.late}`} d="M46 32 L62 68 L78 32" stroke="var(--color-bg)" strokeWidth="18" pathLength={1} />
        <path className={`${styles.stroke} ${styles.late}`} d="M46 32 L62 68 L78 32" stroke="var(--color-accent-soft)" pathLength={1} />
      </g>
    </svg>
  );
}
