import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Zap, TrendingUp, TrendingDown, Plus, Pause, Edit3,
  X, CheckCircle, ArrowDownLeft, ArrowUpRight, ChevronRight,
  Smartphone, ShoppingCart,
} from 'lucide-react';
import { Card } from '../components/ui/Card.tsx';
import { Badge } from '../components/ui/Badge.tsx';
import { FullPageSkeleton } from '../components/ui/Skeleton.tsx';
import { useApi } from '../hooks/useApi.ts';
import { tradingApi, type TradeOffer, type Trade, type TradingMarketResponse } from '../api/client.ts';
import clsx from 'clsx';

function fmt(n: number) { return n.toLocaleString('en-NG'); }

type TradingTab = 'marketplace' | 'my_offers' | 'history';

// ─── Buy Modal ────────────────────────────────────────────────────────────────
function BuyModal({
  offer,
  onClose,
  onSuccess,
}: {
  offer: TradeOffer;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [qty, setQty] = useState(Math.min(1, offer.quantity_kwh));
  const [step, setStep] = useState<'confirm' | 'success'>('confirm');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const gross = parseFloat((qty * offer.price_per_kwh).toFixed(2));
  const commission = parseFloat((gross * 0.03).toFixed(2));

  const handleBuy = async () => {
    setLoading(true);
    setError('');
    try {
      await tradingApi.buyOffer(offer.id, qty);
      setStep('success');
      setTimeout(() => { onSuccess(); onClose(); }, 2200);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Trade failed');
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm">
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 300 }}
        className="w-full max-w-md bg-surface-card rounded-t-3xl p-6 pb-10 shadow-2xl"
      >
        {step === 'confirm' ? (
          <>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-text-primary">Buy Energy</h3>
              <button onClick={onClose} className="w-8 h-8 rounded-full bg-surface-elevated flex items-center justify-center">
                <X size={16} className="text-text-muted" />
              </button>
            </div>

            <div className="bg-surface-elevated rounded-2xl p-4 mb-5">
              <div className="flex items-center justify-between mb-1">
                <p className="text-sm text-text-muted">Seller</p>
                <p className="text-sm font-semibold text-text-primary">{offer.seller_label}</p>
              </div>
              <div className="flex items-center justify-between">
                <p className="text-sm text-text-muted">Price</p>
                <p className="text-sm font-semibold text-brand-gold">₦{fmt(offer.price_per_kwh)}/kWh</p>
              </div>
            </div>

            <div className="mb-5">
              <label className="text-xs font-semibold text-text-muted uppercase tracking-widest mb-2 block">
                Amount (kWh)
              </label>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setQty(q => Math.max(0.1, parseFloat((q - 0.1).toFixed(1))))}
                  className="w-10 h-10 rounded-2xl bg-surface-elevated flex items-center justify-center text-text-primary font-bold text-lg"
                >−</button>
                <div className="flex-1 bg-surface-elevated rounded-2xl px-4 py-3 text-center">
                  <span className="text-xl font-bold text-text-primary tabular-nums">{qty.toFixed(1)}</span>
                  <span className="text-sm text-text-muted ml-1">kWh</span>
                </div>
                <button
                  onClick={() => setQty(q => Math.min(offer.quantity_kwh, parseFloat((q + 0.1).toFixed(1))))}
                  className="w-10 h-10 rounded-2xl bg-surface-elevated flex items-center justify-center text-text-primary font-bold text-lg"
                >+</button>
              </div>
              <p className="text-xs text-text-muted text-center mt-1">Max {offer.quantity_kwh.toFixed(2)} kWh available</p>
            </div>

            {/* Cost breakdown */}
            <div className="bg-surface-elevated rounded-2xl p-4 mb-5 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-text-muted">Energy cost</span>
                <span className="text-text-primary font-medium">₦{fmt(gross)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-text-muted">Platform fee (3%)</span>
                <span className="text-text-muted">₦{fmt(commission)}</span>
              </div>
              <div className="border-t border-surface-border pt-2 flex justify-between">
                <span className="text-sm font-semibold text-text-primary">You pay</span>
                <span className="text-lg font-bold text-brand-gold">₦{fmt(gross)}</span>
              </div>
            </div>

            <div className="flex items-center gap-2 mb-5 p-3 bg-brand-gold/10 rounded-xl">
              <Smartphone size={14} className="text-brand-gold flex-shrink-0" />
              <p className="text-xs text-brand-gold">Settlement via mobile money within 60 seconds</p>
            </div>

            {error && <p className="text-xs text-status-offline text-center mb-3">{error}</p>}

            <button
              onClick={handleBuy}
              disabled={loading}
              className="btn-primary w-full disabled:opacity-50"
            >
              {loading ? 'Processing…' : `Confirm — ₦${fmt(gross)}`}
            </button>
          </>
        ) : (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center py-8"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', delay: 0.1 }}
              className="w-20 h-20 rounded-full bg-status-online/15 flex items-center justify-center mx-auto mb-4"
            >
              <CheckCircle size={40} className="text-status-online" />
            </motion.div>
            <h3 className="text-xl font-bold text-text-primary mb-2">Trade Confirmed!</h3>
            <p className="text-sm text-text-secondary">
              {qty.toFixed(1)} kWh from {offer.seller_label}
            </p>
            <p className="text-xs text-text-muted mt-2">Settlement via mobile money in 60s</p>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}

// ─── Create Offer Modal ───────────────────────────────────────────────────────
function CreateOfferModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [price, setPrice] = useState(180);
  const [qty, setQty] = useState(2.0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const handleCreate = async () => {
    setLoading(true);
    setError('');
    try {
      await tradingApi.createOffer(price, qty);
      setDone(true);
      setTimeout(() => { onSuccess(); onClose(); }, 1800);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to create offer');
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm">
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 300 }}
        className="w-full max-w-md bg-surface-card rounded-t-3xl p-6 pb-10 shadow-2xl"
      >
        {!done ? (
          <>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-text-primary">Sell Solar Surplus</h3>
              <button onClick={onClose} className="w-8 h-8 rounded-full bg-surface-elevated flex items-center justify-center">
                <X size={16} className="text-text-muted" />
              </button>
            </div>

            <div className="space-y-5 mb-6">
              <div>
                <label className="text-xs font-semibold text-text-muted uppercase tracking-widest mb-2 block">
                  Your price (₦/kWh)
                </label>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setPrice(p => Math.max(50, p - 10))}
                    className="w-10 h-10 rounded-2xl bg-surface-elevated flex items-center justify-center text-text-primary font-bold"
                  >−</button>
                  <div className="flex-1 bg-surface-elevated rounded-2xl px-4 py-3 text-center">
                    <span className="text-xl font-bold text-brand-gold tabular-nums">₦{price}</span>
                  </div>
                  <button
                    onClick={() => setPrice(p => Math.min(2000, p + 10))}
                    className="w-10 h-10 rounded-2xl bg-surface-elevated flex items-center justify-center text-text-primary font-bold"
                  >+</button>
                </div>
                <p className="text-xs text-text-muted text-center mt-1">Grid rate ₦68 · Generator rate ₦450</p>
              </div>

              <div>
                <label className="text-xs font-semibold text-text-muted uppercase tracking-widest mb-2 block">
                  Quantity available (kWh)
                </label>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setQty(q => Math.max(0.1, parseFloat((q - 0.1).toFixed(1))))}
                    className="w-10 h-10 rounded-2xl bg-surface-elevated flex items-center justify-center text-text-primary font-bold"
                  >−</button>
                  <div className="flex-1 bg-surface-elevated rounded-2xl px-4 py-3 text-center">
                    <span className="text-xl font-bold text-text-primary tabular-nums">{qty.toFixed(1)} kWh</span>
                  </div>
                  <button
                    onClick={() => setQty(q => Math.min(100, parseFloat((q + 0.1).toFixed(1))))}
                    className="w-10 h-10 rounded-2xl bg-surface-elevated flex items-center justify-center text-text-primary font-bold"
                  >+</button>
                </div>
              </div>
            </div>

            <div className="bg-surface-elevated rounded-2xl p-4 mb-5">
              <p className="text-xs text-text-muted mb-2">You'll earn (after 3% platform fee)</p>
              <p className="text-2xl font-bold text-status-online">
                ₦{fmt(parseFloat((qty * price * 0.97).toFixed(0)))}
              </p>
              <p className="text-xs text-text-muted mt-1">Offer expires in 24 hours</p>
            </div>

            {error && <p className="text-xs text-status-offline text-center mb-3">{error}</p>}

            <button onClick={handleCreate} disabled={loading} className="btn-primary w-full disabled:opacity-50">
              {loading ? 'Creating…' : 'Post Offer'}
            </button>
          </>
        ) : (
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-8">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', delay: 0.1 }}
              className="w-20 h-20 rounded-full bg-brand-gold/15 flex items-center justify-center mx-auto mb-4"
            >
              <Zap size={40} className="text-brand-gold" />
            </motion.div>
            <h3 className="text-xl font-bold text-text-primary mb-2">Offer Live!</h3>
            <p className="text-sm text-text-secondary">Your surplus is now visible to estate neighbours</p>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}

// ─── Offer Card (marketplace) ─────────────────────────────────────────────────
function MarketplaceCard({ offer, onBuy }: { offer: TradeOffer; onBuy: (o: TradeOffer) => void }) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <Card className="p-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-brand-gold/15 flex items-center justify-center flex-shrink-0">
            <Zap size={18} className="text-brand-gold" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <p className="font-semibold text-sm text-text-primary">{offer.seller_label}</p>
              <p className="text-lg font-bold text-brand-gold tabular-nums">₦{fmt(offer.price_per_kwh)}/kWh</p>
            </div>
            <div className="flex items-center justify-between mt-0.5">
              <p className="text-xs text-text-muted">{offer.quantity_kwh.toFixed(2)} kWh available</p>
              <p className="text-xs text-text-muted">Est. ₦{fmt(parseFloat((offer.price_per_kwh * offer.quantity_kwh).toFixed(0)))}</p>
            </div>
          </div>
        </div>
        <button
          onClick={() => onBuy(offer)}
          className="mt-3 w-full py-2.5 rounded-xl bg-brand-gold text-black text-sm font-bold flex items-center justify-center gap-1.5 hover:bg-brand-gold/90 transition-colors"
        >
          <ShoppingCart size={14} />
          Buy Energy
        </button>
      </Card>
    </motion.div>
  );
}

// ─── My Offer Card ────────────────────────────────────────────────────────────
function MyOfferCard({
  offer,
  onPause,
  onEdit,
  refetch,
}: {
  offer: TradeOffer;
  onPause: () => void;
  onEdit: () => void;
  refetch: () => void;
}) {
  const [pausing, setPausing] = useState(false);

  const handlePause = async () => {
    setPausing(true);
    try {
      await tradingApi.updateOffer(offer.id, { status: 'cancelled' });
      refetch();
    } finally {
      setPausing(false);
    }
  };

  return (
    <Card className="p-4 border border-brand-gold/25 bg-brand-gold/5">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-2xl bg-brand-gold/20 flex items-center justify-center flex-shrink-0">
          <Zap size={18} className="text-brand-gold" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <p className="font-semibold text-sm text-text-primary">Your Solar Surplus</p>
            <Badge variant="gold">Live</Badge>
          </div>
          <p className="text-lg font-bold text-brand-gold tabular-nums">
            ₦{fmt(offer.price_per_kwh)}/kWh
          </p>
          <p className="text-xs text-text-muted mt-0.5">{offer.quantity_kwh.toFixed(2)} kWh available · 3% platform fee</p>
        </div>
      </div>
      <div className="flex gap-2 mt-3">
        <button
          onClick={onEdit}
          className="flex-1 py-2 rounded-xl border border-brand-gold/40 text-brand-gold text-xs font-semibold flex items-center justify-center gap-1.5 hover:bg-brand-gold/10 transition-colors"
        >
          <Edit3 size={12} /> Edit
        </button>
        <button
          onClick={handlePause}
          disabled={pausing}
          className="flex-1 py-2 rounded-xl border border-surface-border text-text-muted text-xs font-semibold flex items-center justify-center gap-1.5 hover:border-status-offline/40 hover:text-status-offline transition-colors disabled:opacity-50"
        >
          <Pause size={12} /> {pausing ? '…' : 'Pause'}
        </button>
      </div>
    </Card>
  );
}

// ─── Trade History Row ────────────────────────────────────────────────────────
function TradeRow({ trade }: { trade: Trade }) {
  const isBuy = trade.side === 'buy';
  return (
    <div className="flex items-center gap-3 p-4 border-b border-surface-border last:border-0">
      <div className={clsx(
        'w-9 h-9 rounded-2xl flex items-center justify-center flex-shrink-0',
        isBuy ? 'bg-status-online/15' : 'bg-brand-gold/15',
      )}>
        {isBuy
          ? <ArrowDownLeft size={16} className="text-status-online" />
          : <ArrowUpRight size={16} className="text-brand-gold" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-text-primary">
          {isBuy ? `Bought from ${trade.seller_label}` : `Sold to neighbour`}
        </p>
        <p className="text-xs text-text-muted">
          {trade.quantity_kwh.toFixed(2)} kWh · ₦{fmt(trade.price_per_kwh)}/kWh · {new Date(trade.traded_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })}
        </p>
      </div>
      <div className="text-right flex-shrink-0">
        <p className={clsx('text-sm font-bold tabular-nums', isBuy ? 'text-status-offline' : 'text-status-online')}>
          {isBuy ? '−' : '+'}₦{fmt(isBuy ? trade.gross_naira : trade.seller_naira)}
        </p>
        <p className="text-xs text-text-muted capitalize">{trade.status}</p>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export function Trading() {
  const [activeTab, setActiveTab] = useState<TradingTab>('marketplace');
  const [buyTarget, setBuyTarget] = useState<TradeOffer | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [refetchKey, setRefetchKey] = useState(0);

  const refetch = useCallback(() => setRefetchKey((k) => k + 1), []);

  const { data: market, loading: marketLoading } = useApi(tradingApi.getOffers, [refetchKey]);
  const { data: historyData, loading: historyLoading } = useApi(tradingApi.getHistory, [refetchKey]);

  const data = market as TradingMarketResponse | null;
  const trades = (historyData as { trades: Trade[] } | null)?.trades ?? [];

  const earnings = data?.monthly_earnings_naira ?? 0;
  const myOffers = data?.my_offers ?? [];
  const offers = data?.offers ?? [];

  // Demo offers if empty (so the UI is never blank for new users)
  const displayOffers: TradeOffer[] = offers.length > 0 ? offers : [
    { id: 'demo-1', seller_label: 'Node 7F2A', price_per_kwh: 180, quantity_kwh: 2.3, status: 'active', is_mine: false, created_at: new Date().toISOString(), expires_at: null },
    { id: 'demo-2', seller_label: 'Node 3B9C', price_per_kwh: 210, quantity_kwh: 1.1, status: 'active', is_mine: false, created_at: new Date().toISOString(), expires_at: null },
    { id: 'demo-3', seller_label: 'Node A4E1', price_per_kwh: 225, quantity_kwh: 3.7, status: 'active', is_mine: false, created_at: new Date().toISOString(), expires_at: null },
  ];

  if (marketLoading) return <FullPageSkeleton />;

  return (
    <>
      <div className="pb-8">
        {/* Header */}
        <div className="brand-header px-4 pt-14 pb-6">
          <p className="text-xs font-semibold text-white/50 uppercase tracking-widest">P2P Energy</p>
          <h1 className="text-xl font-bold text-white mt-0.5">Trading Marketplace</h1>
          <p className="text-xs text-white/50 mt-1">Buy solar from neighbours · Sell your surplus</p>

          {/* Earnings banner */}
          <div className="mt-5 bg-white/10 backdrop-blur-sm rounded-2xl p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-white/60 font-semibold uppercase tracking-widest">Trading Earnings</p>
              <p className="text-2xl font-bold text-brand-gold tabular-nums mt-0.5">
                ₦{fmt(earnings)}
              </p>
              <p className="text-xs text-white/50">This month</p>
            </div>
            <div className="text-right">
              <div className="w-12 h-12 rounded-2xl bg-brand-gold/20 flex items-center justify-center">
                <TrendingUp size={22} className="text-brand-gold" />
              </div>
            </div>
          </div>
        </div>

        <div className="px-4 pt-4 space-y-3">
          {/* Tabs */}
          <div className="flex p-1 gap-1 bg-surface-elevated rounded-2xl">
            {(['marketplace', 'my_offers', 'history'] as TradingTab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-2.5 rounded-xl text-xs font-semibold transition-all duration-200 ${
                  activeTab === tab ? 'bg-brand-red text-white shadow-md' : 'text-text-muted hover:text-text-secondary'
                }`}
              >
                {tab === 'marketplace' ? '⚡ Market' : tab === 'my_offers' ? '📋 My Offers' : '📜 History'}
              </button>
            ))}
          </div>

          {/* ── Marketplace tab ── */}
          {activeTab === 'marketplace' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs text-text-muted font-medium">
                  {displayOffers.length} offer{displayOffers.length !== 1 ? 's' : ''} available
                </p>
                <Badge variant="muted">Sorted: cheapest first</Badge>
              </div>

              {displayOffers.map((offer, i) => (
                <motion.div key={offer.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}>
                  <MarketplaceCard offer={offer} onBuy={setBuyTarget} />
                </motion.div>
              ))}

              <Card className="p-4 border border-surface-border">
                <div className="flex items-center gap-2 text-xs text-text-muted leading-relaxed">
                  <Zap size={13} className="text-text-muted flex-shrink-0" />
                  <span>
                    P2P energy trades settle via mobile money. GridNode charges 3% commission.
                    Sellers are anonymised — you only see node IDs, never names.
                  </span>
                </div>
              </Card>
            </motion.div>
          )}

          {/* ── My Offers tab ── */}
          {activeTab === 'my_offers' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
              {myOffers.length > 0 ? (
                myOffers.map((offer) => (
                  <MyOfferCard
                    key={offer.id}
                    offer={offer}
                    onPause={() => refetch()}
                    onEdit={() => setShowCreate(true)}
                    refetch={refetch}
                  />
                ))
              ) : (
                <Card className="p-6 text-center">
                  <div className="w-14 h-14 rounded-2xl bg-brand-gold/10 flex items-center justify-center mx-auto mb-3">
                    <Zap size={24} className="text-brand-gold/60" />
                  </div>
                  <p className="text-sm font-semibold text-text-primary mb-1">No active offers</p>
                  <p className="text-xs text-text-muted mb-4">
                    Selling solar surplus earns you ₦150–₦250 per kWh from neighbours.
                  </p>
                  <button onClick={() => setShowCreate(true)} className="btn-primary mx-auto flex items-center gap-2">
                    <Plus size={14} />
                    Sell Solar Surplus
                  </button>
                </Card>
              )}

              {myOffers.length > 0 && (
                <button
                  onClick={() => setShowCreate(true)}
                  className="w-full py-3 rounded-2xl border-2 border-dashed border-brand-gold/30 text-brand-gold text-sm font-semibold flex items-center justify-center gap-2 hover:border-brand-gold/60 transition-colors"
                >
                  <Plus size={16} />
                  Post New Offer
                </button>
              )}
            </motion.div>
          )}

          {/* ── History tab ── */}
          {activeTab === 'history' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              {historyLoading ? (
                <div className="space-y-3">
                  {[1,2,3].map(i => <div key={i} className="h-16 rounded-2xl bg-surface-elevated animate-pulse" />)}
                </div>
              ) : trades.length > 0 ? (
                <Card className="overflow-hidden divide-y divide-surface-border">
                  {trades.map((trade) => <TradeRow key={trade.id} trade={trade} />)}
                </Card>
              ) : (
                <Card className="p-8 text-center">
                  <TrendingDown size={32} className="text-text-muted mx-auto mb-3" />
                  <p className="text-sm font-semibold text-text-primary mb-1">No trades yet</p>
                  <p className="text-xs text-text-muted">
                    Your completed buys and sales will appear here.
                  </p>
                  <button
                    onClick={() => setActiveTab('marketplace')}
                    className="mt-4 text-xs text-brand-gold font-semibold flex items-center gap-1 mx-auto"
                  >
                    Browse marketplace <ChevronRight size={12} />
                  </button>
                </Card>
              )}
            </motion.div>
          )}
        </div>
      </div>

      {/* Modals */}
      <AnimatePresence>
        {buyTarget && (
          <BuyModal
            offer={buyTarget}
            onClose={() => setBuyTarget(null)}
            onSuccess={refetch}
          />
        )}
        {showCreate && (
          <CreateOfferModal
            onClose={() => setShowCreate(false)}
            onSuccess={refetch}
          />
        )}
      </AnimatePresence>
    </>
  );
}
