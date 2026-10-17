import { AppIcon } from '@/components/brand/AppIcon/AppIcon';
import { ChipIcon, LockIcon, WifiOffIcon } from '@/components/icons';
import { PromptSuggestions } from '../PromptSuggestions/PromptSuggestions';
import styles from './ChatEmptyState.module.css';

const facts = [
  { id: 'gpu', text: 'Runs on your GPU', Icon: ChipIcon },
  { id: 'offline', text: 'Works offline', Icon: WifiOffIcon },
  { id: 'private', text: 'Stays on this device', Icon: LockIcon },
];

export function ChatEmptyState({ onPickPrompt }: { onPickPrompt: (text: string) => void }) {
  return (
    <div className={styles.root}>
      <div className={styles.hero}>
        <AppIcon size={56} className={styles.icon} />
        <h1 className={styles.title}>Private AI, right in your browser.</h1>
        <p className={styles.lede}>
          Waylay runs a language model on your own device. No servers, no account, and nothing you type is ever sent
          anywhere.
        </p>
        <ul className={styles.facts}>
          {facts.map(({ id, text, Icon }) => (
            <li key={id} className={styles.fact}>
              <Icon size={16} />
              {text}
            </li>
          ))}
        </ul>
      </div>
      <PromptSuggestions onPick={onPickPrompt} />
    </div>
  );
}
