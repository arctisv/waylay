'use client';

import type { KeyboardEvent, RefObject } from 'react';
import { ArrowUpIcon } from '@/components/icons';
import { useAutosizeTextarea } from '@/hooks/useAutosizeTextarea';
import styles from './Composer.module.css';

interface ComposerProps {
  value: string;
  onChange: (value: string) => void;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
}

export function Composer({ value, onChange, textareaRef }: ComposerProps) {
  useAutosizeTextarea(textareaRef, value);
  const canSend = value.trim().length > 0;

  // Sending isn't built yet. Enter is reserved for it, Shift+Enter adds a new line.
  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) event.preventDefault();
  };

  return (
    <div className={styles.root}>
      <form className={styles.form} onSubmit={(event) => event.preventDefault()}>
        <label htmlFor="composer-input" className="visually-hidden">
          Message Waylay
        </label>
        <textarea
          id="composer-input"
          ref={textareaRef}
          className={styles.input}
          rows={1}
          placeholder="Message Waylay"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={handleKeyDown}
        />
        <button type="submit" className={styles.send} disabled={!canSend} aria-label="Send message">
          <ArrowUpIcon size={20} strokeWidth={2.25} />
        </button>
      </form>
      <p className={styles.note}>Your first message downloads the model once, about 1 GB. After that, Waylay works offline.</p>
    </div>
  );
}
