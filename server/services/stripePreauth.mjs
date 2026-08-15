/**
 * Shared Stripe pre-authorization helpers for account + ad-hoc charging.
 * Flow: authorize hold → start power → capture actual (or cancel hold).
 */

/** Default €50 hold; clamp 5–250 € via env BC_PREAUTH_CENTS / BC_ADHOC_PREAUTH_CENTS. */
export function getPreauthCents() {
  const raw = Number(process.env.BC_PREAUTH_CENTS ?? process.env.BC_ADHOC_PREAUTH_CENTS ?? 5000);
  return Math.min(25_000, Math.max(500, Number.isFinite(raw) ? raw : 5000));
}

/**
 * Capture amount for a completed session, never above the hold.
 * Stripe minimum capture is 50 cents when charging; callers may cancel instead of capturing 0.
 */
export function computeCaptureCents(costEur, preAuthCents = getPreauthCents()) {
  const hold = Math.min(25_000, Math.max(500, Number(preAuthCents) || getPreauthCents()));
  const costCents = Math.round(Number(costEur) * 100);
  if (!Number.isFinite(costCents) || costCents <= 0) return 0;
  return Math.min(hold, Math.max(50, costCents));
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
