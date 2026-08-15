/**
 * Settle deferred account micro-charges when open balance + current >= €1.
 * Issues Sammelrechnung with per-session line items.
 */
import Stripe from 'stripe';
import {
  findUserById,
  listDeferredSessions,
  rowToProfile,
  upsertSession,
} from '../db.mjs';
import {
  buildCollectiveInvoiceSession,
  fromCents,
  markSessionsDeferred,
  markSessionsSettled,
  sessionUsageCents,
  shouldSettleAccountCharges,
  toCents,
} from './accountBilling.mjs';
import { issueInvoiceForSession } from './invoices.mjs';

const stripeSecret = process.env.STRIPE_SECRET_KEY;
const stripe = stripeSecret ? new Stripe(stripeSecret) : null;

function batchIdFor(sessions) {
  const ids = sessions.map((s) => s.id).sort().join('_');
  const hash = ids.split('').reduce((a, c) => ((a << 5) - a + c.charCodeAt(0)) | 0, 0);
  return `batch_${Math.abs(hash).toString(36)}_${Date.now().toString(36)}`;
}

/**
 * After a session completes with known usage cost, either:
 * - defer (under €1 total open), or
 * - charge open+current and issue collective/single invoice.
 *
 * @param {object} opts
 * @param {string} opts.userId
 * @param {object} opts.session - completed session with usage cost
 * @param {string} [opts.paymentMethodId]
 * @param {string} [opts.preauthPaymentIntentId] - hold to cancel when deferring / not capturing session amount
 * @param {boolean} [opts.chargeOnCard=true]
 */
