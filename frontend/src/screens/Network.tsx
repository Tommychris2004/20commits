import { useState } from 'react';
import { motion } from 'framer-motion';
import { Users, Zap, TrendingUp, Copy, Check, ShieldCheck } from 'lucide-react';
import { Card } from '../components/ui/Card.tsx';
import { Badge } from '../components/ui/Badge.tsx';
import { FullPageSkeleton } from '../components/ui/Skeleton.tsx';
import { useApi } from '../hooks/useApi.ts';
import { estateApi, type EstateResponse } from '../api/client.ts';
import { Trading } from './Trading.tsx';
import clsx from 'clsx';

function fmt(n: number) {
  return n.toLocaleString('en-NG');
}

const DEMO_DEVICES = [
  { id: '1', label: 'Home A', status: 'online', solar_kwh: 245, rank: 1 },
  { id: '2', label: 'Home B', status: 'online', solar_kwh: 198, rank: 2 },
  { id: '3', label: 'Home C', status: 'online', solar_kwh: 176, rank: 3 },
  { id: '4', label: 'Home D', status: 'offline', solar_kwh: 120, rank: 4 },
  { id: '5', label: 'Home E', status: 'online', solar_kwh: 98, rank: 5 },
  { id: '6', label: 'You', status: 'online', solar_kwh: 87, rank: 8, isMe: true },
];

type Tab = 'overview' | 'leaderboard' | 'trading';

function NodeDot({ status }: { status: string }) {
  return (
    <motion.div
      className={clsx(
        'w-4 h-4 rounded-full',
        status === 'online' ? 'bg-status-online' : status === 'offline' ? 'bg-status-offline' : 'bg-text-muted',
      )}
      animate={status === 'online' ? { scale: [1, 1.2, 1], opacity: [1, 0.7, 1] } : {}}
      transition={{ duration: 2, repeat: Infinity }}
    />
  );
}

function RankBadge({ rank }: { rank: number }) {
  const medals = ['🥇', '🥈', '🥉'];
  if (rank <= 3) return <span className="text-lg">{medals[rank - 1]}</span>;
  return (
    <div className="w-7 h-7 rounded-full bg-surface-elevated flex items-center justify-center">
      <span className="text-xs font-bold text-text-secondary">#{rank}</span>
    </div>
  );
}

