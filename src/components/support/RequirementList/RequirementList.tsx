import { CheckIcon, CrossIcon } from '@/components/icons';
import styles from './RequirementList.module.css';

export interface Requirement {
  id: string;
  label: string;
  detail?: string;
  value?: string;
  /** `ok` and `bad` describe this device; `info` marks a neutral option, like a supported browser. */
  tone: 'ok' | 'bad' | 'info';
}

export function RequirementList({ items }: { items: Requirement[] }) {
  return (
    <ul className={styles.list}>
      {items.map((item) => (
        <li key={item.id} className={styles.row}>
          <span className={`${styles.status} ${styles[item.tone]}`}>
            {item.tone === 'bad' ? (
              <CrossIcon size={14} strokeWidth={2.5} title="Not met" />
            ) : (
              <CheckIcon size={14} strokeWidth={2.5} title={item.tone === 'ok' ? 'Met' : undefined} />
            )}
          </span>
          <span className={styles.text}>
            <span className={styles.label}>{item.label}</span>
            {item.detail ? <span className={styles.detail}>{item.detail}</span> : null}
          </span>
          {item.value ? <span className={styles.value}>{item.value}</span> : null}
        </li>
      ))}
    </ul>
  );
}
