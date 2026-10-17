import { AppIcon } from '../AppIcon/AppIcon';
import styles from './Logo.module.css';

export function Logo() {
  return (
    <span className={styles.logo}>
      <AppIcon size={30} className={styles.icon} />
      <span className={styles.wordmark}>waylay</span>
    </span>
  );
}
