import { Logo } from '@/components/brand/Logo/Logo';
import styles from './Header.module.css';

export function Header() {
  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <Logo />
      </div>
    </header>
  );
}
