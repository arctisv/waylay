import type { ButtonHTMLAttributes, ReactNode } from 'react';
import styles from './Button.module.css';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary';
  icon?: ReactNode;
}

export function Button({ variant = 'primary', icon, className, children, type = 'button', ...rest }: ButtonProps) {
  return (
    <button type={type} className={[styles.button, styles[variant], className].filter(Boolean).join(' ')} {...rest}>
      {icon}
      <span>{children}</span>
    </button>
  );
}
