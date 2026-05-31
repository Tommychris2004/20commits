import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Sun, Check, ChevronRight, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card } from '../components/ui/Card.tsx';
import { Badge } from '../components/ui/Badge.tsx';
import { useApi } from '../hooks/useApi.ts';
import { api } from '../api/client.ts';
import clsx from 'clsx';

const SYSTEMS = [
  {
    size_kw: 1,
    label: '1 kW Starter',
    price: 350_000,
    desc: 'Lights, fans & phone charging',
    daily_kwh: 4,
    emoji: '🌱',
    popular: false,
  },
  {
    size_kw: 2,
    label: '2 kW Home',
    price: 550_000,
    desc: 'Fan, TV, fridge & small AC',
    daily_kwh: 8,
    emoji: '🏠',
    popular: true,
  },
  {
    size_kw: 5,
    label: '5 kW Full House',
    price: 950_000,
    desc: 'Full AC, appliances & business',
    daily_kwh: 20,
    emoji: '⚡',
    popular: false,
  },
];

const TERMS = [12, 24, 36];

const GEN_COST_MONTHLY = 45_000;
const INTEREST_MONTHLY = 0.025;

function calcPayment(principal: number, months: number): number {
  const r = INTEREST_MONTHLY;
  return Math.round(principal * r * Math.pow(1 + r, months) / (Math.pow(1 + r, months) - 1));
}

type Step = 'eligibility' | 'system' | 'terms' | 'comparison' | 'submitted';

