import { Home, Map, QrCode, Gift, User } from 'lucide-react';
import { NavLink } from 'react-router-dom';

const links = [
  { to: '/', icon: Home, label: 'Start' },
  { to: '/karte', icon: Map, label: 'Karte' },
  { to: '/scan', icon: QrCode, label: 'Scan' },
  { to: '/vorteile', icon: Gift, label: 'Vorteile' },
  { to: '/profil', icon: User, label: 'Profil' },
];

export function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-bc-border/80 glass safe-bottom">
      <div className="mx-auto flex max-w-lg items-center justify-around px-2 py-2">
        {links.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 rounded-xl px-3 py-2 text-xs font-medium transition ${
                isActive ? 'text-bc-accent' : 'text-bc-muted hover:text-bc-text'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Icon className={`h-5 w-5 ${isActive ? 'drop-shadow-[0_0_8px_rgba(46,229,157,0.6)]' : ''}`} />
                <span>{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
