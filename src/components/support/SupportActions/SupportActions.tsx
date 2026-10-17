'use client';

import { CheckIcon } from '@/components/icons';
import { Button } from '@/components/ui/Button/Button';
import { useCopyToClipboard } from '@/hooks/useCopyToClipboard';
import styles from './SupportActions.module.css';

interface SupportActionsProps {
  onRecheck: () => void;
  rechecking: boolean;
}

export function SupportActions({ onRecheck, rechecking }: SupportActionsProps) {
  const { copied, copy } = useCopyToClipboard();

  return (
    <div className={styles.actions}>
      <Button
        icon={copied ? <CheckIcon size={18} strokeWidth={2.25} /> : undefined}
        onClick={() => copy(window.location.origin + window.location.pathname)}
      >
        {copied ? 'Copied' : 'Copy link'}
      </Button>
      <Button variant="secondary" onClick={onRecheck} disabled={rechecking}>
        {rechecking ? 'Checking…' : 'Check again'}
      </Button>
    </div>
  );
}
