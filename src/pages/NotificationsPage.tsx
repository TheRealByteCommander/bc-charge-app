import { Link } from 'react-router-dom';
import { useAppStore } from '../store/appStore';
import type { NotificationPrefs } from '../types';

const labels: { key: keyof NotificationPrefs; title: string; desc: string }[] = [
  { key: 'sessionComplete', title: 'Ladevorgang beendet', desc: 'Zusammenfassung und Rechnung nach jeder Session' },
  { key: 'promotions', title: 'Aktionen & Angebote', desc: 'Rabatte und saisonale BC-Charge-Kampagnen' },
  { key: 'stationAvailability', title: 'Verfügbarkeit', desc: 'Wenn ein Favorit wieder freie Anschlüsse hat' },
  { key: 'loyaltyUpdates', title: 'BC Points', desc: 'Stufenaufstieg und einlösbare Prämien' },
];

export function NotificationsPage() {
  const user = useAppStore((s) => s.user);
  const updateNotifications = useAppStore((s) => s.updateNotifications);

  if (!user) {
    return (
      <div className="page-shell">
        <Link to="/anmelden" className="btn-primary">
          Anmelden
        </Link>
      </div>
    );
  }

  const toggle = (key: keyof NotificationPrefs) => {
    updateNotifications({ ...user.notifications, [key]: !user.notifications[key] });
  };

  return (
    <div className="page-shell">
      <Link to="/profil" className="text-sm text-bc-accent">
        ← Profil
      </Link>
      <h1 className="mt-4 font-display text-2xl font-bold">Benachrichtigungen</h1>
      <div className="mt-6 space-y-3">
        {labels.map(({ key, title, desc }) => (
          <label
            key={key}
            className="flex cursor-pointer items-center justify-between gap-4 rounded-2xl border border-bc-border bg-bc-elevated p-4"
          >
            <div>
              <p className="font-medium">{title}</p>
              <p className="text-sm text-bc-muted">{desc}</p>
            </div>
            <input
              type="checkbox"
              checked={user.notifications[key]}
              onChange={() => toggle(key)}
              className="h-5 w-5 accent-bc-accent"
            />
          </label>
        ))}
      </div>
    </div>
  );
}
