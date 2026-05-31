import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { Navigation } from './components/Navigation.tsx';
import { EnergyDashboard } from './screens/EnergyDashboard.tsx';
import { EnergyHistory } from './screens/EnergyHistory.tsx';
import { Network } from './screens/Network.tsx';
import { Trading } from './screens/Trading.tsx';
import { CarbonDashboard } from './screens/Carbon/CarbonDashboard.tsx';
import { Profile } from './screens/Profile.tsx';
import { Onboarding } from './screens/Onboarding.tsx';
import { Financing } from './screens/Financing.tsx';
import { Login } from './screens/Login.tsx';
import { useAuth } from './store/index.ts';

// Pages that should NOT show the bottom navigation
const FULLSCREEN_ROUTES = ['/login', '/onboarding'];

function AppShell() {
  const { accessToken } = useAuth();
  const location = useLocation();
  const showNav = !FULLSCREEN_ROUTES.some((r) => location.pathname.startsWith(r));

  return (
    <div className="max-w-md mx-auto relative min-h-screen bg-surface">
      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname}>
          {/* Auth */}
          <Route path="/login" element={<Login />} />

          {/* Fullscreen flows */}
          <Route path="/onboarding" element={<Onboarding />} />

          {/* Main app */}
          <Route path="/" element={<EnergyDashboard />} />
          <Route path="/energy" element={<EnergyDashboard />} />
          <Route path="/history" element={<EnergyHistory />} />
          <Route path="/network" element={<Network />} />
          <Route path="/trading" element={<Trading />} />
          <Route path="/carbon" element={<CarbonDashboard />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/financing" element={<Financing />} />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AnimatePresence>

      {showNav && <Navigation />}
    </div>
  );
}

export default function App() {
  return <AppShell />;
}
