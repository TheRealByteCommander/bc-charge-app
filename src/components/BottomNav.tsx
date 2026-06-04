import { Home, Map, QrCode, Sparkles, User } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { useAppStore } from '../store/appStore';

const guestLinks = [
  { to: '/karte', icon: Map, label: 'Karte', end: true },
  { to: '/stationen', icon: Home, label: 'Stationen' },
  { to: '/anmelden', icon: User, label: 'Anmelden' },
] as const;

const userLinks = [
  { to: '/', icon: Home, label: 'Start', end: true },
  { to: '/karte', icon: Map, label: 'Karte' },
  { to: '/scan', icon: QrCode, label: 'Laden' },
  { to: '/vorteile', icon: Sparkles, label: 'Vorteile' },
  { to: '/profil', icon: User, label: 'Profil' },
] as const;

export function BottomNav() {
  const user = useAppStore((s) => s.user);
  const links = user ? userLinks : guestLinks;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-bc-border/80 glass safe-bottom">
      <div className="mx-auto flex max-w-lg items-center justify-around px-1 py-2">
        {links.map(({ to, icon: Icon, label, ...rest }) => (
          <NavLink
            key={to}
            to={to}
            end={'end' in rest ? rest.end : undefined}
            className={({ isActive }) =>
              `a11y-nav-link flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-xl px-1 py-2 text-[10px] font-medium transition sm:text-xs ${
                isActive ? 'text-bc-accent' : 'text-bc-muted hover:text-bc-text'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Icon className={`h-5 w-5 shrink-0 ${isActive ? 'text-bc-accent' : ''}`} />
                <span className="truncate">{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
