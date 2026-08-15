import { Router } from 'express';
import Stripe from 'stripe';
import {
  assertCustomerBelongsToUser,
  assertPaymentMethodOnCustomer,
  chargeSessionGuards,
  escapeStripeSearchValue,
  validateChargeBody,
} from '../security.mjs';
import { requireAuth } from '../middleware/auth.mjs';
import { validateChargeCents } from '../services/chargeValidation.mjs';
import {
  computeCaptureCents,
  getPreauthCents,
  isAuthorizedForStart,
  mapPaymentStatusFromIntent,
} from '../services/stripePreauth.mjs';
const router = Router();
const stripeSecret = process.env.STRIPE_SECRET_KEY;
const stripe = stripeSecret ? new Stripe(stripeSecret) : null;

function requireStripe(res) {
  if (!stripe) {
    res.status(503).json({ error: 'Stripe ist nicht konfiguriert (STRIPE_SECRET_KEY fehlt).' });
    return null;
  }
  return stripe;
}

function handleStripeRouteError(res, err) {
  const status = err.status ?? 500;
  const message = err instanceof Error ? err.message : 'Interner Fehler';
  res.status(status).json({ error: message });
}

router.get('/health', (_req, res) => {
  res.json({ ok: Boolean(stripe) });
});

router.post('/customer', requireAuth, async (req, res) => {
  const s = requireStripe(res);
  if (!s) return;

  const { email, name } = req.body ?? {};
  const userId = req.userId;
  if (!email || typeof email !== 'string' || email.length > 254) {
    res.status(400).json({ error: 'Ungültige E-Mail' });
    return;
  }

  try {
    const existing = await s.customers.search({
      query: `metadata['bcUserId']:'${escapeStripeSearchValue(userId)}'`,
      limit: 1,
    });

    if (existing.data[0]) {
      res.json({ customerId: existing.data[0].id });
      return;
    }

    const customer = await s.customers.create({
      email: email.trim().toLowerCase(),
      name: typeof name === 'string' ? name.slice(0, 200) : undefined,
      metadata: { bcUserId: userId, platform: 'bc-charge-app' },
    });

    res.json({ customerId: customer.id });
  } catch (err) {
    handleStripeRouteError(res, err);
  }
});

router.post('/setup-intent', requireAuth, async (req, res) => {
  const s = requireStripe(res);
  if (!s) return;

  const { customerId } = req.body ?? {};
  if (!customerId) {
    res.status(400).json({ error: 'customerId fehlt' });
    return;
  }

  try {
    await assertCustomerBelongsToUser(s, customerId, req.userId);
    const intent = await s.setupIntents.create({
      customer: customerId,
      payment_method_types: ['card', 'sepa_debit'],
      usage: 'off_session',
    });
    res.json({ clientSecret: intent.client_secret });
  } catch (err) {
    handleStripeRouteError(res, err);
  }
});

router.get('/payment-methods', requireAuth, async (req, res) => {
  const s = requireStripe(res);
  if (!s) return;

  const customerId = req.query.customerId;
  if (!customerId) {
    res.status(400).json({ error: 'customerId erforderlich' });
    return;
  }

  try {
    const customer = await assertCustomerBelongsToUser(s, String(customerId), req.userId);
    const defaultPm =
      customer.invoice_settings?.default_payment_method
        ? typeof customer.invoice_settings.default_payment_method === 'string'
          ? customer.invoice_settings.default_payment_method
          : customer.invoice_settings.default_payment_method.id
        : null;

    const list = await s.paymentMethods.list({ customer: customerId, type: 'card' });
    const sepa = await s.paymentMethods.list({ customer: customerId, type: 'sepa_debit' });

    const methods = [...list.data, ...sepa.data].map((pm) => {
      const card = pm.card;
      const sepaDetails = pm.sepa_debit;
      return {
        id: pm.id,
        type: pm.type === 'sepa_debit' ? 'sepa' : 'card',
        brand: card?.brand ?? sepaDetails?.bank_code ?? 'sepa',
        last4: card?.last4 ?? sepaDetails?.last4 ?? '',
        expiry: card
          ? `${String(card.exp_month).padStart(2, '0')}/${String(card.exp_year).slice(-2)}`
          : undefined,
        label: card?.brand
          ? card.brand.charAt(0).toUpperCase() + card.brand.slice(1)
          : 'SEPA-Lastschrift',
        isDefault: pm.id === defaultPm,
      };
    });

    res.json({ paymentMethods: methods });
  } catch (err) {
    handleStripeRouteError(res, err);
  }
});

router.post('/default-payment-method', requireAuth, async (req, res) => {
  const s = requireStripe(res);
  if (!s) return;

  const { customerId, paymentMethodId } = req.body ?? {};
  if (!customerId || !paymentMethodId) {
    res.status(400).json({ error: 'customerId und paymentMethodId erforderlich' });
    return;
  }

  try {
    await assertCustomerBelongsToUser(s, customerId, req.userId);
    await assertPaymentMethodOnCustomer(s, paymentMethodId, customerId);
    await s.customers.update(customerId, {
      invoice_settings: { default_payment_method: paymentMethodId },
    });
    res.json({ ok: true });
  } catch (err) {
    handleStripeRouteError(res, err);
  }
});

