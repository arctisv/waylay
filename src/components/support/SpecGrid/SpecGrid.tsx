import styles from './SpecGrid.module.css';

export interface Spec {
  id: string;
  label?: string;
  value: string;
  note: string;
  /** Marks a value that falls short of what Waylay needs. */
  short?: boolean;
}

/** A row of muted tiles, each showing one fact. */
export function SpecGrid({ items }: { items: Spec[] }) {
  return (
    <ul className={styles.grid}>
      {items.map((item) => (
        <li key={item.id} className={styles.item}>
          {item.label ? <span className={styles.label}>{item.label}</span> : null}
          <span className={item.short ? `${styles.value} ${styles.short}` : styles.value}>{item.value}</span>
          <span className={styles.note}>{item.note}</span>
        </li>
      ))}
    </ul>
  );
}
