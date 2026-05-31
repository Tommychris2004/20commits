import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ArrowRight, Check, Loader2 } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { devicesApi } from '../api/client.ts';

const STEPS = [
  {
    id: 'find',
    title: 'Find Your Smart Node',
    desc: 'Locate the GridNode Smart Node box — it looks like a small white box with LED lights on the front.',
    visual: (
      <div className="relative mx-auto w-40 h-40">
        <div className="absolute inset-0 rounded-3xl border-2 border-brand-gold/40 bg-gradient-to-b from-surface-elevated to-surface-card flex flex-col items-center justify-center gap-2">
          <div className="text-4xl">📦</div>
          <div className="flex gap-2 mt-2">
            <div className="w-2 h-2 rounded-full bg-status-offline animate-pulse" />
            <div className="w-2 h-2 rounded-full bg-text-muted" />
            <div className="w-2 h-2 rounded-full bg-text-muted" />
          </div>
          <p className="text-xs text-text-muted mt-1 font-mono">GRIDNODE</p>
        </div>
      </div>
    ),
  },
  {
    id: 'connect',
    title: 'Connect to Your System',
    desc: 'Plug the CT clamp sensors into your generator, solar inverter, and/or distribution board. Connections are labeled A, B, and C.',
    visual: (
      <div className="relative mx-auto w-48 h-40 flex items-center justify-center gap-4">
        {['A', 'B', 'C'].map((label, i) => (
          <div key={label} className="flex flex-col items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-brand-red flex items-center justify-center text-white font-bold text-sm">
              {label}
            </div>
            <div className="w-0.5 h-8 bg-brand-gold/40" />
            <div className="text-xs text-text-muted">{['Gen', 'Solar', 'Grid'][i]}</div>
          </div>
        ))}
      </div>
    ),
  },
  {
    id: 'power',
    title: 'Power On Your Node',
    desc: 'Connect the USB-C power cable. Watch the LED sequence to confirm startup.',
    visual: (
      <div className="mx-auto w-full max-w-xs space-y-3">
        {[
          { color: 'bg-status-offline animate-pulse', label: 'Blinking Red', desc: 'Starting up — wait 30 seconds' },
          { color: 'bg-status-offline', label: 'Solid Red', desc: 'Ready to connect' },
          { color: 'bg-brand-gold', label: 'Solid Gold', desc: 'Connecting to GridNode...' },
          { color: 'bg-status-online animate-pulse', label: 'Green Flash', desc: 'Connected! ✓' },
        ].map((led) => (
          <div key={led.label} className="flex items-center gap-3">
            <div className={`w-4 h-4 rounded-full flex-shrink-0 ${led.color}`} />
            <div>
              <p className="text-xs font-semibold text-text-primary">{led.label}</p>
              <p className="text-xs text-text-muted">{led.desc}</p>
            </div>
          </div>
        ))}
      </div>
    ),
  },
  {
    id: 'register',
    title: 'Enter Your Node ID',
    desc: 'Find the 8-character code printed on the label on the bottom of your Smart Node.',
    visual: null,
    hasInput: true,
  },
  {
    id: 'confirm',
    title: "You're Live!",
    desc: 'Your Smart Node is connected. First reading will appear in the dashboard within 60 seconds.',
    visual: (
      <div className="flex flex-col items-center gap-4">
        <motion.div
          animate={{ scale: [1, 1.15, 1] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="w-24 h-24 rounded-full bg-status-online/15 border-2 border-status-online/50 flex items-center justify-center"
        >
          <Check size={36} className="text-status-online" />
        </motion.div>
        <div className="flex gap-1">
          {[0, 0.2, 0.4, 0.6, 0.8].map((d) => (
            <motion.div
              key={d}
              animate={{ scaleY: [1, 2, 1], opacity: [0.4, 1, 0.4] }}
              transition={{ duration: 1, delay: d, repeat: Infinity }}
              className="w-1 h-4 rounded-full bg-status-online"
            />
          ))}
        </div>
        <p className="text-xs text-text-muted">Live — receiving readings</p>
      </div>
    ),
  },
];

export function Onboarding() {
  const [step, setStep] = useState(0);
  const [nodeId, setNodeId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const currentStep = STEPS[step];
  const isLast = step === STEPS.length - 1;
  const isRegisterStep = currentStep.id === 'register';

  const handleNext = async () => {
    if (isRegisterStep) {
      if (nodeId.length !== 8) {
        setError('Node ID must be 8 characters');
        return;
      }
      setError('');
      setLoading(true);
      try {
        await devicesApi.register(nodeId.toUpperCase());
        setStep((s) => s + 1);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Registration failed');
      } finally {
        setLoading(false);
      }
      return;
    }

    if (isLast) {
      navigate('/');
      return;
    }
    setStep((s) => s + 1);
  };

  return (
    <div className="min-h-screen bg-surface flex flex-col">
      {/* Header */}
      <div className="brand-header px-4 pt-14 pb-6">
        <div className="flex items-center gap-3 mb-4">
          {step > 0 && !isLast && (
            <button
              onClick={() => setStep((s) => s - 1)}
              className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center"
            >
              <ArrowLeft size={16} className="text-white" />
            </button>
          )}
          <div>
            <p className="text-xs font-semibold text-white/50 uppercase tracking-widest">Node Setup</p>
            <p className="text-white font-semibold mt-0.5">
              Step {step + 1} of {STEPS.length}
            </p>
          </div>
          <div className="ml-auto flex gap-1">
            {STEPS.map((_, i) => (
              <div
                key={i}
                className={`h-1 rounded-full transition-all duration-300 ${
                  i === step ? 'w-6 bg-brand-gold' : i < step ? 'w-3 bg-brand-gold/50' : 'w-3 bg-white/20'
                }`}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 px-6 pt-8 flex flex-col">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-col flex-1"
          >
            {/* Visual */}
            <div className="flex items-center justify-center py-8 min-h-[180px]">
              {currentStep.visual}
            </div>

            {/* Title & desc */}
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-text-primary">{currentStep.title}</h2>
              <p className="text-text-secondary text-sm mt-2 leading-relaxed max-w-xs mx-auto">
                {currentStep.desc}
              </p>
            </div>

            {/* Node ID input */}
            {isRegisterStep && (
              <div className="mb-6">
                <input
                  type="text"
                  value={nodeId}
                  onChange={(e) => setNodeId(e.target.value.toUpperCase().slice(0, 8))}
                  placeholder="e.g. GN2B4X7K"
                  className="w-full bg-surface-elevated border border-surface-border rounded-2xl px-4 py-4 text-center text-2xl font-bold tracking-widest text-text-primary placeholder-text-muted focus:outline-none focus:border-brand-gold transition-colors font-mono"
                  maxLength={8}
                  autoCapitalize="characters"
                />
                {error && (
                  <p className="text-status-offline text-xs text-center mt-2">{error}</p>
                )}
                <p className="text-xs text-text-muted text-center mt-2">
                  Found on the label on the bottom of your device
                </p>
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {/* CTA */}
        <div className="pb-8 mt-auto">
          <button
            onClick={handleNext}
            disabled={loading || (isRegisterStep && nodeId.length !== 8)}
            className="btn-primary w-full disabled:opacity-50"
          >
            {loading ? (
              <Loader2 size={16} className="animate-spin" />
            ) : isLast ? (
              'Go to Dashboard'
            ) : isRegisterStep ? (
              'Connect My Node'
            ) : (
              <>Next <ArrowRight size={14} /></>
            )}
          </button>

          {step === 0 && (
            <Link to="/" className="block text-center text-text-muted text-xs mt-4">
              Skip — I'll set up later
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
