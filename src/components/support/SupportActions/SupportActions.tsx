'use client';

import { CheckIcon, LinkIcon, RefreshIcon } from '@/components/icons';
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
        icon={copied ? <CheckIcon size={18} /> : <LinkIcon size={18} />}
        onClick={() => copy(window.location.origin + window.location.pathname)}
      >
        {copied ? 'Link copied' : 'Copy link'}
      </Button>
      <Button
        variant="secondary"
        icon={<RefreshIcon size={18} className={rechecking ? styles.spin : undefined} />}
        onClick={onRecheck}
        disabled={rechecking}
      >
        {rechecking ? 'Checking…' : 'Check again'}
      </Button>
    </div>
  );
}
