import { useState } from 'react';
import { motion } from 'framer-motion';
import { Eye, EyeOff, Zap, Loader2 } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import { authApi } from '../api/client.ts';
import { setAuth } from '../store/index.ts';

type Mode = 'login' | 'register';

export function Login() {
  const [mode, setMode] = useState<Mode>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      let result;
      if (mode === 'login') {
        result = await authApi.login(email, password);
      } else {
        result = await authApi.register({ email, password, name });
      }
      setAuth(result.access_token, result.user);
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top brand area */}
      <div className="brand-header px-6 pt-16 pb-12 flex flex-col items-center text-center">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="w-16 h-16 rounded-2xl bg-brand-gold/20 border border-brand-gold/30 flex items-center justify-center mb-4"
        >
          <Zap size={28} className="text-brand-gold fill-brand-gold" />
        </motion.div>
        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-3xl font-black text-white"
        >
          GridNode
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="text-sm text-white/50 mt-1"
        >
          Smart Energy for Nigerian Homes
        </motion.p>
      </div>

      {/* Form */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="flex-1 px-6 pt-8 bg-surface"
      >
        {/* Mode toggle */}
        <div className="flex p-1 gap-1 bg-surface-elevated rounded-2xl mb-6">
          {(['login', 'register'] as Mode[]).map((m) => (
            <button
              key={m}
              onClick={() => { setMode(m); setError(''); }}
              className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${
                mode === m ? 'bg-brand-red text-white' : 'text-text-muted'
              }`}
            >
              {m === 'login' ? 'Sign In' : 'Create Account'}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'register' && (
            <div>
              <label className="text-xs text-text-muted font-semibold uppercase tracking-wider block mb-1.5">
                Full Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Chidi Okeke"
                required
                className="w-full bg-surface-elevated border border-surface-border rounded-xl px-4 py-3 text-text-primary placeholder-text-muted focus:outline-none focus:border-brand-gold transition-colors"
              />
            </div>
          )}

          <div>
            <label className="text-xs text-text-muted font-semibold uppercase tracking-wider block mb-1.5">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              className="w-full bg-surface-elevated border border-surface-border rounded-xl px-4 py-3 text-text-primary placeholder-text-muted focus:outline-none focus:border-brand-gold transition-colors"
            />
          </div>

          <div>
            <label className="text-xs text-text-muted font-semibold uppercase tracking-wider block mb-1.5">
              Password
            </label>
            <div className="relative">
              <input
                type={showPass ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={mode === 'register' ? 'At least 8 characters' : '••••••••'}
                required
                minLength={mode === 'register' ? 8 : 1}
                className="w-full bg-surface-elevated border border-surface-border rounded-xl px-4 py-3 pr-12 text-text-primary placeholder-text-muted focus:outline-none focus:border-brand-gold transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowPass((s) => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted"
              >
                {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {error && (
            <motion.p
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-status-offline text-xs text-center"
            >
              {error}
            </motion.p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full mt-6 py-4 text-base"
          >
            {loading ? (
              <Loader2 size={18} className="animate-spin" />
            ) : mode === 'login' ? (
              'Sign In'
            ) : (
              'Create Account'
            )}
          </button>
        </form>

        {/* Demo mode */}
        <div className="mt-6 pt-6 border-t border-surface-border text-center">
          <p className="text-xs text-text-muted mb-3">Or try without an account</p>
          <Link to="/" className="btn-secondary text-sm py-2.5 px-6 inline-flex">
            Explore Demo Mode
          </Link>
        </div>

        <p className="text-xs text-text-muted text-center mt-6 pb-8 leading-relaxed">
          Your energy data is protected under NDPA 2023. We never sell your data.
        </p>
      </motion.div>
    </div>
  );
}
