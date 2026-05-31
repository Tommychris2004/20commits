import { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, TrendingUp, TrendingDown, Minus, Star } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card } from '../components/ui/Card.tsx';
import { Badge } from '../components/ui/Badge.tsx';
import { FullPageSkeleton } from '../components/ui/Skeleton.tsx';
import { WeeklyBarChart, HourlyChart } from '../components/charts/BarChart.tsx';
import { useApi } from '../hooks/useApi.ts';
import { energyApi, type HistoryResponse } from '../api/client.ts';

// Demo data for when no device is connected
const DEMO_WEEKLY = Array.from({ length: 7 }, (_, i) => {
  const d = new Date();
  d.setDate(d.getDate() - (6 - i));
  return {
    date: d.toISOString().split('T')[0],
    value: Math.round(8000 + Math.random() * 12000),
    total_kwh: 15 + Math.random() * 15,
    total_cost_naira: 8000 + Math.random() * 12000,
    by_source: { generator: 8, solar: 5, grid: 2 },
  };
});

const DEMO_HOURLY = Array.from({ length: 24 }, (_, h) => ({
  hour: h,
  total_kwh: h >= 7 && h <= 18 ? 1.2 + Math.random() * 1.8 : 0.3 + Math.random() * 0.7,
  is_peak: h === 19,
}));

function fmt(n: number) {
  return n.toLocaleString('en-NG');
}

type TabId = 'week' | 'hourly';

export function EnergyHistory() {
  const { data, loading } = useApi(energyApi.getHistory);
  const [activeTab, setActiveTab] = useState<TabId>('week');

  if (loading) return <FullPageSkeleton />;

  const history = data as HistoryResponse | null;
  const hasDevice = history?.has_device ?? false;

  const weeklyData = hasDevice
    ? (history?.weekly ?? []).map((d) => ({ ...d, value: d.total_cost_naira }))
    : DEMO_WEEKLY;

  const hourlyData = hasDevice ? (history?.hourly ?? []) : DEMO_HOURLY;
  const weekComp = history?.week_comparison;

  const bestDay = weeklyData.reduce((best, d) => (d.value < best.value ? d : best), weeklyData[0]);
  const peakHour = hourlyData.find((h) => h.is_peak);

  const changeDir = weekComp?.direction ?? 'down';
  const changePct = Math.abs(weekComp?.change_pct ?? 0);

  return (
    <div className="page">
      {/* Header */}
      <div className="brand-header px-4 pt-14 pb-6">
        <div className="flex items-center gap-3 mb-4">
          <Link to="/" className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
            <ArrowLeft size={16} className="text-white" />
          </Link>
          <div>
            <p className="text-xs font-semibold text-white/50 uppercase tracking-widest">My Energy</p>
            <h1 className="text-xl font-bold text-white">Usage History</h1>
          </div>
        </div>

        {/* Week comparison summary */}
        {weekComp && (
          <div className="glass-card p-4 bg-white/5 border-white/10">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-white/50 uppercase tracking-wider font-semibold">This Week</p>
                <p className="text-2xl font-bold text-white tabular-nums mt-1">
                  ₦{fmt(Math.round(weekComp.this_week_cost_naira))}
                </p>
              </div>
              <div className="text-right">
                <div className={`flex items-center gap-1 justify-end ${changeDir === 'up' ? 'text-status-offline' : 'text-status-online'}`}>
                  {changeDir === 'up' ? <TrendingUp size={16} /> : changeDir === 'down' ? <TrendingDown size={16} /> : <Minus size={16} />}
                  <span className="font-bold">{changePct}%</span>
                </div>
                <p className="text-xs text-white/50 mt-0.5">vs last week</p>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="px-4 pt-4 space-y-4">
        {/* Tab switcher */}
        <div className="flex p-1 gap-1 bg-surface-elevated rounded-2xl">
          {(['week', 'hourly'] as TabId[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${
                activeTab === tab
                  ? 'bg-brand-red text-white shadow-md'
                  : 'text-text-muted hover:text-text-secondary'
              }`}
            >
              {tab === 'week' ? '7-Day View' : 'Today by Hour'}
            </button>
          ))}
        </div>

        {/* Weekly chart */}
        {activeTab === 'week' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-3"
          >
            <Card className="p-4">
              <div className="flex items-center justify-between mb-4">
                <p className="section-title">Daily Cost (₦)</p>
                {bestDay && (
                  <Badge variant="gold">
                    <Star size={10} />
                    Best day
                  </Badge>
                )}
              </div>
              <WeeklyBarChart data={weeklyData} unit="₦" />

              {/* Day cards */}
              <div className="mt-4 grid grid-cols-7 gap-1">
                {weeklyData.map((day) => {
                  const isBest = day === bestDay;
                  return (
                    <div
                      key={day.date}
                      className={`rounded-xl p-2 text-center ${isBest ? 'bg-brand-gold/15 border border-brand-gold/30' : 'bg-surface-elevated'}`}
                    >
                      <p className={`text-[9px] font-bold uppercase ${isBest ? 'text-brand-gold' : 'text-text-muted'}`}>
                        {new Date(day.date).toLocaleDateString('en-NG', { weekday: 'short' }).slice(0, 1)}
                      </p>
                      <p className={`text-[10px] tabular-nums mt-0.5 font-semibold ${isBest ? 'text-brand-gold' : 'text-text-secondary'}`}>
                        {(day.value / 1000).toFixed(1)}k
                      </p>
                      {isBest && <Star size={8} className="mx-auto mt-0.5 text-brand-gold fill-brand-gold" />}
                    </div>
                  );
                })}
              </div>
            </Card>

            {/* Source note */}
            <Card className="p-4">
              <p className="text-xs text-text-secondary leading-relaxed">
                <span className="font-semibold text-text-primary">About appliance breakdown:</span> Showing which
                appliance uses the most (AC 45%, etc.) requires per-circuit sensors on each
                device — your Smart Node monitors whole-house power. Per-circuit sensing is a future feature.
              </p>
            </Card>
          </motion.div>
        )}

        {/* Hourly chart */}
        {activeTab === 'hourly' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-3"
          >
            <Card className="p-4">
              <div className="flex items-center justify-between mb-4">
                <p className="section-title">Energy by Hour (kWh)</p>
                {peakHour && (
                  <Badge variant="red">
                    Peak: {peakHour.hour}:00
                  </Badge>
                )}
              </div>
              <HourlyChart data={hourlyData} />

              {peakHour && (
                <div className="mt-3 p-3 rounded-xl bg-surface-elevated">
                  <p className="text-xs text-text-secondary">
                    <span className="text-status-offline font-semibold">Peak hour</span> is {peakHour.hour}:00 —{' '}
                    this is when your energy use spikes. Consider shifting heavy loads to solar hours (10am–4pm).
                  </p>
                </div>
              )}
            </Card>

            {/* Solar window tip */}
            <Card className="p-4 border border-brand-gold/15">
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-xl bg-brand-gold/15 flex items-center justify-center flex-shrink-0">
                  <span className="text-base">☀️</span>
                </div>
                <div>
                  <p className="text-sm font-semibold text-text-primary">Best time to use power</p>
                  <p className="text-xs text-text-secondary mt-0.5">
                    10am–4pm. Run your washing machine, water heater and AC during this window — it's solar-powered and costs nothing.
                  </p>
                </div>
              </div>
            </Card>
          </motion.div>
        )}

        {!hasDevice && (
          <p className="text-center text-xs text-text-muted pb-4">
            Showing simulated data. Connect your Smart Node for real history.
          </p>
        )}
      </div>
    </div>
  );
}
