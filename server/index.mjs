import cors from 'cors';
import express from 'express';
import Stripe from 'stripe';
import {
  assertCustomerBelongsToUser,
  assertPaymentMethodOnCustomer,
  chargeSessionGuards,
  createApiKeyGuard,
  escapeStripeSearchValue,
  getBindHost,
  getCorsOptions,
  requireBcUserId,
  validateChargeBody,
  validateUserId,
  createRateLimiter,
} from './security.mjs';

const PORT = Number(process.env.STRIPE_SERVER_PORT ?? 4242);
const stripeSecret = process.env.STRIPE_SECRET_KEY;
const apiKey = process.env.BC_STRIPE_API_KEY ?? '';

const stripe = stripeSecret ? new Stripe(stripeSecret) : null;

const app = express();
app.disable('x-powered-by');
app.use(cors(getCorsOptions()));
app.use(express.json({ limit: '64kb' }));
app.use(createRateLimiter({ windowMs: 60_000, max: 200 }));

const guard = createApiKeyGuard(apiKey);
const authed = [guard, requireBcUserId];

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

app.get('/api/stripe/health', (_req, res) => {
  res.json({ ok: Boolean(stripe) });
});

app.post('/api/stripe/customer', authed, async (req, res) => {
  const s = requireStripe(res);
  if (!s) return;

  const { email, name } = req.body;
  const userId = req.bcUserId;
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

app.post('/api/stripe/setup-intent', authed, async (req, res) => {
  const s = requireStripe(res);
  if (!s) return;

  const { customerId } = req.body;
  if (!customerId) {
    res.status(400).json({ error: 'customerId fehlt' });
    return;
  }

  try {
    await assertCustomerBelongsToUser(s, customerId, req.bcUserId);
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

app.get('/api/stripe/payment-methods', guard, async (req, res) => {
  const s = requireStripe(res);
  if (!s) return;

  const customerId = req.query.customerId;
  const userId = req.get('x-bc-user-id');
  if (!validateUserId(userId) || !customerId) {
    res.status(400).json({ error: 'customerId und gültige X-BC-User-Id erforderlich' });
    return;
  }

  try {
    const customer = await assertCustomerBelongsToUser(s, String(customerId), userId);
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

app.post('/api/stripe/default-payment-method', authed, async (req, res) => {
  const s = requireStripe(res);
  if (!s) return;

  const { customerId, paymentMethodId } = req.body;
  if (!customerId || !paymentMethodId) {
    res.status(400).json({ error: 'customerId und paymentMethodId erforderlich' });
    return;
  }

  try {
    await assertCustomerBelongsToUser(s, customerId, req.bcUserId);
    await assertPaymentMethodOnCustomer(s, paymentMethodId, customerId);
    await s.customers.update(customerId, {
      invoice_settings: { default_payment_method: paymentMethodId },
    });
    res.json({ ok: true });
  } catch (err) {
    handleStripeRouteError(res, err);
  }
});

app.delete('/api/stripe/payment-method', authed, async (req, res) => {
  const s = requireStripe(res);
  if (!s) return;

  const { paymentMethodId, customerId } = req.body;
  if (!paymentMethodId || !customerId) {
    res.status(400).json({ error: 'paymentMethodId und customerId erforderlich' });
    return;
  }

  try {
    await assertCustomerBelongsToUser(s, customerId, req.bcUserId);
    await assertPaymentMethodOnCustomer(s, paymentMethodId, customerId);
    await s.paymentMethods.detach(paymentMethodId);
    res.json({ ok: true });
  } catch (err) {
    handleStripeRouteError(res, err);
  }
});

app.post('/api/stripe/charge-session', authed, chargeSessionGuards, async (req, res) => {
  const s = requireStripe(res);
  if (!s) return;

  const validationError = validateChargeBody(req.body);
  if (validationError) {
    res.status(400).json({ error: validationError });
    return;
  }

  const { customerId, paymentMethodId, amountCents, currency, description, sessionId } = req.body;
  const userId = req.bcUserId;

  if (userId !== req.body.userId) {
    res.status(403).json({ error: 'Benutzer-ID stimmt nicht überein' });
    return;
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

app.use((err, _req, res, next) => {
  if (err?.message === 'CORS blockiert') {
    res.status(403).json({ error: 'Origin nicht erlaubt' });
    return;
  }
  next(err);
});

const host = getBindHost();
app.listen(PORT, host, () => {
  console.log(`[bc-charge] Stripe-API http://${host}:${PORT}`);
  if (!apiKey) {
    console.warn('[bc-charge] BC_STRIPE_API_KEY fehlt – setzen Sie einen langen Zufallswert in .env');
  }
});
