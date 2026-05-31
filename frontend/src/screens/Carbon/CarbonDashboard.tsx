import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Leaf, TrendingUp, Clock, ChevronRight } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { Card } from '../../components/ui/Card.tsx';
import { Badge } from '../../components/ui/Badge.tsx';
import { ProgressBar } from '../../components/ui/ProgressBar.tsx';
import { FullPageSkeleton } from '../../components/ui/Skeleton.tsx';
import { useApi } from '../../hooks/useApi.ts';
import { carbonApi, type CarbonResponse } from '../../api/client.ts';

function fmt(n: number) { return n.toLocaleString('en-NG'); }
function fmtUsd(n: number) { return n.toFixed(2); }

// Lifecycle stages for credit tracker
const LIFECYCLE_STAGES = [
  { id: 'collecting', label: 'MRV Collecting', desc: 'Your solar data is being recorded continuously', status: 'done', icon: '📡' },
  { id: 'pooling', label: 'Pool Building', desc: 'Credits pooling with other GridNode users', status: 'active', icon: '🌊' },
  { id: 'verifying', label: 'Verification', desc: 'Third-party audit by certified VVB', status: 'pending', icon: '🔍' },
  { id: 'issued', label: 'Credits Issued', desc: 'Verified Carbon Units on Verra Registry', status: 'pending', icon: '📜' },
  { id: 'selling', label: 'Listed for Sale', desc: 'Credits listed on the carbon market', status: 'pending', icon: '📈' },
  { id: 'paid', label: 'Payout Sent', desc: 'Your share sent to your wallet', status: 'pending', icon: '💰' },
];

type CarbonTab = 'overview' | 'impact' | 'tracker' | 'history';

const TABS: { id: CarbonTab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'impact', label: 'Impact' },
  { id: 'tracker', label: 'Credits' },
  { id: 'history', label: 'Payouts' },
];

// Demo payout history
const DEMO_PAYOUTS = [
  { date: 'Q1 2026', credits: 0.84, price_usd: 8.20, naira: 9430, status: 'paid' },
  { date: 'Q4 2025', credits: 0.71, price_usd: 7.80, naira: 7940, status: 'paid' },
  { date: 'Q3 2025', credits: 0.62, price_usd: 7.50, naira: 6585, status: 'paid' },
];