router.delete('/payment-method', requireAuth, async (req, res) => {
  const s = requireStripe(res);
  if (!s) return;

  const { paymentMethodId, customerId } = req.body ?? {};
  if (!paymentMethodId || !customerId) {
    res.status(400).json({ error: 'paymentMethodId und customerId erforderlich' });
    return;
  }

  try {
    await assertCustomerBelongsToUser(s, customerId, req.userId);
    await assertPaymentMethodOnCustomer(s, paymentMethodId, customerId);
    await s.paymentMethods.detach(paymentMethodId);
    res.json({ ok: true });
  } catch (err) {
    handleStripeRouteError(res, err);
  }
});

/**
 * Legacy immediate charge (auto-capture). Prefer preauth + capture for charging sessions.
 * Kept for fallbacks / admin tooling.
 */
router.post('/charge-session', requireAuth, chargeSessionGuards, async (req, res) => {
  const s = requireStripe(res);
  if (!s) return;

  const validationError = validateChargeBody({ ...req.body, userId: req.userId });
  if (validationError) {
    res.status(400).json({ error: validationError });
    return;
  }

  const { customerId, paymentMethodId, amountCents, currency, description, sessionId, sessionCostEur } =
    req.body ?? {};
  const userId = req.userId;

  if (sessionCostEur !== undefined) {
    const centsError = validateChargeCents(amountCents, sessionCostEur);
    if (centsError) {
      res.status(400).json({ error: centsError });
      return;
    }
  }

  try {
    await assertCustomerBelongsToUser(s, customerId, userId);
    await assertPaymentMethodOnCustomer(s, paymentMethodId, customerId);

    const intent = await s.paymentIntents.create(
      {
        amount: Math.round(amountCents),
        currency: (currency ?? 'eur').toLowerCase(),
        customer: customerId,
        payment_method: paymentMethodId,
        off_session: true,
        confirm: true,
        description: typeof description === 'string' ? description.slice(0, 500) : 'BC Charge Ladevorgang',
        metadata: {
          sessionId: typeof sessionId === 'string' ? sessionId.slice(0, 64) : '',
          bcUserId: userId,
          source: 'bc-charge-app',
        },
      },
      { idempotencyKey: sessionId ? `charge_${sessionId}` : undefined }
    );

    res.json({
      paymentIntentId: intent.id,
      status: intent.status,
      paid: intent.status === 'succeeded',
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Zahlung fehlgeschlagen';
    res.status(402).json({ error: message });
  }
});

/**
 * Authorize a hold BEFORE power starts (manual capture).
 * Default €50 — actual usage is captured on stop; remainder released.
 */
router.post('/preauth-session', requireAuth, chargeSessionGuards, async (req, res) => {
  const s = requireStripe(res);
  if (!s) return;

  const { customerId, paymentMethodId, currency, description, sessionId } = req.body ?? {};
  const userId = req.userId;
  const preAuthCents = getPreauthCents();

  const validationError = validateChargeBody({
    customerId,
    paymentMethodId,
    amountCents: preAuthCents,
    userId,
  });
  if (validationError) {
    res.status(400).json({ error: validationError });
    return;
  }
  if (!sessionId || typeof sessionId !== 'string' || sessionId.length > 64) {
    res.status(400).json({ error: 'sessionId erforderlich' });
    return;
  }

  try {
    await assertCustomerBelongsToUser(s, customerId, userId);
    await assertPaymentMethodOnCustomer(s, paymentMethodId, customerId);

    const intent = await s.paymentIntents.create(
      {
        amount: preAuthCents,
        currency: (currency ?? 'eur').toLowerCase(),
        customer: customerId,
        payment_method: paymentMethodId,
        capture_method: 'manual',
        confirm: true,
        off_session: true,
        description:
          typeof description === 'string'
            ? description.slice(0, 500)
            : 'BC Charge Pre-Autorisierung',
        metadata: {
          sessionId: sessionId.slice(0, 64),
          bcUserId: userId,
          source: 'bc-charge-app',
          flow: 'preauth',
          preAuthCents: String(preAuthCents),
        },
      },
      { idempotencyKey: `preauth_${sessionId}` }
    );

    if (!isAuthorizedForStart(intent.status)) {
      res.status(402).json({
        error: 'Karte konnte nicht autorisiert werden',
        paymentIntentId: intent.id,
        status: intent.status,
        authorized: false,
        preAuthCents,
      });
      return;
    }

    res.json({
      paymentIntentId: intent.id,
      status: intent.status,
      authorized: true,
      preAuthCents,
      preAuthEur: preAuthCents / 100,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Pre-Autorisierung fehlgeschlagen';
    res.status(402).json({ error: message });
  }
});

/** Capture actual session cost against a prior pre-auth hold. */
router.post('/capture-session', requireAuth, chargeSessionGuards, async (req, res) => {
  const s = requireStripe(res);
  if (!s) return;

  const { paymentIntentId, sessionId, sessionCostEur, amountCents } = req.body ?? {};
  const userId = req.userId;

  if (!paymentIntentId || typeof paymentIntentId !== 'string') {
    res.status(400).json({ error: 'paymentIntentId erforderlich' });
    return;
  }

  try {
    const intent = await s.paymentIntents.retrieve(paymentIntentId);
    if (intent.metadata?.bcUserId && intent.metadata.bcUserId !== userId) {
      res.status(403).json({ error: 'Zahlung gehört nicht zu diesem Nutzer' });
      return;
    }
    if (sessionId && intent.metadata?.sessionId && intent.metadata.sessionId !== sessionId) {
      res.status(403).json({ error: 'Zahlungszuordnung ungültig' });
      return;
    }

    if (intent.status === 'succeeded') {
      res.json({
        paymentIntentId: intent.id,
        status: intent.status,
        paid: true,
        paymentStatus: 'paid',
        captureCents: intent.amount_received ?? intent.amount,
      });
      return;
    }

    if (intent.status === 'canceled') {
      res.json({
        paymentIntentId: intent.id,
        status: intent.status,
        paid: false,
        paymentStatus: 'skipped',
        captureCents: 0,
      });
      return;
    }

    if (intent.status !== 'requires_capture') {
      res.status(409).json({
        error: `PaymentIntent nicht capture-fähig (status=${intent.status})`,
        status: intent.status,
      });
      return;
    }

    const holdCents =
      Number(intent.metadata?.preAuthCents) ||
      intent.amount_capturable ||
      intent.amount ||
      getPreauthCents();

    let captureCents;
    if (amountCents != null) {
      captureCents = Math.round(Number(amountCents));
    } else if (sessionCostEur != null) {
      captureCents = computeCaptureCents(sessionCostEur, holdCents);
    } else {
      res.status(400).json({ error: 'sessionCostEur oder amountCents erforderlich' });
      return;
    }

    if (sessionCostEur != null && amountCents != null) {
      const centsError = validateChargeCents(amountCents, sessionCostEur);
      if (centsError) {
        res.status(400).json({ error: centsError });
        return;
      }
    }

    captureCents = Math.min(holdCents, Math.max(0, captureCents));

    if (captureCents < 50) {
      const cancelled = await s.paymentIntents.cancel(paymentIntentId);
      res.json({
        paymentIntentId: cancelled.id,
        status: cancelled.status,
        paid: false,
        paymentStatus: 'skipped',
        captureCents: 0,
        cancelled: true,
      });
      return;
    }

    const captured = await s.paymentIntents.capture(paymentIntentId, {
      amount_to_capture: captureCents,
    });

    res.json({
      paymentIntentId: captured.id,
      status: captured.status,
      paid: captured.status === 'succeeded',
      paymentStatus: mapPaymentStatusFromIntent(captured.status),
      captureCents,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Capture fehlgeschlagen';
    res.status(402).json({ error: message });
  }
});

/** Release an unused pre-auth hold (start failed / abandoned). */
router.post('/cancel-preauth', requireAuth, chargeSessionGuards, async (req, res) => {
  const s = requireStripe(res);
  if (!s) return;

  const { paymentIntentId, sessionId } = req.body ?? {};
  const userId = req.userId;

  if (!paymentIntentId || typeof paymentIntentId !== 'string') {
    res.status(400).json({ error: 'paymentIntentId erforderlich' });
    return;
  }

  try {
    const intent = await s.paymentIntents.retrieve(paymentIntentId);
    if (intent.metadata?.bcUserId && intent.metadata.bcUserId !== userId) {
      res.status(403).json({ error: 'Zahlung gehört nicht zu diesem Nutzer' });
      return;
    }
    if (sessionId && intent.metadata?.sessionId && intent.metadata.sessionId !== sessionId) {
      res.status(403).json({ error: 'Zahlungszuordnung ungültig' });
      return;
    }

    if (intent.status === 'canceled' || intent.status === 'succeeded') {
      res.json({
        paymentIntentId: intent.id,
        status: intent.status,
        cancelled: intent.status === 'canceled',
      });
      return;
    }

    if (intent.status === 'requires_capture' || intent.status === 'requires_payment_method') {
      const cancelled = await s.paymentIntents.cancel(paymentIntentId);
      res.json({
        paymentIntentId: cancelled.id,
        status: cancelled.status,
        cancelled: true,
      });
      return;
    }

    res.status(409).json({
      error: `PaymentIntent kann nicht storniert werden (status=${intent.status})`,
      status: intent.status,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Storno fehlgeschlagen';
    res.status(402).json({ error: message });
  }
});

router.get('/preauth-config', (_req, res) => {
  const preAuthCents = getPreauthCents();
  res.json({
    ok: Boolean(stripe),
    preAuthCents,
    preAuthEur: preAuthCents / 100,
  });
});

export default router;
