import type { ReactNode } from 'react';
import { BrandMark } from '@/components/brand/BrandMark/BrandMark';
import { Header } from '@/components/layout/Header/Header';
import styles from './AppShell.module.css';

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className={styles.shell}>
      <BrandMark />
      <Header />
      <main className={styles.main}>{children}</main>
    </div>
  );
}
