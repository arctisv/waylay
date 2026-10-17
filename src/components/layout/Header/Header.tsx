import { Logo } from '@/components/brand/Logo/Logo';
import { StatusPill } from '@/components/ui/StatusPill/StatusPill';
import type { SupportStatus } from '@/lib/device/types';
import styles from './Header.module.css';

export function Header({ status }: { status: SupportStatus }) {
  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <Logo />
        <StatusPill status={status} />
      </div>
    </header>
  );
}
