import { motion } from 'framer-motion';
import clsx from 'clsx';

interface ProgressBarProps {
  value: number; // 0-100
  color?: 'gold' | 'green' | 'red' | 'blue';
  className?: string;
  showLabel?: boolean;
  label?: string;
  animate?: boolean;
}

const colorMap = {
  gold: 'bg-brand-gold',
  green: 'bg-status-online',
  red: 'bg-status-offline',
  blue: 'bg-status-info',
};

export function ProgressBar({
  value,
  color = 'gold',
  className,
  showLabel,
  label,
  animate = true,
}: ProgressBarProps) {
  const pct = Math.min(100, Math.max(0, value));

  return (
    <div className={clsx('space-y-1', className)}>
      {(showLabel || label) && (
        <div className="flex justify-between items-center text-xs text-text-muted">
          <span>{label}</span>
          <span className="tabular-nums">{Math.round(pct)}%</span>
        </div>
      )}
      <div className="progress-bar">
        <motion.div
          className={clsx('progress-fill', colorMap[color])}
          initial={{ width: '0%' }}
          animate={{ width: `${pct}%` }}
          transition={animate ? { duration: 1, ease: [0.16, 1, 0.3, 1] } : { duration: 0 }}
        />
      </div>
    </div>
  );
}

interface MultiProgressBarProps {
  segments: Array<{ label: string; value: number; color: string }>;
  className?: string;
}

export function MultiProgressBar({ segments, className }: MultiProgressBarProps) {
  const total = segments.reduce((s, seg) => s + seg.value, 0);

  return (
    <div className={clsx('flex rounded-full overflow-hidden h-2 bg-surface-border', className)}>
      {segments.map((seg, i) => {
        const pct = total > 0 ? (seg.value / total) * 100 : 0;
        return (
          <motion.div
            key={i}
            className="h-full"
            style={{ backgroundColor: seg.color }}
            initial={{ width: '0%' }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 1, delay: i * 0.1, ease: [0.16, 1, 0.3, 1] }}
          />
        );
      })}
    </div>
  );
}
