'use client';

import { useRef, useState } from 'react';
import { ChatEmptyState } from '../ChatEmptyState/ChatEmptyState';
import { Composer } from '../Composer/Composer';
import styles from './ChatView.module.css';

export function ChatView() {
  const [draft, setDraft] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const pickPrompt = (text: string) => {
    setDraft(text);
    textareaRef.current?.focus();
  };

  return (
    <div className={styles.view}>
      <div className={styles.body}>
        <ChatEmptyState onPickPrompt={pickPrompt} />
      </div>
      <div className={styles.dock}>
        <Composer value={draft} onChange={setDraft} textareaRef={textareaRef} />
      </div>
    </div>
  );
}
