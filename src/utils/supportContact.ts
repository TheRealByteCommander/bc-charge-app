import { companyInfo } from '../data/company';
import type { ChargingSession } from '../types';
import { displayInvoiceNumber } from './invoice';
import { formatCurrency, formatDate, formatKwh } from './format';

export type SupportTopic = 'emergency' | 'dispute' | 'general';

export function buildSessionSupportText(session: ChargingSession, topic: SupportTopic = 'general'): string {
  const lines = [
    `BC Charge Support-Anfrage (${topic === 'emergency' ? 'Notfall' : topic === 'dispute' ? 'Rechnungsprüfung' : 'Allgemein'})`,
    '',
    `Session-ID: ${session.id}`,
    `Station: ${session.stationName}`,
    `Anschluss: ${session.connectorType} (${session.connectorId})`,
    `EVSE/Connector: ${session.connectorId}`,
    session.citrineosTransactionId ? `OCPP-Transaktion: ${session.citrineosTransactionId}` : null,
    `Start: ${formatDate(session.startedAt)}`,
    session.endedAt ? `Ende: ${formatDate(session.endedAt)}` : 'Status: aktiv',
    `Energie: ${formatKwh(session.energyKwh)}`,
    `Kosten: ${formatCurrency(session.costEur)}`,
    `Tarif: ${formatCurrency(session.pricePerKwh)}/kWh`,
    `Rechnung: ${displayInvoiceNumber(session)}`,
    session.paymentStatus ? `Zahlungsstatus: ${session.paymentStatus}` : null,
    session.stripePaymentIntentId ? `Stripe: ${session.stripePaymentIntentId}` : null,
  ].filter(Boolean);

  if (topic === 'dispute') {
    lines.push('', 'Bitte prüfen Sie die Abrechnung und teilen Sie mir das Ergebnis mit.');
  }
  if (topic === 'emergency') {
    lines.push(
      '',
      'Problem: Ladevorgang lässt sich in der App nicht beenden / Kabel blockiert.',
      'Bitte um Remote-Stopp oder Freigabe des Anschlusses.'
    );
  }

  return lines.join('\n');
}

export function buildSessionSupportMailto(
  session: ChargingSession,
  topic: SupportTopic = 'general'
): string {
  const subject =
    topic === 'emergency'
      ? `BC Charge Notfall – Session ${session.id.slice(-8)}`
      : topic === 'dispute'
        ? `BC Charge Rechnungsprüfung – ${displayInvoiceNumber(session)}`
        : `BC Charge Support – Session ${session.id.slice(-8)}`;

  const body = encodeURIComponent(buildSessionSupportText(session, topic));
  return `mailto:${companyInfo.emailSupport}?subject=${encodeURIComponent(subject)}&body=${body}`;
}

export function buildSupportPhoneUri(): string {
  return `tel:${companyInfo.phoneTel}`;
}

export async function copySessionSupportText(
  session: ChargingSession,
  topic: SupportTopic = 'general'
): Promise<void> {
  await navigator.clipboard.writeText(buildSessionSupportText(session, topic));
}
