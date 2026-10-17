import type { ReactNode } from 'react';
import styles from './UnsupportedScreen.module.css';

interface UnsupportedScreenProps {
  title: string;
  description: string;
  details: ReactNode;
  actions: ReactNode;
}

/** Shared layout for every "Waylay can't run here" screen. */
export function UnsupportedScreen({ title, description, details, actions }: UnsupportedScreenProps) {
  return (
    <section className={styles.screen}>
      <div className={styles.inner}>
        <div className={styles.intro}>
          <p className={styles.status}>Not compatible</p>
          <h1 className={styles.title}>{title}</h1>
          <p className={styles.description}>{description}</p>
        </div>
        <div className={styles.details}>{details}</div>
        <div className={styles.actions}>{actions}</div>
      </div>
    </section>
  );
}
