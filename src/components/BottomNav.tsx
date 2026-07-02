import { BatteryCharging, Home, Map, QrCode, Sparkles, User } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { useLocale } from '../i18n/LocaleContext';
import { useAppStore } from '../store/appStore';

type NavKey = 'map' | 'list' | 'login' | 'home' | 'scan' | 'perks' | 'profile' | 'charging';

const guestLinks: { to: string; icon: typeof Map; labelKey: NavKey; end?: boolean }[] = [
  { to: '/karte', icon: Map, labelKey: 'map', end: true },
  { to: '/stationen', icon: Home, labelKey: 'list' },
  { to: '/scan', icon: QrCode, labelKey: 'scan' },
  { to: '/anmelden', icon: User, labelKey: 'login' },
];

const userLinks: { to: string; icon: typeof Map; labelKey: NavKey; end?: boolean; sessionTab?: boolean }[] = [
  { to: '/', icon: Home, labelKey: 'home', end: true },
  { to: '/karte', icon: Map, labelKey: 'map' },
  { to: '/scan', icon: QrCode, labelKey: 'scan', sessionTab: true },
  { to: '/vorteile', icon: Sparkles, labelKey: 'perks' },
  { to: '/profil', icon: User, labelKey: 'profile' },
];

export function BottomNav() {
  const { t } = useLocale();
  const user = useAppStore((s) => s.user);
  const activeSession = useAppStore((s) => s.activeSession);
  const links = user ? userLinks : guestLinks;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-bc-border/80 glass safe-bottom">
      <div className="mx-auto flex max-w-lg items-center justify-around px-1 py-2">
        {links.map((link) => {
          const { to, icon: Icon, labelKey, ...rest } = link;
          const isSessionTab = 'sessionTab' in link && link.sessionTab;
          const target = isSessionTab && activeSession ? '/laden' : to;
          const DisplayIcon = isSessionTab && activeSession ? BatteryCharging : Icon;
          const label = t.nav[labelKey];

          return (
            <NavLink
              key={to}
              to={target}
              end={'end' in rest ? rest.end : undefined}
              className={({ isActive }) =>
                `a11y-nav-link relative flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-xl px-1 py-2 text-[10px] font-medium transition sm:text-xs ${
                  isActive || (isSessionTab && activeSession)
                    ? 'text-bc-accent'
                    : 'text-bc-muted hover:text-bc-text'
                }`
              }
            >
              {({ isActive }: { isActive: boolean }) => (
                <>
                  <span className="relative">
                    <DisplayIcon
                      className={`h-5 w-5 shrink-0 ${
                        isActive || (isSessionTab && activeSession) ? 'text-bc-accent' : ''
                      } ${isSessionTab && activeSession ? 'animate-charge' : ''}`}
                    />
                    {isSessionTab && activeSession ? (
                      <span className="absolute -right-1 -top-1 flex h-2.5 w-2.5">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-bc-accent opacity-60" />
                        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-bc-accent" />
                      </span>
                    ) : null}
                  </span>
                  <span className="truncate">{isSessionTab && activeSession ? t.nav.charging : label}</span>
                </>
              )}
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
