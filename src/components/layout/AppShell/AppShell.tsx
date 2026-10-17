import type { ReactNode } from 'react';
import { Header } from '@/components/layout/Header/Header';
import type { SupportStatus } from '@/lib/device/types';
import styles from './AppShell.module.css';

export function AppShell({ status, children }: { status: SupportStatus; children: ReactNode }) {
  return (
    <div className={styles.shell}>
      <Header status={status} />
      <main className={styles.main}>{children}</main>
    </div>
  );
}
