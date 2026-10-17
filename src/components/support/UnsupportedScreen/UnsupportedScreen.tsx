import type { ReactNode } from 'react';
import styles from './UnsupportedScreen.module.css';

interface UnsupportedScreenProps {
  illustration: ReactNode;
  eyebrow: string;
  title: string;
  description: string;
  listTitle: string;
  list: ReactNode;
  hint: string;
  actions: ReactNode;
}

/** Shared layout for every "Waylay can't run here" screen. */
export function UnsupportedScreen({
  illustration,
  eyebrow,
  title,
  description,
  listTitle,
  list,
  hint,
  actions,
}: UnsupportedScreenProps) {
  return (
    <div className={styles.screen}>
      <div className={styles.inner}>
        <div className={styles.intro}>
          {illustration}
          <p className={styles.eyebrow}>{eyebrow}</p>
          <h1 className={styles.title}>{title}</h1>
          <p className={styles.description}>{description}</p>
        </div>
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>{listTitle}</h2>
          {list}
          <p className={styles.hint}>{hint}</p>
        </section>
        {actions}
      </div>
    </div>
  );
}
