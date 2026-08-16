/**
 * Account micro-billing:
 * - Single-session usage under threshold is deferred (no card capture, no invoice).
 * - When open deferred balance + current usage reaches threshold, settle as Sammelrechnung.
 */

export const ACCOUNT_SETTLE_THRESHOLD_EUR = Number(process.env.BC_ACCOUNT_SETTLE_EUR ?? 1);
export const ACCOUNT_SETTLE_THRESHOLD_CENTS = Math.round(ACCOUNT_SETTLE_THRESHOLD_EUR * 100);

export function toCents(eur) {
  const n = Number(eur);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.round(n * 100);
}

export function fromCents(cents) {
  return Math.round(Number(cents) || 0) / 100;
}

/** Usage cost for a session (prefer base/usage, not card-minimum inflated cost). */
export function sessionUsageCents(session) {
  if (session == null) return 0;
  if (session.usageCostEur != null && Number.isFinite(Number(session.usageCostEur))) {
    return toCents(session.usageCostEur);
  }
  if (session.baseCostEur != null && Number.isFinite(Number(session.baseCostEur))) {
    return toCents(session.baseCostEur);
  }
  // Only trust costEur when not already a captured card-minimum stand-in without base.
  return toCents(session.costEur);
}

export function isDeferredSession(session) {
  if (!session || session.status !== 'completed') return false;
  // Explicit zero-usage completions are never open balance.
  if (session.billingStatus === 'waived' || session.paymentStatus === 'skipped') {
    if (sessionUsageCents(session) <= 0) return false;
  }
  if (session.billingStatus === 'deferred') return true;
  if (session.paymentStatus === 'deferred') return true;
  // Uninvoiced completed micro amount still open
  if (
    !session.invoiceNumber &&
    (session.paymentStatus === 'skipped' || session.paymentStatus === 'pending') &&
    sessionUsageCents(session) > 0 &&
    sessionUsageCents(session) < ACCOUNT_SETTLE_THRESHOLD_CENTS &&
    !session.amountChargedEur
  ) {
    return true;
  }
  return false;
}

/** Zero-usage completed session: release hold, no open balance, no invoice. */
export function markSessionWaived(session) {
  return {
    ...session,
    status: 'completed',
    usageCostEur: 0,
    baseCostEur: session.baseCostEur ?? 0,
    costEur: 0,
    amountChargedEur: 0,
    captureCents: 0,
    paymentStatus: 'skipped',
    billingStatus: 'waived',
    waivedAt: new Date().toISOString(),
  };
}

export function sumUsageCents(sessions) {
  return sessions.reduce((acc, s) => acc + sessionUsageCents(s), 0);
}

/**
 * Decide whether to settle now.
 * @returns {{ settle: boolean, totalCents: number, reason: string }}
 */
export function shouldSettleAccountCharges({ deferredSessions = [], currentSession }) {
  const open = deferredSessions.filter((s) => s.id !== currentSession?.id);
  const currentCents = sessionUsageCents(currentSession);
  const openCents = sumUsageCents(open);
  const totalCents = openCents + currentCents;

  if (totalCents <= 0) {
    return { settle: false, totalCents: 0, reason: 'zero' };
  }
  if (totalCents >= ACCOUNT_SETTLE_THRESHOLD_CENTS) {
    return {
      settle: true,
      totalCents,
      reason: currentCents >= ACCOUNT_SETTLE_THRESHOLD_CENTS ? 'session_or_batch_threshold' : 'batch_threshold',
    };
  }
  return { settle: false, totalCents, reason: 'below_threshold' };
}