export function CarbonDashboard() {
  const { data, loading } = useApi(carbonApi.getSummary);
  const [activeTab, setActiveTab] = useState<CarbonTab>('overview');
  const navigate = useNavigate();

  if (loading) return <FullPageSkeleton />;

  const carbon = data as CarbonResponse | null;
  const hasDevice = carbon?.has_device ?? false;

  const co2Kg = carbon?.this_month?.co2_avoided_kg ?? 265;
  const creditsEarned = carbon?.this_month?.credits_earned ?? 0.265;
  const creditValueNaira = carbon?.this_month?.credit_value_naira ?? 31_500;
  const estimatedPayout = carbon?.this_month?.estimated_payout_naira ?? 22_050;
  const poolPct = carbon?.pool_progress?.pct ?? 4.2;
  const nextPayoutDate = carbon?.next_payout?.date ?? '2026-10-01';
  const impact = carbon?.impact;

  const trees = impact?.trees_equivalent ?? Math.round(co2Kg / 21);
  const carKm = impact?.car_km_equivalent ?? Math.round(co2Kg / 0.1);
  const flightPct = impact?.flight_pct_lagos_london ?? Math.round(co2Kg / 10);

  const daysToNextPayout = Math.max(0, Math.round((new Date(nextPayoutDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)));

  return (
    <div className="page">
      {/* Header */}
      <div className="px-4 pt-14 pb-6" style={{ background: 'linear-gradient(135deg, #1A3A1A 0%, #0D200D 100%)' }}>
        <div className="flex items-center justify-between mb-5">
          <div>
            <p className="text-xs font-semibold text-white/50 uppercase tracking-widest">Carbon Credits</p>
            <h1 className="text-xl font-bold text-white mt-0.5">My Carbon Impact</h1>
          </div>
          <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center">
            <Leaf size={18} className="text-green-400" />
          </div>
        </div>

        {/* Big CO2 number */}
        <div className="text-center py-4">
          <motion.div
            key={co2Kg}
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="text-6xl font-black tabular-nums text-white"
            style={{ textShadow: '0 0 40px rgba(74,222,128,0.3)' }}
          >
            {Math.round(co2Kg)}
          </motion.div>
          <p className="text-sm text-white/50 mt-1">kg CO₂ avoided this month</p>

          <div className="flex justify-center gap-4 mt-4">
            <div className="text-center">
              <p className="text-lg font-bold text-green-400">{creditsEarned.toFixed(3)}</p>
              <p className="text-xs text-white/40">Credits</p>
            </div>
            <div className="w-px bg-white/10" />
            <div className="text-center">
              <p className="text-lg font-bold text-brand-gold">₦{fmt(Math.round(creditValueNaira))}</p>
              <p className="text-xs text-white/40">Est. Value</p>
            </div>
            <div className="w-px bg-white/10" />
            <div className="text-center">
              <p className="text-lg font-bold text-white">{daysToNextPayout}d</p>
              <p className="text-xs text-white/40">To Payout</p>
            </div>
          </div>
        </div>

        {/* Pool progress */}
        <div className="mt-2">
          <div className="flex justify-between text-xs text-white/40 mb-1.5">
            <span>Pool toward verification</span>
            <span>{poolPct.toFixed(1)}% of 10,000t</span>
          </div>
          <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-green-400"
              initial={{ width: 0 }}
              animate={{ width: `${poolPct}%` }}
              transition={{ duration: 1.5, ease: [0.16, 1, 0.3, 1] }}
            />
          </div>
        </div>
      </div>

      <div className="px-4 pt-4 space-y-3">
        {/* Next payout CTA */}
        <Card className="p-4 border border-green-500/20 bg-green-500/5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-green-500/15 flex items-center justify-center">
              <Clock size={18} className="text-green-400" />
            </div>
            <div>
              <p className="text-xs text-text-muted uppercase tracking-widest font-semibold">Next Payout Est.</p>
              <p className="text-lg font-bold text-text-primary">₦{fmt(Math.round(estimatedPayout))}</p>
              <p className="text-xs text-green-400">{new Date(nextPayoutDate).toLocaleDateString('en-NG', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
            </div>
          </div>
        </Card>

        {/* Tab switcher */}
        <div className="flex p-1 gap-1 bg-surface-elevated rounded-2xl no-scrollbar overflow-x-auto">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-shrink-0 px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 ${
                activeTab === tab.id
                  ? 'bg-green-700 text-white shadow-md'
                  : 'text-text-muted hover:text-text-secondary'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {/* OVERVIEW TAB */}
          {activeTab === 'overview' && (
            <motion.div
              key="overview"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-3"
            >
              <div className="grid grid-cols-2 gap-3">
                <Card className="p-4">
                  <p className="text-xs text-text-muted uppercase tracking-widest font-semibold mb-1">All-Time CO₂</p>
                  <p className="text-2xl font-bold text-green-400 tabular-nums">
                    {((carbon?.all_time?.co2_avoided_kg ?? co2Kg * 6) / 1000).toFixed(2)}t
                  </p>
                  <p className="text-xs text-text-secondary mt-0.5">Total avoided</p>
                </Card>
                <Card className="p-4">
                  <p className="text-xs text-text-muted uppercase tracking-widest font-semibold mb-1">Standard</p>
                  <p className="text-2xl font-bold text-text-primary">VCS</p>
                  <p className="text-xs text-text-secondary mt-0.5">Verra Verified</p>
                </Card>
              </div>

              <Card className="p-4">
                <p className="section-title mb-3">How It Works</p>
                {[
                  { step: '1', text: 'Your solar panels generate clean energy', color: '#22C55E' },
                  { step: '2', text: 'Smart Node measures every kWh — this is your MRV data', color: '#F1C40F' },
                  { step: '3', text: 'GridNode pools 100,000+ nodes into one certified project', color: '#3B82F6' },
                  { step: '4', text: 'Verified credits sold quarterly — you get 70% of revenue', color: '#6E1A1A' },
                ].map((s) => (
                  <div key={s.step} className="flex gap-3 mb-3 last:mb-0">
                    <div
                      className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 text-xs font-bold text-white"
                      style={{ backgroundColor: s.color }}
                    >
                      {s.step}
                    </div>
                    <p className="text-xs text-text-secondary leading-relaxed">{s.text}</p>
                  </div>
                ))}
              </Card>

              <p className="text-xs text-text-muted text-center px-4 leading-relaxed">
                {carbon?.disclaimer ?? 'Estimates only. Actual payouts subject to third-party verification.'}
              </p>
            </motion.div>
          )}

          {/* IMPACT TAB */}
          {activeTab === 'impact' && (
            <motion.div
              key="impact"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-3"
            >
              {[
                { icon: '🌳', label: 'Trees Equivalent', value: `${trees} trees`, sub: 'planted this year', color: '#22C55E' },
                { icon: '🚗', label: 'Car Journeys Avoided', value: `${carKm.toLocaleString()} km`, sub: "of driving you've offset", color: '#F1C40F' },
                { icon: '✈️', label: 'Lagos → London Flight', value: `${flightPct}%`, sub: 'of a round-trip offset', color: '#3B82F6' },
                { icon: '☁️', label: 'CO₂ Kept Out of Air', value: `${Math.round(co2Kg)} kg`, sub: 'as heavy as a baby elephant', color: '#A78BFA' },
              ].map((item, i) => (
                <motion.div
                  key={item.label}
                  initial={{ opacity: 0, x: -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.08 }}
                >
                  <Card className="p-4">
                    <div className="flex items-center gap-4">
                      <div
                        className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0"
                        style={{ backgroundColor: `${item.color}15` }}
                      >
                        {item.icon}
                      </div>
                      <div className="flex-1">
                        <p className="text-xs text-text-muted uppercase tracking-widest font-semibold">{item.label}</p>
                        <p className="text-xl font-bold tabular-nums mt-0.5" style={{ color: item.color }}>{item.value}</p>
                        <p className="text-xs text-text-secondary mt-0.5">{item.sub}</p>
                      </div>
                    </div>
                  </Card>
                </motion.div>
              ))}

              <Card className="p-4 flex items-center gap-3 border border-green-500/20">
                <div className="flex-1">
                  <p className="text-sm font-semibold text-text-primary">Share My Impact</p>
                  <p className="text-xs text-text-secondary mt-0.5">Show your clean energy story</p>
                </div>
                <button className="btn-primary py-2 px-4 text-xs">
                  Share 🌱
                </button>
              </Card>
            </motion.div>
          )}

          {/* TRACKER TAB */}
          {activeTab === 'tracker' && (
            <motion.div
              key="tracker"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-2"
            >
              <p className="text-xs text-text-muted text-center mb-2">
                Next payout: <span className="text-text-primary font-semibold">{new Date(nextPayoutDate).toLocaleDateString('en-NG', { month: 'long', year: 'numeric' })}</span>
              </p>

              {LIFECYCLE_STAGES.map((stage, i) => (
                <motion.div
                  key={stage.id}
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.07 }}
                >
                  <div className="flex gap-4">
                    {/* Timeline line */}
                    <div className="flex flex-col items-center">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center text-sm flex-shrink-0 ${
                          stage.status === 'done'
                            ? 'bg-green-500 text-white'
                            : stage.status === 'active'
                              ? 'bg-brand-gold text-brand-red-dark'
                              : 'bg-surface-elevated text-text-muted'
                        }`}
                      >
                        {stage.status === 'done' ? '✓' : stage.icon}
                      </div>
                      {i < LIFECYCLE_STAGES.length - 1 && (
                        <div className={`w-0.5 h-8 mt-1 ${stage.status === 'done' ? 'bg-green-500/40' : 'bg-surface-border'}`} />
                      )}
                    </div>

                    <div className="flex-1 pb-4">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className={`text-sm font-semibold ${
                          stage.status === 'done' ? 'text-green-400' :
                          stage.status === 'active' ? 'text-brand-gold' :
                          'text-text-muted'
                        }`}>
                          {stage.label}
                        </p>
                        {stage.status === 'active' && (
                          <motion.div
                            animate={{ opacity: [1, 0.5, 1] }}
                            transition={{ duration: 1.5, repeat: Infinity }}
                          >
                            <Badge variant="gold">In Progress</Badge>
                          </motion.div>
                        )}
                      </div>
                      <p className="text-xs text-text-muted">{stage.desc}</p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          )}

          {/* HISTORY TAB */}
          {activeTab === 'history' && (
            <motion.div
              key="history"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-3"
            >
              {/* Total earned */}
              <Card className="p-4 border border-green-500/20 bg-green-500/5">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">🏆</span>
                  <div>
                    <p className="text-xs text-text-muted uppercase tracking-widest font-semibold">Total Carbon Income</p>
                    <p className="text-2xl font-bold text-green-400 tabular-nums">
                      ₦{fmt(DEMO_PAYOUTS.reduce((s, p) => s + p.naira, 0))}
                    </p>
                    <p className="text-xs text-text-secondary mt-0.5">
                      {DEMO_PAYOUTS.reduce((s, p) => s + p.credits, 0).toFixed(2)} credits sold
                    </p>
                  </div>
                </div>
              </Card>

              {DEMO_PAYOUTS.map((payout, i) => (
                <Card key={i} className="p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-sm font-semibold text-text-primary">{payout.date}</p>
                        <Badge variant="green">Paid ✓</Badge>
                      </div>
                      <p className="text-xs text-text-muted">{payout.credits} VCUs · ${fmtUsd(payout.price_usd)}/tonne</p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-green-400 tabular-nums">₦{fmt(payout.naira)}</p>
                      <p className="text-xs text-text-muted">Your 70%</p>
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t border-surface-border flex justify-end">
                    <button className="text-xs text-brand-gold flex items-center gap-1">
                      View Certificate <ChevronRight size={12} />
                    </button>
                  </div>
                </Card>
              ))}

              {DEMO_PAYOUTS.length === 0 && (
                <Card className="p-8 text-center">
                  <p className="text-3xl mb-3">🌱</p>
                  <p className="text-sm font-semibold text-text-primary">First payout coming</p>
                  <p className="text-xs text-text-secondary mt-1">
                    Credits are accumulating. First payout expected {new Date(nextPayoutDate).toLocaleDateString('en-NG', { month: 'long', year: 'numeric' })}.
                  </p>
                </Card>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
