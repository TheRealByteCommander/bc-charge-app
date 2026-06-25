import type { ChargingSession, Station } from '../types';
import { formatCurrency, formatKwh } from '../utils/format';

const ICON = '/bc-icon.svg';

function showNotification(title: string, body: string, tag: string, path?: string): void {
  if (!canSendBrowserNotifications()) return;
  try {
    const n = new Notification(title, { body, icon: ICON, tag });
    n.onclick = () => {
      window.focus();
      if (path) window.location.assign(path);
      n.close();
    };
  } catch {
    /* Browser blockiert oder Kontext ungültig */
  }
}

export function notificationPermission(): NotificationPermission | 'unsupported' {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
  return Notification.permission;
}

export async function requestBrowserNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
  if (Notification.permission === 'granted') return 'granted';
  if (Notification.permission === 'denied') return 'denied';
  return Notification.requestPermission();
}

export function canSendBrowserNotifications(): boolean {
  return notificationPermission() === 'granted';
}

export function notifySessionComplete(session: ChargingSession): void {
  showNotification(
    'Ladevorgang beendet',
    `${session.stationName}: ${formatKwh(session.energyKwh)} · ${formatCurrency(session.costEur)}`,
    `bc-session-${session.id}`,
    '/historie'
  );
}

export function notifyFavoriteAvailable(station: Station, availableCount: number): void {
  showNotification(
    'Favorit wieder frei',
    `${station.name}: ${availableCount} Anschluss${availableCount === 1 ? '' : 'e'} verfügbar`,
    `bc-fav-${station.id}`,
    `/station/${station.id}`
  );
}
