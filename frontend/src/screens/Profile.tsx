import { motion } from 'framer-motion';
import { User, LogOut, Smartphone, ChevronRight, Shield, HelpCircle, Sun } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { Card } from '../components/ui/Card.tsx';
import { Badge } from '../components/ui/Badge.tsx';
import { useAuth, clearAuth } from '../store/index.ts';

interface MenuItemProps {
  icon: typeof User;
  label: string;
  sublabel?: string;
  to?: string;
  onClick?: () => void;
  badge?: string;
  danger?: boolean;
}

function MenuItem({ icon: Icon, label, sublabel, to, onClick, badge, danger }: MenuItemProps) {
  const inner = (
    <div className={`flex items-center gap-4 p-4 ${danger ? 'text-status-offline' : 'text-text-primary'}`}>
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${danger ? 'bg-status-offline/15' : 'bg-surface-elevated'}`}>
        <Icon size={16} className={danger ? 'text-status-offline' : 'text-text-secondary'} />
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium ${danger ? 'text-status-offline' : 'text-text-primary'}`}>{label}</p>
        {sublabel && <p className="text-xs text-text-muted mt-0.5">{sublabel}</p>}
      </div>
      {badge && <Badge variant="gold">{badge}</Badge>}
      <ChevronRight size={14} className="text-text-muted" />
    </div>
  );

  if (to) return <Link to={to}>{inner}</Link>;
  if (onClick) return <button className="w-full text-left" onClick={onClick}>{inner}</button>;
  return <div>{inner}</div>;
}

export function Profile() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    clearAuth();
    navigate('/login');
  };

  return (
    <div className="page">
      {/* Header */}
      <div className="brand-header px-4 pt-14 pb-8">
        <div className="flex flex-col items-center text-center">
          <div className="w-20 h-20 rounded-3xl bg-white/10 border border-white/20 flex items-center justify-center mb-4">
            <span className="text-3xl font-bold text-white">
              {user?.name?.[0]?.toUpperCase() ?? '?'}
            </span>
          </div>
          <h1 className="text-xl font-bold text-white">{user?.name ?? 'GridNode User'}</h1>
          <p className="text-sm text-white/50 mt-1">{user?.email ?? 'Not logged in'}</p>
          <div className="mt-2">
            <Badge variant="outline">
              <span className="text-white/60 capitalize">{user?.role ?? 'resident'}</span>
            </Badge>
          </div>
        </div>
      </div>

      <div className="px-4 pt-4 space-y-3">
        {/* Device */}
        <Card className="divide-y divide-surface-border overflow-hidden p-0">
          <div className="p-4 pb-0">
            <p className="section-title pb-3">Device</p>
          </div>
          <MenuItem icon={Smartphone} label="My Smart Node" sublabel="Tap to manage your device" to="/onboarding" />
        </Card>

        {/* Account */}
        <Card className="divide-y divide-surface-border overflow-hidden p-0">
          <div className="p-4 pb-0">
            <p className="section-title pb-3">Account</p>
          </div>
          <MenuItem icon={Sun} label="Solar Financing" sublabel="Apply for solar installation" to="/financing" />
          <MenuItem icon={Shield} label="Data Privacy" sublabel="Your energy data is personal data (NDPA 2023)" to="/privacy" />
          <MenuItem icon={HelpCircle} label="Help & Support" sublabel="Get assistance" />
        </Card>

        {/* Legal disclaimer */}
        <Card className="p-4">
          <p className="text-xs text-text-muted leading-relaxed text-center">
            GridNode monitors energy and estimates savings. Carbon credits are estimates — not sellable credits. No energy trading in this version. All data subject to NDPA 2023.
          </p>
        </Card>

        {/* Logout */}
        <Card className="divide-y divide-surface-border overflow-hidden p-0">
          <MenuItem icon={LogOut} label="Sign Out" danger onClick={handleLogout} />
        </Card>

        <p className="text-center text-xs text-text-muted pb-4">
          GridNode v1.0.0 · Verdaxis Group · Monitoring Only
        </p>
      </div>
    </div>
  );
}
