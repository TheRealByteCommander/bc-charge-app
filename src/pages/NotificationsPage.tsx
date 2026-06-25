import { Bell, BellOff, BellRing } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  canSendBrowserNotifications,
  notificationPermission,
  requestBrowserNotificationPermission,
} from '../services/browserNotifications';
import { useAppStore } from '../store/appStore';
import type { NotificationPrefs } from '../types';

const serviceLabels: { key: keyof NotificationPrefs; title: string; desc: string }[] = [
  { key: 'sessionComplete', title: 'Ladevorgang beendet', desc: 'Zusammenfassung nach jeder Session (transaktional)' },
  { key: 'stationAvailability', title: 'Verfügbarkeit', desc: 'Favorit hat wieder freie Anschlüsse (Browser-Hinweis)' },
  { key: 'loyaltyUpdates', title: 'BC Points', desc: 'Stufenaufstieg und einlösbare Prämien' },
];

export function NotificationsPage() {
  const user = useAppStore((s) => s.user);
  const updateNotifications = useAppStore((s) => s.updateNotifications);
  const updateProfile = useAppStore((s) => s.updateProfile);
  const [browserPerm, setBrowserPerm] = useState(notificationPermission());

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
    const next = { ...user.notifications, [key]: !user.notifications[key] };
    updateNotifications(next);
    if (key === 'promotions') {
      updateProfile({
        marketingConsentAt: next.promotions ? new Date().toISOString() : null,
      });
    }
  };

  const requestBrowser = async () => {
    const result = await requestBrowserNotificationPermission();
    setBrowserPerm(result);
  };

  const browserEnabled = canSendBrowserNotifications();

  return (
    <div className="page-shell pb-8">
      <Link to="/profil" className="text-sm text-bc-accent">
        ← Profil
      </Link>
      <h1 className="mt-4 font-display text-2xl font-bold">Benachrichtigungen</h1>
      <p className="mt-2 text-sm text-bc-muted">
        Transaktionale Hinweise sind für den Vertrag erforderlich. Werbung nur mit Ihrer Einwilligung
        (§ 7 UWG).{' '}
        <Link to="/datenschutz" className="text-bc-accent">
          Datenschutz
        </Link>
      </p>

      <div className="mt-6 rounded-2xl border border-bc-accent/25 bg-bc-accent/5 p-4">
        <div className="flex items-start gap-3">
          {browserEnabled ? (
            <BellRing className="h-5 w-5 shrink-0 text-bc-accent" />
          ) : browserPerm === 'denied' ? (
            <BellOff className="h-5 w-5 shrink-0 text-bc-warn" />
          ) : (
            <Bell className="h-5 w-5 shrink-0 text-bc-muted" />
          )}
          <div className="min-w-0 flex-1">
            <p className="font-medium">Browser-Hinweise</p>
            <p className="mt-1 text-sm text-bc-muted">
              {browserPerm === 'unsupported'
                ? 'Ihr Browser unterstützt keine Push-Hinweise.'
                : browserEnabled
                  ? 'Aktiv – Sie erhalten Hinweise auch bei minimierter App.'
                  : browserPerm === 'denied'
                    ? 'Blockiert – bitte in den Browser-Einstellungen erlauben.'
                    : 'Optional: Hinweis wenn ein Ladevorgang beendet ist.'}
            </p>
            {browserPerm !== 'unsupported' && browserPerm !== 'denied' && !browserEnabled && (
              <button type="button" className="btn-primary mt-3 py-2 text-sm" onClick={requestBrowser}>
                Browser-Benachrichtigungen erlauben
              </button>
            )}
          </div>
        </div>
      </div>

      <p className="mt-6 text-xs font-semibold uppercase tracking-wider text-bc-muted">Laden & Konto</p>
      <div className="mt-2 space-y-3">
        {serviceLabels.map(({ key, title, desc }) => (
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

      <p className="mt-8 text-xs font-semibold uppercase tracking-wider text-bc-muted">Marketing (optional)</p>
      <label className="mt-2 flex cursor-pointer items-center justify-between gap-4 rounded-2xl border border-bc-accent/25 bg-bc-accent/5 p-4">
        <div>
          <p className="font-medium">Aktionen & Angebote</p>
          <p className="text-sm text-bc-muted">
            Rabatte und Kampagnen – nur mit Einwilligung, jederzeit hier abschaltbar.
          </p>
        </div>
        <input
          type="checkbox"
          checked={user.notifications.promotions}
          onChange={() => toggle('promotions')}
          className="h-5 w-5 accent-bc-accent"
        />
      </label>
    </div>
  );
}
