import { format, formatDistanceToNow, intervalToDuration } from 'date-fns';
import { de } from 'date-fns/locale';

export function formatCurrency(eur: number): string {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(eur);
}

export function formatKwh(kwh: number): string {
  return `${kwh.toFixed(2)} kWh`;
}

export function formatPower(kw: number): string {
  return `${kw} kW`;
}

export function formatDate(iso: string): string {
  return format(new Date(iso), 'dd.MM.yyyy HH:mm', { locale: de });
}

export function formatRelative(iso: string): string {
  return formatDistanceToNow(new Date(iso), { addSuffix: true, locale: de });
}

export function formatDuration(seconds: number): string {
  const d = intervalToDuration({ start: 0, end: seconds * 1000 });
  const h = d.hours ?? 0;
  const m = d.minutes ?? 0;
  const s = d.seconds ?? 0;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function formatPoints(n: number): string {
  return new Intl.NumberFormat('de-DE').format(n);
}

export function generateId(prefix: string): string {
  const suffix =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID().replace(/-/g, '').slice(0, 12)
      : Math.random().toString(36).slice(2, 14);
  return `${prefix}_${Date.now()}_${suffix}`;
}

export function generateMembershipId(): string {
  return `BC-${Math.random().toString(36).slice(2, 6).toUpperCase()}${Math.floor(1000 + Math.random() * 9000)}`;
}

export function generateInvoiceNumber(): string {
  const y = new Date().getFullYear();
  const n = Math.floor(100000 + Math.random() * 900000);
  return `BC-${y}-${n}`;
}
