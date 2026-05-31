import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, TrendingDown, Sun, Battery, Grid3X3, AlertTriangle, ChevronRight, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card, StatCard } from '../components/ui/Card.tsx';
import { Badge } from '../components/ui/Badge.tsx';
import { FullPageSkeleton } from '../components/ui/Skeleton.tsx';
import { MultiProgressBar } from '../components/ui/ProgressBar.tsx';
import { useApi } from '../hooks/useApi.ts';
import { energyApi, type EnergyResponse, type Alert } from '../api/client.ts';
import clsx from 'clsx';

function fmt(n: number) {
  return n.toLocaleString('en-NG');
}

// Simulated live data when no device (demo mode)
function useDemoData() {
  const [power, setPower] = useState(3.24);
  useEffect(() => {
    const id = setInterval(() => {
      setPower((p) => Math.max(1, p + (Math.random() - 0.5) * 0.3));
    }, 3000);
    return () => clearInterval(id);
  }, []);
  return power;
}

const alertIcons: Record<string, typeof Zap> = {
  low_load_generator: AlertTriangle,
  solar_forecast: Sun,
  high_consumption: Zap,
  default: AlertTriangle,
};

const alertStyles: Record<string, string> = {
  low_load_generator: 'alert-efficiency',
  solar_forecast: 'alert-solar',
  high_consumption: 'alert-tip',
  default: 'alert-efficiency',
};

interface AlertCardProps {
  alert: Alert;
  onDismiss: () => void;
}

function AlertCard({ alert, onDismiss }: AlertCardProps) {
  const Icon = alertIcons[alert.alert_type] ?? alertIcons.default;
  const style = alertStyles[alert.alert_type] ?? alertStyles.default;

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20, height: 0, marginTop: 0 }}
      className={clsx('glass-card p-4 rounded-2xl', style)}
    >
      <div className="flex gap-3">
        <div className="flex-shrink-0 mt-0.5">
          <Icon size={16} className="text-current opacity-80" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-text-primary leading-snug">{alert.message}</p>
          <p className="mt-1 text-xs text-text-secondary leading-relaxed">{alert.recommendation}</p>
          <div className="mt-2 flex items-center gap-3">
            <Badge variant="gold">Save ₦{fmt(alert.impact_naira)}</Badge>
            <button
              onClick={onDismiss}
              className="text-xs text-text-muted hover:text-text-secondary transition-colors"
            >
              Dismiss
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

interface PowerOrbProps {
  powerKw: number;
  status: string;
}

function PowerOrb({ powerKw, status }: PowerOrbProps) {
  const isOnline = status === 'online';

  return (
    <div className="flex flex-col items-center py-8">
      {/* Outer glow rings */}
      <div className="relative flex items-center justify-center">
        {isOnline && (
          <>
            <div
              className="absolute rounded-full border border-brand-gold/10 power-ring"
              style={{ width: 160, height: 160 }}
            />
            <div
              className="absolute rounded-full border border-brand-gold/08 power-ring"
              style={{ width: 200, height: 200, animationDelay: '0.5s' }}
            />
          </>
        )}

        {/* Main orb */}
        <div
          className="relative flex items-center justify-center rounded-full border-2"
          style={{
            width: 140,
            height: 140,
            background: 'radial-gradient(circle at 40% 40%, #2A0808, #1A0404)',
            borderColor: isOnline ? '#F1C40F' : '#2A2A2A',
            boxShadow: isOnline ? '0 0 40px rgba(241,196,15,0.15), inset 0 1px 0 rgba(255,255,255,0.05)' : 'none',
          }}
        >
          <div className="text-center">
            <div className="gold-number text-4xl font-black tabular-nums">
              {powerKw.toFixed(2)}
            </div>
            <div className="text-xs font-semibold text-text-muted mt-0.5 tracking-widest uppercase">
              kW
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2">
        <div className={clsx('status-dot', `status-dot-${status}`)} />
        <span className="text-xs font-medium text-text-secondary capitalize">{status === 'online' ? 'Live Reading' : 'Node Offline'}</span>
      </div>
    </div>
  );
}

interface SourceBarProps {
  label: string;
  kwh: number;
  totalKwh: number;
  color: string;
  icon: typeof Zap;
}

