/** Sicherheits-Hilfen für den Stripe-BFF (Dev/Demo – Produktion: echte User-Auth). */

const USER_ID_RE = /^user_[a-zA-Z0-9_-]{8,64}$/;
const CUSTOMER_ID_RE = /^cus_[a-zA-Z0-9]+$/;
const PM_ID_RE = /^pm_[a-zA-Z0-9]+$/;
const MAX_CHARGE_CENTS = 25_000; // 250 € Obergrenze pro Request

export function validateUserId(userId) {
  return typeof userId === 'string' && USER_ID_RE.test(userId);
}

export function escapeStripeSearchValue(value) {
  return String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

/** Ladestart und Session-Sync nicht vom globalen Limiter blockieren. */
export function shouldSkipRateLimit(req) {
  const path = (req.originalUrl ?? req.url ?? '').split('?')[0];
  if (path === '/api/health') return true;
  if (!req.userId) return false;
  if (path.startsWith('/api/sessions/active')) return true;
  if (path === '/api/citrineos/ensure-authorization') return true;
  if (req.method === 'POST' && path === '/api/sessions') return true;
  return false;
}

export function createRateLimiter({ windowMs = 60_000, max = 300, keyFn, skip } = {}) {
  const hits = new Map();
  const shouldSkip = skip ?? shouldSkipRateLimit;
  const resolveKey =
    keyFn ??
    ((req) => {
      if (req.userId) return `user:${req.userId}`;
      const ip = req.ip ?? req.socket?.remoteAddress ?? 'unknown';
      return `ip:${ip}`;
    });

  return (req, res, next) => {
    if (shouldSkip(req)) {
      next();
      return;
    }
    const key = resolveKey(req);
    const now = Date.now();
    let bucket = hits.get(key);
    if (!bucket || now - bucket.start > windowMs) {
      bucket = { start: now, count: 0 };
      hits.set(key, bucket);
    }
    bucket.count += 1;
    if (bucket.count > max) {
      res.status(429).json({ error: 'Zu viele Anfragen. Bitte später erneut versuchen.' });
      return;
    }
    next();
  };
}

const chargeLimiter = createRateLimiter({ windowMs: 60_000, max: 20 });

export function createApiKeyGuard(expectedKey) {
  const required = Boolean(expectedKey && expectedKey.length >= 24);
  return (req, res, next) => {
    if (!required) {
      console.warn('[bc-charge] BC_STRIPE_API_KEY fehlt – API nur für lokale Entwicklung gedacht.');
      return next();
    }
    const key = req.get('x-bc-api-key');
    if (key !== expectedKey) {
      res.status(401).json({ error: 'Nicht autorisiert' });
      return;
    }
    next();
  };
}

export function requireBcUserId(req, res, next) {
  const userId = req.get('x-bc-user-id') ?? req.body?.userId;
  if (!validateUserId(userId)) {
    res.status(400).json({ error: 'Ungültige oder fehlende Benutzer-ID' });
    return;
  }
  req.bcUserId = userId;
  next();
}

export async function assertCustomerBelongsToUser(stripe, customerId, userId) {
  if (!CUSTOMER_ID_RE.test(customerId)) {
    throw Object.assign(new Error('Ungültige customerId'), { status: 400 });
  }
  const customer = await stripe.customers.retrieve(customerId);
  if (customer.deleted) {
    throw Object.assign(new Error('Kunde nicht gefunden'), { status: 404 });
  }
  if (customer.metadata?.bcUserId !== userId) {
    throw Object.assign(new Error('Zugriff verweigert'), { status: 403 });
  }
  return customer;
}

export async function assertPaymentMethodOnCustomer(stripe, paymentMethodId, customerId) {
  if (!PM_ID_RE.test(paymentMethodId)) {
    throw Object.assign(new Error('Ungültige paymentMethodId'), { status: 400 });
  }
  const pm = await stripe.paymentMethods.retrieve(paymentMethodId);
  if (pm.customer !== customerId) {
    throw Object.assign(new Error('Zahlungsmethode gehört nicht zum Kunden'), { status: 403 });
  }
  return pm;
}

export function chargeSessionGuards(req, res, next) {
  chargeLimiter(req, res, () => next());
}

export function validateChargeBody(body) {
  const { customerId, paymentMethodId, amountCents, userId } = body;
  if (!validateUserId(userId) || !CUSTOMER_ID_RE.test(customerId) || !PM_ID_RE.test(paymentMethodId)) {
    return 'Ungültige Zahlungsdaten';
  }
  const cents = Math.round(Number(amountCents));
  if (!Number.isFinite(cents) || cents < 50 || cents > MAX_CHARGE_CENTS) {
    return `Betrag muss zwischen 0,50 € und ${MAX_CHARGE_CENTS / 100} € liegen`;
  }
  return null;
}

export function getCorsOptions() {
  const raw =
    process.env.BC_CORS_ORIGINS ??
    'http://localhost:5173,http://localhost:5174,http://127.0.0.1:5173,http://127.0.0.1:5174';
  const allowed = new Set(
    raw
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean)
  );
  return {
    origin(origin, callback) {
      if (!origin || allowed.has(origin)) {
        callback(null, true);
      } else {
        callback(new Error('CORS blockiert'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'X-BC-API-Key', 'X-BC-User-Id', 'Cookie'],
  };
}

export function getBindHost() {
  return process.env.BC_BIND_HOST ?? '127.0.0.1';
}
