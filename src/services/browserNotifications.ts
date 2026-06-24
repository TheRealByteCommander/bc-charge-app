import type { ChargingSession } from '../types';
import { formatCurrency, formatKwh } from '../utils/format';

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
  if (!canSendBrowserNotifications()) return;
  try {
    const n = new Notification('Ladevorgang beendet', {
      body: `${session.stationName}: ${formatKwh(session.energyKwh)} · ${formatCurrency(session.costEur)}`,
      icon: '/favicon.svg',
      tag: `bc-session-${session.id}`,
    });
    n.onclick = () => {
      window.focus();
      n.close();
    };
  } catch {
    /* Browser blockiert oder Kontext ungültig */
  }
}