export async function finalizeAccountSessionBilling({
  userId,
  session,
  paymentMethodId,
  preauthPaymentIntentId,
  chargeOnCard = true,
}) {
  const usageCents = sessionUsageCents(session);
  const usageEur = fromCents(usageCents);

  // Normalize usage fields on the completing session first
  let current = {
    ...session,
    status: 'completed',
    endedAt: session.endedAt ?? new Date().toISOString(),
    usageCostEur: usageEur,
    baseCostEur: session.baseCostEur ?? usageEur,
    costEur: usageEur,
  };

  const deferred = (await listDeferredSessions(userId)).filter((s) => s.id !== current.id);
  const decision = shouldSettleAccountCharges({
    deferredSessions: deferred,
    currentSession: current,
  });

  // --- DEFER: cancel preauth hold, no invoice ---
  if (!decision.settle) {
    if (preauthPaymentIntentId && stripe) {
      try {
        const intent = await stripe.paymentIntents.retrieve(preauthPaymentIntentId);
        if (intent.status === 'requires_capture' || intent.status === 'requires_payment_method') {
          await stripe.paymentIntents.cancel(preauthPaymentIntentId);
        }
      } catch (e) {
        console.warn('[bc-charge] preauth cancel on defer failed:', e?.message ?? e);
      }
    }

    const openBalanceCents = decision.totalCents;
    current = markSessionsDeferred(current, { openBalanceCents });
    current.stripePaymentIntentId = undefined;
    await upsertSession(userId, current);

    return {
      mode: 'deferred',
      session: current,
      openBalanceEur: fromCents(openBalanceCents),
      openBalanceCents,
      invoice: null,
      settledSessions: [],
    };
  }

  // --- SETTLE: charge total, Sammelrechnung ---
  const batchSessions = [...deferred, current];
  const totalCents = decision.totalCents;
  const totalEur = fromCents(totalCents);
  const batchId = batchIdFor(batchSessions);

  let paymentStatus = 'skipped';
  let stripePaymentIntentId = null;
  let captureCents = totalCents;
  let amountChargedEur = totalEur;

  const row = await findUserById(userId);
  const profile = row ? rowToProfile(row) : null;
  const customerId = profile?.stripeCustomerId;
  const pmId =
    paymentMethodId ||
    current.paymentMethodId ||
    batchSessions.find((s) => s.paymentMethodId)?.paymentMethodId;

  // Resolve Stripe PM id from profile if app-local id was stored
  let stripePmId = pmId;
  if (profile?.paymentMethods?.length && pmId) {
    const match = profile.paymentMethods.find((p) => p.id === pmId || p.stripePaymentMethodId === pmId);
    if (match?.stripePaymentMethodId) stripePmId = match.stripePaymentMethodId;
  }

  let holdPiId = preauthPaymentIntentId || null;

  if (chargeOnCard && stripe && customerId && stripePmId && totalCents >= 50) {
    try {
      // Prefer capturing existing preauth if it covers the total
      if (holdPiId) {
        const intent = await stripe.paymentIntents.retrieve(holdPiId);
        if (intent.status === 'requires_capture') {
          const hold = intent.amount_capturable || intent.amount || 0;
          const toCapture = Math.min(hold, Math.max(50, totalCents));
          const captured = await stripe.paymentIntents.capture(holdPiId, {
            amount_to_capture: toCapture,
          });
          stripePaymentIntentId = captured.id;
          captureCents = captured.amount_received ?? toCapture;
          amountChargedEur = fromCents(captureCents);
          paymentStatus = captured.status === 'succeeded' ? 'paid' : 'pending';
        } else if (intent.status === 'succeeded') {
          stripePaymentIntentId = intent.id;
          captureCents = intent.amount_received ?? totalCents;
          amountChargedEur = fromCents(captureCents);
          paymentStatus = 'paid';
        } else {
          // Can't use hold — cancel and create fresh charge
          try {
            if (intent.status !== 'canceled') await stripe.paymentIntents.cancel(holdPiId);
          } catch {
            /* ignore */
          }
          holdPiId = null;
        }
      }

      if (!stripePaymentIntentId) {
        const intent = await stripe.paymentIntents.create(
          {
            amount: Math.max(50, totalCents),
            currency: 'eur',
            customer: customerId,
            payment_method: stripePmId,
            off_session: true,
            confirm: true,
            description:
              batchSessions.length > 1
                ? `BC Charge Sammelrechnung (${batchSessions.length} Ladevorgänge)`
                : `BC Charge – ${current.stationName || 'Ladevorgang'}`,
            metadata: {
              bcUserId: userId,
              source: 'bc-charge-app',
              flow: batchSessions.length > 1 ? 'collective' : 'single',
              batchId,
              sessionIds: batchSessions.map((s) => s.id).join(',').slice(0, 450),
            },
          },
          { idempotencyKey: `settle_${batchId}` }
        );
        stripePaymentIntentId = intent.id;
        captureCents = intent.amount_received ?? intent.amount ?? totalCents;
        amountChargedEur = fromCents(captureCents);
        paymentStatus = intent.status === 'succeeded' ? 'paid' : intent.status === 'processing' ? 'pending' : 'failed';
      }
    } catch (e) {
      console.error('[bc-charge] settle charge failed:', e?.message ?? e);
      paymentStatus = 'failed';
      // Still mark deferred-open so we can retry later; keep sessions deferred
      if (holdPiId && stripe) {
        try {
          const intent = await stripe.paymentIntents.retrieve(holdPiId);
          if (intent.status === 'requires_capture') {
            await stripe.paymentIntents.cancel(holdPiId);
          }
        } catch {
          /* ignore */
        }
      }
      current = markSessionsDeferred(current, { openBalanceCents: totalCents });
      current.paymentStatus = 'failed';
      current.billingError = e instanceof Error ? e.message : 'Zahlung fehlgeschlagen';
      await upsertSession(userId, current);
      return {
        mode: 'charge_failed',
        session: current,
        openBalanceEur: fromCents(totalCents),
        openBalanceCents: totalCents,
        invoice: null,
        settledSessions: [],
        error: e instanceof Error ? e.message : 'Zahlung fehlgeschlagen',
      };
    }
  } else if (holdPiId && stripe) {
    // No card charge path — release hold
    try {
      const intent = await stripe.paymentIntents.retrieve(holdPiId);
      if (intent.status === 'requires_capture') await stripe.paymentIntents.cancel(holdPiId);
    } catch {
      /* ignore */
    }
  }

  // Build invoice document session (Sammelrechnung when >1)
  const invoiceDoc = buildCollectiveInvoiceSession({
    batchId,
    sessions: batchSessions.map((s) =>
      s.id === current.id
        ? { ...current, usageCostEur: usageEur, baseCostEur: usageEur, costEur: usageEur }
        : s
    ),
    totalEur: amountChargedEur,
    paymentStatus,
    stripePaymentIntentId,
    paymentMethodId: pmId,
  });

  // Persist invoice number on a stable registry key (batchId as session_id)
  let invoice = null;
  let invoiceNumber = null;
  try {
    const issued = await issueInvoiceForSession(userId, invoiceDoc, {
      registrySessionId: batchId,
      skipSessionUpsert: true,
    });
    if (issued.ok) {
      invoiceNumber = issued.invoiceNumber;
      invoice = {
        invoiceNumber: issued.invoiceNumber,
        emailSent: issued.emailSent,
        emailSkipped: issued.emailSkipped,
        kind: batchSessions.length > 1 ? 'collective' : 'single',
        batchId,
        totalEur: amountChargedEur,
        sessionIds: batchSessions.map((s) => s.id),
      };
    }
  } catch (e) {
    console.error('[bc-charge] Sammelrechnung fehlgeschlagen:', e);
    invoice = { error: 'Rechnung konnte nicht erstellt werden.' };
  }

  const settled = markSessionsSettled(batchSessions, {
    invoiceNumber,
    batchId,
    totalEur: amountChargedEur,
    stripePaymentIntentId,
    paymentStatus,
    captureCents,
  });

  // Primary session gets full charged amount when single; batch members keep usage
  for (const s of settled) {
    if (batchSessions.length === 1 && s.id === current.id) {
      s.costEur = amountChargedEur;
      s.amountChargedEur = amountChargedEur;
      s.captureCents = captureCents;
    }
    s.invoiceNumber = invoiceNumber ?? s.invoiceNumber;
    await upsertSession(userId, s);
  }

  const primary = settled.find((s) => s.id === current.id) ?? settled[settled.length - 1];

  return {
    mode: batchSessions.length > 1 ? 'collective' : 'single',
    session: primary,
    openBalanceEur: 0,
    openBalanceCents: 0,
    invoice,
    settledSessions: settled,
    amountChargedEur,
    stripePaymentIntentId,
    batchId,
  };
}

export async function getOpenAccountBalanceEur(userId) {
  const deferred = await listDeferredSessions(userId);
  const cents = deferred.reduce((a, s) => a + sessionUsageCents(s), 0);
  return { openBalanceEur: fromCents(cents), openBalanceCents: cents, sessions: deferred };
}
