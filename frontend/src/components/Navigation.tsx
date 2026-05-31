import { NavLink, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Zap, Network, Leaf, User, ArrowLeftRight } from 'lucide-react';
import clsx from 'clsx';

const tabs = [
  { path: '/', label: 'Energy', icon: Zap },
  { path: '/network', label: 'Network', icon: Network },
  { path: '/trading', label: 'Trading', icon: ArrowLeftRight },
  { path: '/carbon', label: 'Carbon', icon: Leaf },
  { path: '/profile', label: 'Profile', icon: User },
];

export function Navigation() {
  const location = useLocation();

  return (
    <nav className="tab-bar">
      <div className="flex items-center justify-around px-2 pt-2 pb-1">
        {tabs.map(({ path, label, icon: Icon }) => {
          const isActive =
            path === '/'
              ? location.pathname === '/' || location.pathname.startsWith('/energy')
              : location.pathname.startsWith(path);

          return (
            <NavLink
              key={path}
              to={path}
              className="flex flex-col items-center gap-0.5 py-2 px-4 min-w-[60px]"
            >
              <div className="relative">
                <Icon
                  size={22}
                  className={clsx(
                    'transition-colors duration-200',
                    isActive ? 'text-brand-gold' : 'text-text-muted',
                  )}
                  strokeWidth={isActive ? 2.5 : 1.8}
                />
                {isActive && (
                  <motion.div
                    layoutId="tab-indicator"
                    className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-brand-gold"
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}
              </div>
              <span
                className={clsx(
                  'text-[10px] font-semibold transition-colors duration-200',
                  isActive ? 'text-brand-gold' : 'text-text-muted',
                )}
              >
                {label}
              </span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
