import { AnimatePresence, motion } from 'framer-motion';
import { Suspense, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { checkFavoriteAvailability } from '../services/favoriteAvailability';
import { useAppStore } from '../store/appStore';
import { BottomNav } from './BottomNav';
import { GeoConsentBanner } from './GeoConsentBanner';
import { InstallPrompt } from './InstallPrompt';
import { getGeoConsent } from '../utils/geoConsent';

const hideNav = ['/onboarding', '/anmelden', '/registrieren', '/laden'];

function PageLoader() {
  return (
    <div className="flex flex-1 items-center justify-center py-24">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-bc-accent border-t-transparent" />
    </div>
  );
}

export function AppShell() {
  const location = useLocation();
  const toast = useAppStore((s) => s.setToast);
  const message = useAppStore((s) => s.toast);
  const tickSession = useAppStore((s) => s.tickSession);
  const activeSession = useAppStore((s) => s.activeSession);
  const user = useAppStore((s) => s.user);
  const stationDataSource = useAppStore((s) => s.stationDataSource);
  const showNav = !hideNav.some((p) => location.pathname.startsWith(p));

  useEffect(() => {
    if (!activeSession) return;
    const id = setInterval(() => tickSession(), 2000);
    return () => clearInterval(id);
  }, [activeSession, tickSession]);

  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => toast(null), 3500);
    return () => clearTimeout(t);
  }, [message, toast]);

  useEffect(() => {
    if (getGeoConsent() === 'granted') {
      useAppStore.getState().requestUserLocation();
    }
  }, []);

  useEffect(() => {
    checkFavoriteAvailability(user);
    const id = setInterval(() => checkFavoriteAvailability(useAppStore.getState().user), 60_000);
    return () => clearInterval(id);
  }, [user, stationDataSource]);

  useEffect(() => {
    const { citrineosConnected, refreshCitrineosData } = useAppStore.getState();
    if (!citrineosConnected) return;
    
    const refreshInterval = setInterval(() => {
      const state = useAppStore.getState();
      if (state.citrineosConnected && !state.citrineosSyncing) {
        void refreshCitrineosData();
      }
    }, 120_000);
    
    return () => clearInterval(refreshInterval);
  }, [stationDataSource]);

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col bg-bc-gradient bg-hero-mesh">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-xl focus:bg-bc-accent focus:px-4 focus:py-2 focus:text-bc-ink focus:outline-none"
      >
        Zum Inhalt springen
      </a>
      <main id="main-content" className="flex min-h-0 flex-1 flex-col outline-none">
        <Suspense fallback={<PageLoader />}>
          <Outlet />
        </Suspense>
      </main>
      <GeoConsentBanner />
      {showNav && <BottomNav />}
      <InstallPrompt />
      <AnimatePresence>
        {message && (
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            className="fixed bottom-24 left-4 right-4 z-[60] mx-auto max-w-lg rounded-2xl border border-bc-accent/40 bg-bc-elevated px-4 py-3 text-center text-sm font-medium text-bc-accent shadow-glow"
          >
            {message}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
