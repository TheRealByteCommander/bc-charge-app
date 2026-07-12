import { verifySessionToken, SESSION_COOKIE } from '../auth/session.mjs';
import { createApiKeyGuard, requireBcUserId, validateUserId } from '../security.mjs';

const legacyApiKey = process.env.BC_STRIPE_API_KEY ?? '';
const legacyGuard = createApiKeyGuard(legacyApiKey);

/**
 * Session-Cookie (Produktion) oder Legacy Header-Auth (Dev ohne Backend-Modus).
 */
export async function requireAuth(req, res, next) {
  const token = req.cookies?.[SESSION_COOKIE];
  if (token) {
    try {
      req.userId = await verifySessionToken(token);
      req.bcUserId = req.userId;
      next();
      return;
    } catch {
      res.status(401).json({ error: 'Sitzung abgelaufen – bitte erneut anmelden.' });
      return;
    }
  }

  legacyGuard(req, res, () => {
    requireBcUserId(req, res, next);
  });
}

export async function optionalAuth(req, _res, next) {
  const token = req.cookies?.[SESSION_COOKIE];
  if (token) {
    try {
      req.userId = await verifySessionToken(token);
      req.bcUserId = req.userId;
    } catch {
      /* ignore */
    }
  } else {
    const headerId = req.get('x-bc-user-id');
    if (validateUserId(headerId)) {
      req.userId = headerId;
      req.bcUserId = headerId;
    }
  }
  next();
}

/** Setzt req.userId aus Session-Cookie für Rate-Limiting (ohne Auth-Fehler). */
export async function attachUserForRateLimit(req, _res, next) {
  const token = req.cookies?.[SESSION_COOKIE];
  if (!token) {
    next();
    return;
  }
  try {
    req.userId = await verifySessionToken(token);
    req.bcUserId = req.userId;
  } catch {
    /* ignore */
  }
  next();
}
