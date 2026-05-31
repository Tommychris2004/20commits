import clsx from 'clsx';
import { type ReactNode } from 'react';

type BadgeVariant = 'gold' | 'green' | 'red' | 'blue' | 'muted' | 'outline';

interface BadgeProps {
  children: ReactNode;
  variant?: BadgeVariant;
  className?: string;
}

const variantClasses: Record<BadgeVariant, string> = {
  gold: 'bg-brand-gold/15 text-brand-gold border border-brand-gold/25',
  green: 'bg-status-online/15 text-status-online border border-status-online/25',
  red: 'bg-status-offline/15 text-status-offline border border-status-offline/25',
  blue: 'bg-status-info/15 text-status-info border border-status-info/25',
  muted: 'bg-surface-elevated text-text-secondary border border-surface-border',
  outline: 'border border-surface-border text-text-secondary',
};

export function Badge({ children, variant = 'muted', className }: BadgeProps) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold',
        variantClasses[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}
