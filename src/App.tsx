import { lazy, useEffect } from 'react';
import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { LoginPage, RegisterPage } from './pages/AuthPage';
import { OnboardingPage } from './pages/OnboardingPage';
import { useAppStore } from './store/appStore';

const HomePage = lazy(() => import('./pages/HomePage').then((m) => ({ default: m.HomePage })));
const MapPage = lazy(() => import('./pages/MapPage').then((m) => ({ default: m.MapPage })));
const StationsPage = lazy(() => import('./pages/StationsPage').then((m) => ({ default: m.StationsPage })));
const StationDetailPage = lazy(() =>
  import('./pages/StationDetailPage').then((m) => ({ default: m.StationDetailPage }))
);
const ChargingPage = lazy(() => import('./pages/ChargingPage').then((m) => ({ default: m.ChargingPage })));
const ScanPage = lazy(() => import('./pages/ScanPage').then((m) => ({ default: m.ScanPage })));
const ProfilePage = lazy(() => import('./pages/ProfilePage').then((m) => ({ default: m.ProfilePage })));
const HistoryPage = lazy(() => import('./pages/HistoryPage').then((m) => ({ default: m.HistoryPage })));
const TripPage = lazy(() => import('./pages/TripPage').then((m) => ({ default: m.TripPage })));
const LoyaltyPage = lazy(() => import('./pages/LoyaltyPage').then((m) => ({ default: m.LoyaltyPage })));
const VehiclesPage = lazy(() => import('./pages/VehiclesPage').then((m) => ({ default: m.VehiclesPage })));
const PaymentPage = lazy(() => import('./pages/PaymentPage').then((m) => ({ default: m.PaymentPage })));
const NotificationsPage = lazy(() =>
  import('./pages/NotificationsPage').then((m) => ({ default: m.NotificationsPage }))
);
const TariffsPage = lazy(() => import('./pages/TariffsPage').then((m) => ({ default: m.TariffsPage })));
const SupportPage = lazy(() => import('./pages/SupportPage').then((m) => ({ default: m.SupportPage })));
const PrivacyPage = lazy(() => import('./pages/PrivacyPage').then((m) => ({ default: m.PrivacyPage })));
const ImpressumPage = lazy(() => import('./pages/ImpressumPage').then((m) => ({ default: m.ImpressumPage })));
const TermsPage = lazy(() => import('./pages/TermsPage').then((m) => ({ default: m.TermsPage })));
const AccessibilityPage = lazy(() =>
  import('./pages/AccessibilityPage').then((m) => ({ default: m.AccessibilityPage }))
);

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
      <div className="flex min-h-dvh items-center justify-center bg-bc-surface">
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