function SourceBar({ label, kwh, totalKwh, color, icon: Icon }: SourceBarProps) {
  const pct = totalKwh > 0 ? Math.round((kwh / totalKwh) * 100) : 0;

  return (
    <div className="flex items-center gap-3">
      <div
        className="flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center"
        style={{ backgroundColor: `${color}18` }}
      >
        <Icon size={14} style={{ color }} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-center mb-1">
          <span className="text-xs font-medium text-text-secondary">{label}</span>
          <div className="flex items-center gap-2">
            <span className="text-xs text-text-muted tabular-nums">{kwh.toFixed(2)} kWh</span>
            <span className="text-xs font-bold tabular-nums" style={{ color }}>{pct}%</span>
          </div>
        </div>
        <div className="h-1.5 rounded-full overflow-hidden bg-surface-border">
          <motion.div
            className="h-full rounded-full"
            style={{ backgroundColor: color }}
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
          />
        </div>
      </div>
    </div>
  );
}

export function EnergyDashboard() {
  const { data, loading, error, refetch } = useApi(energyApi.getCurrent);
  const { data: alertsData } = useApi(energyApi.getAlerts);
  const demoLivePower = useDemoData();
  const [dismissedAlerts, setDismissedAlerts] = useState<Set<number>>(new Set());

  // Auto-refresh every 30s
  useEffect(() => {
    const id = setInterval(refetch, 30_000);
    return () => clearInterval(id);
  }, [refetch]);

  if (loading) return <FullPageSkeleton />;

  if (error) {
    return (
      <div className="page flex items-center justify-center">
        <div className="text-center px-8">
          <div className="text-4xl mb-4">⚡</div>
          <p className="text-text-secondary">{error}</p>
          <button onClick={refetch} className="btn-secondary mt-4">Retry</button>
        </div>
      </div>
    );
  }

  const energy = data as EnergyResponse | null;
  const hasDevice = energy?.has_device ?? false;
  const deviceStatus = energy?.device?.status ?? 'not_connected';

  const currentPower = hasDevice ? (energy?.current_power_kw ?? 0) : demoLivePower;
  const totalKwh = energy?.today?.total_kwh ?? 0;
  const totalCost = energy?.today?.total_cost_naira ?? 0;
  const savingsNaira = energy?.today?.savings_naira ?? 0;
  const projectedMonthly = energy?.projected_monthly_cost_naira ?? 0;
  const bySrc = energy?.today?.by_source ?? [];

  const genKwh = bySrc.find((s) => s.source === 'generator')?.kwh ?? 0;
  const solarKwh = bySrc.find((s) => s.source === 'solar')?.kwh ?? 0;
  const gridKwh = bySrc.find((s) => s.source === 'grid')?.kwh ?? 0;

  const alerts = (alertsData?.alerts ?? []).filter((_, i) => !dismissedAlerts.has(i));

  return (
    <div className="page">
      {/* Header */}
      <div className="brand-header px-4 pt-14 pb-6">
        <div className="flex items-center justify-between mb-1">
          <div>
            <p className="text-xs font-semibold text-white/50 uppercase tracking-widest">GridNode</p>
            <h1 className="text-xl font-bold text-white mt-0.5">My Energy</h1>
          </div>
          <div className="flex items-center gap-3">
            {!hasDevice && (
              <Badge variant="outline">
                <span className="text-white/60">Demo</span>
              </Badge>
            )}
            <button
              onClick={refetch}
              className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center active:bg-white/20 transition-colors"
            >
              <RefreshCw size={14} className="text-white/70" />
            </button>
          </div>
        </div>

        {/* Power orb */}
        <PowerOrb powerKw={currentPower} status={hasDevice ? deviceStatus : 'online'} />

        {/* Source mini-pills */}
        {hasDevice && totalKwh > 0 && (
          <div className="flex gap-2 justify-center pb-2">
            {genKwh > 0 && (
              <span className="stat-chip source-pill-generator">
                <span className="w-1.5 h-1.5 rounded-full bg-energy-generator" />
                Gen {Math.round((genKwh / totalKwh) * 100)}%
              </span>
            )}
            {solarKwh > 0 && (
              <span className="stat-chip source-pill-solar">
                <Sun size={10} />
                Solar {Math.round((solarKwh / totalKwh) * 100)}%
              </span>
            )}
            {gridKwh > 0 && (
              <span className="stat-chip source-pill-grid">
                <Grid3X3 size={10} />
                Grid {Math.round((gridKwh / totalKwh) * 100)}%
              </span>
            )}
          </div>
        )}
      </div>

      <div className="px-4 pt-4 space-y-3">
        {/* No device CTA */}
        {!hasDevice && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-card p-5 border border-brand-gold/20 bg-brand-gold/5"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-brand-gold/15 flex items-center justify-center">
                <Zap size={18} className="text-brand-gold" />
              </div>
              <div>
                <p className="font-semibold text-sm text-text-primary">Connect your Smart Node</p>
                <p className="text-xs text-text-secondary mt-0.5">Demo mode • Live data when connected</p>
              </div>
            </div>
            <Link to="/onboarding" className="btn-primary w-full mt-4 text-sm">
              Set Up My Node
            </Link>
          </motion.div>
        )}

        {/* Cost cards */}
        <div className="grid grid-cols-2 gap-3">
          <StatCard
            label="Today's Cost"
            value={`₦${fmt(Math.round(totalCost))}`}
            subtext={`${totalKwh.toFixed(2)} kWh used`}
            accent="gold"
          />
          <StatCard
            label="Monthly Est."
            value={`₦${fmt(Math.round(projectedMonthly))}`}
            subtext="Projected at this rate"
            accent="muted"
          />
        </div>

        {/* Savings card */}
        {savingsNaira > 0 && (
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-status-online/15 flex items-center justify-center">
                <TrendingDown size={18} className="text-status-online" />
              </div>
              <div>
                <p className="text-xs text-text-muted uppercase tracking-widest font-semibold">Saved vs Generator-only</p>
                <p className="text-display-sm text-status-online tabular-nums font-bold">
                  ₦{fmt(Math.round(savingsNaira))}
                </p>
              </div>
            </div>
          </Card>
        )}

        {/* Source breakdown */}
        {hasDevice && totalKwh > 0 && (
          <Card className="p-4">
            <p className="section-title mb-4">Source Breakdown</p>
            <div className="space-y-4">
              {genKwh > 0 && (
                <SourceBar label="Generator" kwh={genKwh} totalKwh={totalKwh} color="#EF4444" icon={Zap} />
              )}
              {solarKwh > 0 && (
                <SourceBar label="Solar" kwh={solarKwh} totalKwh={totalKwh} color="#F1C40F" icon={Sun} />
              )}
              {gridKwh > 0 && (
                <SourceBar label="Grid (PHCN)" kwh={gridKwh} totalKwh={totalKwh} color="#6B7280" icon={Grid3X3} />
              )}
            </div>

            {/* Combined bar */}
            <div className="mt-4">
              <MultiProgressBar
                segments={[
                  { label: 'Generator', value: genKwh, color: '#EF4444' },
                  { label: 'Solar', value: solarKwh, color: '#F1C40F' },
                  { label: 'Grid', value: gridKwh, color: '#6B7280' },
                ]}
              />
            </div>
          </Card>
        )}

        {/* Alerts */}
        {alerts.length > 0 && (
          <div>
            <div className="section-header">
              <p className="section-title">Smart Alerts</p>
              <Badge variant="gold">{alerts.length}</Badge>
            </div>
            <AnimatePresence mode="popLayout">
              <div className="space-y-2">
                {alerts.map((alert, i) => (
                  <AlertCard
                    key={`${alert.alert_type}-${i}`}
                    alert={alert}
                    onDismiss={() => setDismissedAlerts((prev) => new Set([...prev, i]))}
                  />
                ))}
              </div>
            </AnimatePresence>
          </div>
        )}

        {/* Quick links */}
        <div className="grid grid-cols-2 gap-3">
          <Link to="/history">
            <Card className="p-4 flex items-center gap-3" animate>
              <Battery size={18} className="text-brand-gold" />
              <div>
                <p className="text-sm font-semibold text-text-primary">History</p>
                <p className="text-xs text-text-muted">7-day view</p>
              </div>
              <ChevronRight size={14} className="ml-auto text-text-muted" />
            </Card>
          </Link>
          <Link to="/financing">
            <Card className="p-4 flex items-center gap-3" animate>
              <Sun size={18} className="text-brand-gold" />
              <div>
                <p className="text-sm font-semibold text-text-primary">Go Solar</p>
                <p className="text-xs text-text-muted">Financing</p>
              </div>
              <ChevronRight size={14} className="ml-auto text-text-muted" />
            </Card>
          </Link>
        </div>

        {/* Demo disclaimer */}
        {!hasDevice && (
          <p className="text-center text-xs text-text-muted pb-4">
            ⚡ Showing simulated data. Connect your Smart Node for live readings.
          </p>
        )}
      </div>
    </div>
  );
}
