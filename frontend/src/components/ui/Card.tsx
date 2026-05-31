import { type ReactNode } from 'react';
import { motion } from 'framer-motion';
import clsx from 'clsx';

interface CardProps {
  children: ReactNode;
  className?: string;
  elevated?: boolean;
  onClick?: () => void;
  animate?: boolean;
}

export function Card({ children, className, elevated, onClick, animate = true }: CardProps) {
  const base = elevated ? 'glass-card-elevated' : 'glass-card';

  if (animate) {
    return (
      <motion.div
        className={clsx(base, className, onClick && 'cursor-pointer')}
        onClick={onClick}
        whileTap={onClick ? { scale: 0.98 } : undefined}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      >
        {children}
      </motion.div>
    );
  }

  return (
    <div className={clsx(base, className, onClick && 'cursor-pointer')} onClick={onClick}>
      {children}
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: string | number;
  unit?: string;
  subtext?: string;
  icon?: ReactNode;
  accent?: 'gold' | 'green' | 'red' | 'blue' | 'muted';
  className?: string;
}

const accentColors = {
  gold: 'text-brand-gold',
  green: 'text-status-online',
  red: 'text-status-offline',
  blue: 'text-status-info',
  muted: 'text-text-secondary',
};

export function StatCard({ label, value, unit, subtext, icon, accent = 'gold', className }: StatCardProps) {
  return (
    <Card className={clsx('p-4', className)}>
      <div className="flex items-start justify-between mb-3">
        <span className="text-xs font-semibold text-text-muted uppercase tracking-widest">{label}</span>
        {icon && <div className="text-text-muted opacity-60">{icon}</div>}
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className={clsx('text-display-md tabular-nums font-bold', accentColors[accent])}>
          {value}
        </span>
        {unit && <span className="text-sm text-text-muted font-medium">{unit}</span>}
      </div>
      {subtext && <p className="mt-1.5 text-xs text-text-secondary">{subtext}</p>}
    </Card>
  );
}
