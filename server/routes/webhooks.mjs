import { Router } from 'express';
import Stripe from 'stripe';

const router = Router();
const stripeSecret = process.env.STRIPE_SECRET_KEY;
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
const stripe = stripeSecret ? new Stripe(stripeSecret) : null;

router.post('/', async (req, res) => {
  if (!stripe || !webhookSecret) {
    res.status(503).json({ error: 'Stripe-Webhooks nicht konfiguriert' });
    return;
  }

  const signature = req.get('stripe-signature');
  if (!signature) {
    res.status(400).json({ error: 'Stripe-Signatur fehlt' });
    return;
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, signature, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Signatur ungültig';
    res.status(400).json({ error: message });
    return;
  }

  switch (event.type) {
    case 'payment_intent.succeeded':
    case 'payment_intent.payment_failed':
      console.log(`[bc-charge] Stripe webhook: ${event.type}`, event.data.object?.id);
      break;
    default:
      break;
  }

  res.json({ received: true });
});

export default router;