export function Financing() {
  const [step, setStep] = useState<Step>('eligibility');
  const [selectedSystem, setSelectedSystem] = useState(SYSTEMS[1]);
  const [selectedTerm, setSelectedTerm] = useState(24);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const monthly = calcPayment(selectedSystem.price, selectedTerm);
  const solarMonthlySavings = selectedSystem.daily_kwh * 30 * 450;
  const netSaving = GEN_COST_MONTHLY - monthly;

  const handleSubmit = async () => {
    setSubmitting(true);
    setError('');
    try {
      await api.post('/api/me/financing/apply', {
        system_size_kw: selectedSystem.size_kw,
        term_months: selectedTerm,
      });
      setStep('submitted');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page">
      {/* Header */}
      <div className="brand-header px-4 pt-14 pb-6">
        <div className="flex items-center gap-3 mb-2">
          <Link to="/" className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
            <ArrowLeft size={16} className="text-white" />
          </Link>
          <div>
            <p className="text-xs font-semibold text-white/50 uppercase tracking-widest">Solar Finance</p>
            <h1 className="text-xl font-bold text-white">Go Solar Today</h1>
          </div>
        </div>
        <div className="mt-4 glass-card p-4 bg-white/5 border-white/10">
          <p className="text-sm text-white font-semibold">✅ You qualify for solar financing</p>
          <p className="text-xs text-white/60 mt-1">Based on your energy usage — up to ₦950,000</p>
        </div>
      </div>

      <div className="px-4 pt-4 space-y-3">
        <AnimatePresence mode="wait">
          {/* ELIGIBILITY */}
          {step === 'eligibility' && (
            <motion.div
              key="eligibility"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              className="space-y-3"
            >
              <Card className="p-4">
                <p className="section-title mb-3">Why Solar Makes Sense</p>
                <div className="space-y-3">
                  {[
                    { icon: '💸', label: 'Generator cost', value: '₦45,000/month', color: 'text-status-offline' },
                    { icon: '☀️', label: 'With solar loan payment', value: '₦28,000/month', color: 'text-status-online' },
                    { icon: '🎯', label: 'You save from day one', value: '₦17,000/month', color: 'text-brand-gold' },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center justify-between py-2 border-b border-surface-border last:border-0">
                      <div className="flex items-center gap-2">
                        <span>{item.icon}</span>
                        <p className="text-sm text-text-secondary">{item.label}</p>
                      </div>
                      <p className={`text-sm font-bold tabular-nums ${item.color}`}>{item.value}</p>
                    </div>
                  ))}
                </div>
              </Card>

              <Card className="p-4">
                <p className="section-title mb-3">Partner Bank</p>
                <p className="text-xs text-text-secondary leading-relaxed">
                  GridNode originates your application. Underwriting and lending is done by our partner bank. You never pay GridNode — all loan repayments go directly to the bank.
                </p>
              </Card>

              <button onClick={() => setStep('system')} className="btn-primary w-full">
                Choose My System <ChevronRight size={14} />
              </button>
            </motion.div>
          )}

          {/* SYSTEM SELECTION */}
          {step === 'system' && (
            <motion.div
              key="system"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              className="space-y-3"
            >
              <p className="section-title">Choose Your System</p>
              {SYSTEMS.map((system) => (
                <motion.div
                  key={system.size_kw}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setSelectedSystem(system)}
                  className={clsx(
                    'glass-card p-4 cursor-pointer border-2 transition-all',
                    selectedSystem.size_kw === system.size_kw
                      ? 'border-brand-gold bg-brand-gold/5'
                      : 'border-surface-border',
                  )}
                >
                  <div className="flex items-center gap-4">
                    <div className="text-3xl">{system.emoji}</div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="font-semibold text-text-primary">{system.label}</p>
                        {system.popular && <Badge variant="gold">Most Popular</Badge>}
                      </div>
                      <p className="text-xs text-text-muted">{system.desc}</p>
                      <p className="text-xs text-text-secondary mt-1">
                        ~{system.daily_kwh} kWh/day · saves ~₦{(system.daily_kwh * 30 * 450).toLocaleString('en-NG')}/mo
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-text-primary tabular-nums">
                        ₦{system.price.toLocaleString('en-NG')}
                      </p>
                      <p className="text-xs text-text-muted">system cost</p>
                    </div>
                  </div>
                  {selectedSystem.size_kw === system.size_kw && (
                    <div className="flex justify-end mt-2">
                      <Check size={14} className="text-brand-gold" />
                    </div>
                  )}
                </motion.div>
              ))}

              <button onClick={() => setStep('terms')} className="btn-primary w-full">
                Choose Repayment Terms
              </button>
            </motion.div>
          )}

          {/* TERMS */}
          {step === 'terms' && (
            <motion.div
              key="terms"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              className="space-y-3"
            >
              <p className="section-title">Repayment Period</p>
              <div className="grid gap-3">
                {TERMS.map((months) => {
                  const payment = calcPayment(selectedSystem.price, months);
                  const saving = GEN_COST_MONTHLY - payment;
                  return (
                    <motion.div
                      key={months}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setSelectedTerm(months)}
                      className={clsx(
                        'glass-card p-4 cursor-pointer border-2 transition-all',
                        selectedTerm === months ? 'border-brand-gold bg-brand-gold/5' : 'border-surface-border',
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-text-primary">{months} months</p>
                          <p className="text-xs text-text-muted">{months / 12} year{months > 12 ? 's' : ''} repayment</p>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold text-brand-gold tabular-nums">
                            ₦{payment.toLocaleString('en-NG')}/mo
                          </p>
                          {saving > 0 && (
                            <p className="text-xs text-status-online">You save ₦{saving.toLocaleString('en-NG')}/mo</p>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>

              <button onClick={() => setStep('comparison')} className="btn-primary w-full">
                See Your Savings
              </button>
            </motion.div>
          )}

          {/* COMPARISON */}
          {step === 'comparison' && (
            <motion.div
              key="comparison"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              className="space-y-3"
            >
              <Card className="p-5">
                <p className="section-title mb-4">Your Savings Summary</p>

                <div className="space-y-4">
                  <div className="flex justify-between items-center pb-4 border-b border-surface-border">
                    <p className="text-sm text-text-secondary">Generator cost now</p>
                    <p className="text-lg font-bold text-status-offline tabular-nums">₦{GEN_COST_MONTHLY.toLocaleString('en-NG')}/mo</p>
                  </div>
                  <div className="flex justify-between items-center pb-4 border-b border-surface-border">
                    <p className="text-sm text-text-secondary">Solar loan payment</p>
                    <p className="text-lg font-bold text-status-online tabular-nums">₦{monthly.toLocaleString('en-NG')}/mo</p>
                  </div>
                  <div className="flex justify-between items-center">
                    <p className="text-sm font-bold text-text-primary">You save from day one</p>
                    <p className="text-2xl font-black text-brand-gold tabular-nums">₦{netSaving.toLocaleString('en-NG')}/mo</p>
                  </div>
                </div>
              </Card>

              <Card className="p-4 border border-brand-gold/20 bg-brand-gold/5">
                <div className="flex gap-3">
                  <Sun size={16} className="text-brand-gold flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-text-secondary leading-relaxed">
                    <span className="font-semibold text-text-primary">Partner bank logo</span> — Application reviewed within 48 hours. GridNode does not custody or disburse loans.
                  </p>
                </div>
              </Card>

              {error && <p className="text-status-offline text-xs text-center">{error}</p>}

              <button onClick={handleSubmit} disabled={submitting} className="btn-primary w-full">
                {submitting ? <Loader2 size={16} className="animate-spin" /> : 'Submit Application'}
              </button>

              <button onClick={() => setStep('terms')} className="btn-ghost w-full text-xs">
                ← Change terms
              </button>
            </motion.div>
          )}

          {/* SUBMITTED */}
          {step === 'submitted' && (
            <motion.div
              key="submitted"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center text-center py-8 gap-4"
            >
              <div className="w-20 h-20 rounded-full bg-status-online/15 border-2 border-status-online/50 flex items-center justify-center">
                <Check size={32} className="text-status-online" />
              </div>
              <h2 className="text-xl font-bold text-text-primary">Application Submitted!</h2>
              <p className="text-sm text-text-secondary leading-relaxed max-w-xs">
                Your application for a <strong>{selectedSystem.size_kw} kW</strong> system at{' '}
                <strong>₦{monthly.toLocaleString('en-NG')}/month</strong> has been sent to our partner bank.
                You'll hear back within 48 hours.
              </p>
              <Link to="/" className="btn-primary mt-4">
                Back to Dashboard
              </Link>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
