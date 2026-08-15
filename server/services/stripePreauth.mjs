/**
 * Shared Stripe pre-authorization helpers for account + ad-hoc charging.
 * Flow: authorize hold → start power → capture actual (or cancel hold).
 */

/** Stripe card minimum when capturing a positive charge. */
export const STRIPE_MIN_CAPTURE_CENTS = 50;

/** Default €50 hold; clamp 5–250 € via env BC_PREAUTH_CENTS / BC_ADHOC_PREAUTH_CENTS. */
export function getPreauthCents() {
  const raw = Number(process.env.BC_PREAUTH_CENTS ?? process.env.BC_ADHOC_PREAUTH_CENTS ?? 5000);
  return Math.min(25_000, Math.max(500, Number.isFinite(raw) ? raw : 5000));
}

/**
 * Capture amount for a completed session, never above the hold.
 * Stripe minimum capture is 50 cents when charging; callers may cancel instead of capturing 0.
 * Important: invoice/total charged must use this same amount (not raw energy cost alone).
 */
export function computeCaptureCents(costEur, preAuthCents = getPreauthCents()) {
  const hold = Math.min(25_000, Math.max(500, Number(preAuthCents) || getPreauthCents()));
  const costCents = Math.round(Number(costEur) * 100);
  if (!Number.isFinite(costCents) || costCents <= 0) return 0;
  return Math.min(hold, Math.max(STRIPE_MIN_CAPTURE_CENTS, costCents));
}

/** Euro amount that was/will be charged — source of truth for invoice totals. */
export function billedEurFromCaptureCents(captureCents) {
  const cents = Math.round(Number(captureCents));
  if (!Number.isFinite(cents) || cents <= 0) return 0;
  return Math.round(cents) / 100;
}

/**
 * Align session billing fields with Stripe capture so invoice == charged amount.
 * Keeps energy/usage breakdown via baseCostEur when the card minimum lifts the total.
 */
export function applyCaptureToSessionBilling(session, captureCents) {
  const cents = Math.round(Number(captureCents) || 0);
  const amountChargedEur = billedEurFromCaptureCents(cents);
  const usageCost = Number(session?.costEur);
  const baseCostEur =
    session?.baseCostEur != null && Number.isFinite(Number(session.baseCostEur))
      ? Number(session.baseCostEur)
      : Number.isFinite(usageCost)
        ? usageCost
        : 0;
  return {
    ...session,
    baseCostEur,
    captureCents: cents,
    amountChargedEur,
    // Billable total must match Stripe — never leave invoice on raw 0.03 while card took 0.50.
    costEur: amountChargedEur > 0 ? amountChargedEur : Number.isFinite(usageCost) ? usageCost : 0,
  };
}

/** True when PI is authorized and ready for later capture (or already succeeded). */
export function isAuthorizedForStart(status) {
  return status === 'requires_capture' || status === 'succeeded';
}

export function mapPaymentStatusFromIntent(status) {
  if (status === 'succeeded') return 'paid';
  if (status === 'processing' || status === 'requires_capture') return 'pending';
  if (status === 'canceled' || status === 'cancelled') return 'skipped';
  return 'failed';
}