export function Network() {
  const { data, loading } = useApi(estateApi.getEstate);
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [copied, setCopied] = useState(false);

  const estate = data as EstateResponse | null;
  const hasEstate = estate?.has_estate ?? false;

  const onlineCount = estate?.nodes?.online ?? 18;
  const totalCount = estate?.nodes?.total ?? 24;
  const savings = estate?.collective_savings_naira_month ?? 2_400_000;
  const capacityKw = estate?.nodes?.connected_capacity_kw ?? 45;

  const handleCopy = () => {
    navigator.clipboard.writeText('https://gridnode.app/invite/LKP2-ESTATE');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) return <FullPageSkeleton />;

  return (
    <div className="page">
      {/* Header */}
      <div className="brand-header px-4 pt-14 pb-6">
        <p className="text-xs font-semibold text-white/50 uppercase tracking-widest">Community</p>
        <h1 className="text-xl font-bold text-white mt-0.5">
          {hasEstate ? estate?.estate?.name : 'My Network'}
        </h1>
        {hasEstate && estate?.estate?.location && (
          <p className="text-xs text-white/50 mt-1">{estate.estate.location}</p>
        )}

        {/* Node grid */}
        <div className="mt-5 grid grid-cols-8 gap-1.5">
          {Array.from({ length: Math.max(totalCount, 24) }, (_, i) => {
            const status =
              i < onlineCount ? 'online' : i < onlineCount + 3 ? 'offline' : 'not_connected';
            return (
              <motion.div
                key={i}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: i * 0.02 }}
              >
                <NodeDot status={status} />
              </motion.div>
            );
          })}
        </div>

        <p className="text-xs text-white/50 mt-3">
          <span className="font-bold text-white">{onlineCount}</span> of {totalCount} homes online
        </p>
      </div>

      <div className="px-4 pt-4 space-y-3">
        {/* Stats row */}
        <div className="grid grid-cols-2 gap-3">
          <Card className="p-4">
            <p className="text-xs text-text-muted uppercase tracking-widest font-semibold">Estate Savings</p>
            <p className="text-display-sm text-status-online tabular-nums font-bold mt-1">
              ₦{fmt(savings)}
            </p>
            <p className="text-xs text-text-secondary mt-0.5">This month together</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-text-muted uppercase tracking-widest font-semibold">Capacity Online</p>
            <p className="text-display-sm text-brand-gold tabular-nums font-bold mt-1">
              {capacityKw.toFixed(0)} kW
            </p>
            <p className="text-xs text-text-secondary mt-0.5">{onlineCount} active nodes</p>
          </Card>
        </div>

        {/* My contribution */}
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-brand-gold/15 flex items-center justify-center">
              <TrendingUp size={18} className="text-brand-gold" />
            </div>
            <div>
              <p className="text-xs text-text-muted uppercase tracking-widest font-semibold">Your Contribution</p>
              <p className="text-lg font-bold text-text-primary mt-0.5">
                4.2% of estate energy
              </p>
              <p className="text-xs text-status-online mt-0.5">Better than 18 of {totalCount} homes ✓</p>
            </div>
          </div>
        </Card>

        {/* Tab switcher */}
        <div className="flex p-1 gap-1 bg-surface-elevated rounded-2xl">
          {(['overview', 'leaderboard', 'trading'] as Tab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2.5 rounded-xl text-xs font-semibold transition-all duration-200 ${
                activeTab === tab
                  ? 'bg-brand-red text-white shadow-md'
                  : 'text-text-muted hover:text-text-secondary'
              }`}
            >
              {tab === 'overview' ? 'Estate' : tab === 'leaderboard' ? '🏆 Rankings' : '⚡ Trading'}
            </button>
          ))}
        </div>

        {activeTab === 'overview' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
            {/* Node list */}
            <Card className="divide-y divide-surface-border overflow-hidden">
              {(estate?.devices ?? []).slice(0, 8).map((device) => (
                <div key={device.id} className="flex items-center gap-3 p-4">
                  <div className={clsx('status-dot', `status-dot-${device.status}`)} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-text-primary">{device.user_name || device.name || device.node_id}</p>
                    <p className="text-xs text-text-muted">{device.status === 'online' ? 'Live' : 'Last seen: ' + (device.last_seen ? new Date(device.last_seen).toLocaleDateString() : 'Never')}</p>
                  </div>
                  <Badge variant={device.status === 'online' ? 'green' : device.status === 'offline' ? 'red' : 'muted'}>
                    {device.status.replace('_', ' ')}
                  </Badge>
                </div>
              ))}

              {(!estate?.devices || estate.devices.length === 0) && (
                // Demo devices
                <div className="p-4 text-center text-text-muted text-sm">
                  {Array.from({ length: 5 }, (_, i) => (
                    <div key={i} className="flex items-center gap-3 py-2">
                      <div className={`status-dot ${i < 4 ? 'status-dot-online' : 'status-dot-offline'}`} />
                      <p className="text-sm text-text-secondary">Flat {[2, 5, 8, 12, 16][i]}</p>
                      <Badge variant={i < 4 ? 'green' : 'red'} className="ml-auto">
                        {i < 4 ? 'online' : 'offline'}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* Trading notice */}
            <Card className="p-4 border border-surface-border">
              <div className="flex gap-3 items-start">
                <ShieldCheck size={16} className="text-text-muted flex-shrink-0 mt-0.5" />
                <p className="text-xs text-text-secondary leading-relaxed">
                  <span className="font-semibold text-text-primary">Energy trading</span> — peer-to-peer energy sales operate within registered mini-grid clusters under NERC framework. Currently in monitoring mode.
                </p>
              </div>
            </Card>
          </motion.div>
        )}

        {activeTab === 'leaderboard' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2">
            <Card className="p-4 mb-1">
              <p className="text-xs text-text-muted text-center leading-relaxed">
                Rankings reset monthly. Anonymised by home position — never by name.
              </p>
            </Card>

            {DEMO_DEVICES.map((home, i) => (
              <motion.div
                key={home.id}
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.06 }}
              >
                <Card
                  className={clsx('p-4 flex items-center gap-3', home.isMe && 'border border-brand-gold/30 bg-brand-gold/5')}
                >
                  <RankBadge rank={home.rank} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className={clsx('font-semibold text-sm', home.isMe ? 'text-brand-gold' : 'text-text-primary')}>
                        {home.label}
                        {home.isMe && ' (You)'}
                      </p>
                    </div>
                    <p className="text-xs text-text-muted">{home.solar_kwh} kWh solar · {Math.round(home.solar_kwh * 0.75)} kg CO₂ avoided</p>
                  </div>
                  {home.rank <= 3 && (
                    <div className="flex-shrink-0">
                      <Badge variant="gold">Top {home.rank}</Badge>
                    </div>
                  )}
                </Card>
              </motion.div>
            ))}

            <Card className="p-4 border border-brand-gold/15 bg-brand-gold/5 mt-1">
              <p className="text-xs text-brand-gold text-center font-medium">
                Top 3 homes earn on average 40% more carbon credits than the estate average
              </p>
            </Card>
          </motion.div>
        )}

        {activeTab === 'trading' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="-mx-4">
            <Trading />
          </motion.div>
        )}

        {/* Invite */}
        {activeTab !== 'trading' && <Card className="p-4">
          <div className="flex items-center gap-3 mb-3">
            <Users size={16} className="text-brand-gold" />
            <p className="text-sm font-semibold text-text-primary">Invite a Neighbour</p>
          </div>
          <p className="text-xs text-text-secondary mb-3">
            Earn ₦2,000 when they activate their Smart Node.
          </p>
          <button
            onClick={handleCopy}
            className="btn-primary w-full text-sm"
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? 'Copied!' : 'Copy Invite Link'}
          </button>
        </Card>}
      </div>
    </div>
  );
}
