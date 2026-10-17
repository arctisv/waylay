import { prompts } from './prompts';
import styles from './PromptSuggestions.module.css';

export function PromptSuggestions({ onPick }: { onPick: (text: string) => void }) {
  return (
    <section className={styles.section} aria-labelledby="prompt-suggestions-title">
      <h2 id="prompt-suggestions-title" className={styles.title}>
        Try asking
      </h2>
      <ul className={styles.list}>
        {prompts.map(({ id, text, Icon }) => (
          <li key={id}>
            <button type="button" className={styles.prompt} onClick={() => onPick(text)}>
              <Icon size={18} className={styles.icon} />
              <span>{text}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
