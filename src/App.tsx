import { useEffect } from 'react';
import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { LoginPage, RegisterPage } from './pages/AuthPage';
import { ChargingPage } from './pages/ChargingPage';
import { HistoryPage } from './pages/HistoryPage';
import { HomePage } from './pages/HomePage';
import { LoyaltyPage } from './pages/LoyaltyPage';
import { MapPage } from './pages/MapPage';
import { NotificationsPage } from './pages/NotificationsPage';
import { OnboardingPage } from './pages/OnboardingPage';
import { PaymentPage } from './pages/PaymentPage';
import { ProfilePage } from './pages/ProfilePage';
import { ScanPage } from './pages/ScanPage';
import { StationDetailPage } from './pages/StationDetailPage';
import { StationsPage } from './pages/StationsPage';
import { ImpressumPage } from './pages/ImpressumPage';
import { PrivacyPage } from './pages/PrivacyPage';
import { SupportPage } from './pages/SupportPage';
import { TermsPage } from './pages/TermsPage';
import { TariffsPage } from './pages/TariffsPage';
import { TripPage } from './pages/TripPage';
import { AccessibilityPage } from './pages/AccessibilityPage';
import { VehiclesPage } from './pages/VehiclesPage';
import { useAppStore } from './store/appStore';

const PUBLIC_PATHS = [
  '/karte',
  '/stationen',
  '/station/',
  '/hilfe',
  '/datenschutz',
  '/impressum',
  '/nutzungsbedingungen',
  '/anmelden',
  '/registrieren',
  '/barrierefreiheit',
];

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

function RequireOnboarding() {
  const onboardingDone = useAppStore((s) => s.onboardingDone);
  const { pathname } = useLocation();
  if (!onboardingDone && !PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return <Navigate to="/onboarding" replace />;
  }
  return <Outlet />;
}

function RequireAuth() {
  const user = useAppStore((s) => s.user);
  if (!user) return <Navigate to="/anmelden" replace />;
  return <Outlet />;
}

function DefaultRedirect() {
  const user = useAppStore((s) => s.user);
  return <Navigate to={user ? '/' : '/karte'} replace />;
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
          <Route element={<AppShell />}>
            <Route element={<RequireOnboarding />}>
              <Route path="/karte" element={<MapPage />} />
              <Route path="/stationen" element={<StationsPage />} />
              <Route path="/station/:id" element={<StationDetailPage />} />
              <Route path="/hilfe" element={<SupportPage />} />
              <Route path="/datenschutz" element={<PrivacyPage />} />
              <Route path="/impressum" element={<ImpressumPage />} />
              <Route path="/nutzungsbedingungen" element={<TermsPage />} />
              <Route path="/barrierefreiheit" element={<AccessibilityPage />} />

              <Route element={<RequireAuth />}>
                <Route path="/" element={<HomePage />} />
                <Route path="/scan" element={<ScanPage />} />
                <Route path="/vorteile" element={<LoyaltyPage />} />
                <Route path="/profil" element={<ProfilePage />} />
                <Route path="/laden" element={<ChargingPage />} />
                <Route path="/reise" element={<TripPage />} />
                <Route path="/historie" element={<HistoryPage />} />
                <Route path="/fahrzeuge" element={<VehiclesPage />} />
                <Route path="/zahlung" element={<PaymentPage />} />
                <Route path="/benachrichtigungen" element={<NotificationsPage />} />
                <Route path="/tarife" element={<TariffsPage />} />
              </Route>
            </Route>
          </Route>
          <Route path="*" element={<DefaultRedirect />} />
        </Routes>
      </Bootstrap>
    </BrowserRouter>
  );
}
