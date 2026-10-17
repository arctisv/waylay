import type { SupportStatus } from '@/lib/device/types';
import styles from './StatusPill.module.css';

const LABELS: Record<SupportStatus, { tone: 'neutral' | 'ok' | 'bad'; text: string }> = {
  checking: { tone: 'neutral', text: 'Checking device' },
  ready: { tone: 'ok', text: 'Runs on this device' },
  'unsupported-browser': { tone: 'bad', text: 'Browser not supported' },
  'unsupported-device': { tone: 'bad', text: 'Device not supported' },
};

export function StatusPill({ status }: { status: SupportStatus }) {
  const { tone, text } = LABELS[status];
  return (
    <span className={`${styles.pill} ${styles[tone]}`} role="status">
      <span className={styles.dot} aria-hidden="true" />
      {text}
    </span>
  );
}
