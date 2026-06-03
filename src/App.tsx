import { useEffect } from 'react';
import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { LoginPage, RegisterPage } from './pages/AuthPage';
import { ChargePlanPage } from './pages/ChargePlanPage';
import { ChargingPage } from './pages/ChargingPage';
import { HistoryPage } from './pages/HistoryPage';
import { HomePage } from './pages/HomePage';
import { LoyaltyPage } from './pages/LoyaltyPage';
import { MapPage } from './pages/MapPage';
import { NotificationsPage } from './pages/NotificationsPage';
import { OnboardingPage } from './pages/OnboardingPage';
import { PaymentPage } from './pages/PaymentPage';
import { ProfilePage } from './pages/ProfilePage';
import { RoamingPage } from './pages/RoamingPage';
import { ScanPage } from './pages/ScanPage';
import { StationDetailPage } from './pages/StationDetailPage';
import { StationsPage } from './pages/StationsPage';
import { PrivacyPage } from './pages/PrivacyPage';
import { SupportPage } from './pages/SupportPage';
import { TariffsPage } from './pages/TariffsPage';
import { VehiclesPage } from './pages/VehiclesPage';
import { useAppStore } from './store/appStore';

function Bootstrap({ children }: { children: React.ReactNode }) {
  const initialized = useAppStore((s) => s.initialized);
  const init = useAppStore((s) => s.init);

  useEffect(() => {
    void init();
  }, [init]);

  if (!initialized) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-bc-ink">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-bc-accent border-t-transparent" />
      </div>
    );
  }

  return <>{children}</>;
}

/** Geschützte App-Bereiche: Onboarding + Anmeldung erforderlich. */
function RequireSession() {
  const onboardingDone = useAppStore((s) => s.onboardingDone);
  const user = useAppStore((s) => s.user);

  if (!onboardingDone) {
    return <Navigate to="/onboarding" replace />;
  }
  if (!user) {
    return <Navigate to="/anmelden" replace />;
  }
  return <Outlet />;
}

export default function App() {
  return (
    <BrowserRouter
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}
    >
      <Bootstrap>
        <Routes>
          <Route path="/onboarding" element={<OnboardingPage />} />
          <Route path="/anmelden" element={<LoginPage />} />
          <Route path="/registrieren" element={<RegisterPage />} />
          <Route element={<RequireSession />}>
            <Route element={<AppShell />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/karte" element={<MapPage />} />
            <Route path="/scan" element={<ScanPage />} />
            <Route path="/vorteile" element={<LoyaltyPage />} />
            <Route path="/profil" element={<ProfilePage />} />
            <Route path="/stationen" element={<StationsPage />} />
            <Route path="/station/:id" element={<StationDetailPage />} />
            <Route path="/laden" element={<ChargingPage />} />
            <Route path="/ladeplanung" element={<ChargePlanPage />} />
            <Route path="/historie" element={<HistoryPage />} />
            <Route path="/fahrzeuge" element={<VehiclesPage />} />
            <Route path="/zahlung" element={<PaymentPage />} />
            <Route path="/benachrichtigungen" element={<NotificationsPage />} />
            <Route path="/tarife" element={<TariffsPage />} />
            <Route path="/roaming" element={<RoamingPage />} />
            <Route path="/hilfe" element={<SupportPage />} />
            <Route path="/datenschutz" element={<PrivacyPage />} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Bootstrap>
    </BrowserRouter>
  );
}
