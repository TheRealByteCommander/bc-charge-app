import { AnimatePresence, motion } from 'framer-motion';
import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { useAppStore } from '../store/appStore';
import { BottomNav } from './BottomNav';
import { getGeoConsent } from '../utils/geoConsent';
import { GeoConsentBanner } from './GeoConsentBanner';

const hideNav = ['/onboarding', '/anmelden', '/registrieren', '/laden'];

export function AppShell() {
  const location = useLocation();
  const toast = useAppStore((s) => s.setToast);
  const message = useAppStore((s) => s.toast);
  const tickSession = useAppStore((s) => s.tickSession);
  const activeSession = useAppStore((s) => s.activeSession);
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

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col bg-bc-gradient bg-hero-mesh">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-xl focus:bg-bc-accent focus:px-4 focus:py-2 focus:text-bc-ink focus:outline-none"
      >
        Zum Inhalt springen
      </a>
      <main id="main-content" className="flex min-h-0 flex-1 flex-col outline-none">
        <Outlet />
      </main>
      <GeoConsentBanner />
      {showNav && <BottomNav />}
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