/** Build one PDF/line-item friendly charge row per session. */
export function buildSessionLineItem(session) {
  const usageEur = fromCents(sessionUsageCents(session));
  const minutes =
    session.endedAt && session.startedAt
      ? Math.max(0, (new Date(session.endedAt) - new Date(session.startedAt)) / 60000)
      : 0;
  const energyKwh = Number(session.energyKwh) || 0;
  const pricePerKwh = Number(session.pricePerKwh) || 0;
  const sessionFee = Number(session.sessionFee) || 0;
  const pricePerMin = Number(session.pricePerMin) || 0;
  const energyEur = Math.round(energyKwh * pricePerKwh * 100) / 100;
  const timeEur = Math.round(minutes * pricePerMin * 100) / 100;
  const discount = Number(session.rewardDiscountEur) || 0;

  const when = session.endedAt || session.startedAt || '';
  const labelCore = [
    session.stationName || 'Ladepunkt',
    session.connectorType,
    session.powerKw != null ? `${session.powerKw} kW` : null,
    session.evseNumber != null ? `LP ${session.evseNumber}` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return {
    sessionId: session.id,
    label: `Ladevorgang ${labelCore}`,
    detail: [
      when ? new Date(when).toLocaleString('de-DE') : null,
      energyKwh > 0 ? `${energyKwh.toFixed(3)} kWh` : null,
      session.id ? `Ref. ${session.id}` : null,
    ]
      .filter(Boolean)
      .join(' · '),
    energyKwh,
    pricePerKwh,
    energyEur,
    sessionFee,
    timeEur,
    minutes,
    discount,
    usageEur,
    startedAt: session.startedAt,
    endedAt: session.endedAt,
    stationName: session.stationName,
  };
}

/**
 * Build collective invoice payload for PDF + email.
 * totalEur is the amount charged on the card (must match Stripe).
 */
export function buildCollectiveInvoiceSession({
  batchId,
  sessions,
  totalEur,
  paymentStatus = 'paid',
  stripePaymentIntentId,
  paymentMethodId,
  customerHint,
}) {
  const items = sessions.map(buildSessionLineItem);
  const energyKwh = items.reduce((a, i) => a + (i.energyKwh || 0), 0);
  const startedAt = sessions
    .map((s) => s.startedAt)
    .filter(Boolean)
    .sort()[0];
  const endedAt = sessions
    .map((s) => s.endedAt || s.startedAt)
    .filter(Boolean)
    .sort()
    .at(-1);
  const captureCents = toCents(totalEur);

  return {
    id: batchId,
    stationId: 'batch',
    stationName: `Sammelrechnung (${sessions.length} Ladevorgänge)`,
    connectorId: 'batch',
    connectorType: 'Type2',
    powerKw: 0,
    vehicleId: sessions.find((s) => s.vehicleId)?.vehicleId || '',
    paymentMethodId: paymentMethodId || sessions.find((s) => s.paymentMethodId)?.paymentMethodId || '',
    startedAt: startedAt || new Date().toISOString(),
    endedAt: endedAt || new Date().toISOString(),
    status: 'completed',
    energyKwh: Math.round(energyKwh * 1000) / 1000,
    costEur: Math.round(Number(totalEur) * 100) / 100,
    amountChargedEur: Math.round(Number(totalEur) * 100) / 100,
    captureCents,
    baseCostEur: Math.round(Number(totalEur) * 100) / 100,
    usageCostEur: Math.round(Number(totalEur) * 100) / 100,
    pricePerKwh: 0,
    sessionFee: 0,
    pointsEarned: 0,
    paymentStatus,
    stripePaymentIntentId,
    billingStatus: 'invoiced',
    invoiceKind: 'collective',
    batchId,
    batchSessionIds: sessions.map((s) => s.id),
    lineItems: items,
    isCollectiveInvoice: true,
    customerHint,
  };
}

export function markSessionsDeferred(session, { openBalanceCents } = {}) {
  const usageCents = sessionUsageCents(session);
  const usageEur = fromCents(usageCents);
  return {
    ...session,
    status: 'completed',
    usageCostEur: usageEur,
    baseCostEur: session.baseCostEur ?? usageEur,
    costEur: usageEur,
    amountChargedEur: 0,
    captureCents: 0,
    paymentStatus: 'deferred',
    billingStatus: 'deferred',
    // No individual invoice while deferred
    invoiceNumber: session.invoiceNumber || undefined,
    deferredAt: new Date().toISOString(),
    openBalanceAfterCents: openBalanceCents,
  };
}

export function markSessionsSettled(sessions, {
  invoiceNumber,
  batchId,
  totalEur,
  stripePaymentIntentId,
  paymentStatus = 'paid',
  captureCents,
}) {
  const charged = Math.round(Number(totalEur) * 100) / 100;
  const cents = captureCents != null ? Math.round(captureCents) : toCents(charged);
  return sessions.map((s) => {
    const usageEur = fromCents(sessionUsageCents(s));
    return {
      ...s,
      status: 'completed',
      usageCostEur: usageEur,
      baseCostEur: s.baseCostEur ?? usageEur,
      // Per-session display stays usage; batch carries charged total.
      costEur: usageEur,
      paymentStatus,
      billingStatus: 'invoiced',
      invoiceNumber,
      invoiceKind: sessions.length > 1 ? 'collective' : 'single',
      batchId,
      batchTotalEur: charged,
      amountChargedEur: sessions.length === 1 ? charged : usageEur,
      captureCents: sessions.length === 1 ? cents : undefined,
      stripePaymentIntentId: stripePaymentIntentId || s.stripePaymentIntentId,
      settledAt: new Date().toISOString(),
    };
  });
}
