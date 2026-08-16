/**
 * HTTP security headers for the BC Charge BFF and (via deploy snippets) Nginx edge.
 *
 * Defaults match the SPA needs: Stripe Elements, Google Fonts, Carto/OSM tiles,
 * same-origin API + Hasura WS proxy. Override CSP via BC_CONTENT_SECURITY_POLICY.
 */

const DEFAULT_PERMISSIONS_POLICY =
  'camera=(self), geolocation=(self), microphone=(), payment=(self), usb=(), interest-cohort=()';

/**
 * Production-oriented CSP for the React SPA + Stripe + map tiles + fonts.
 * script-src keeps 'unsafe-inline' only for JSON-LD / legacy inline; prefer nonces later.
 */
export function buildDefaultContentSecurityPolicy() {
  const directives = [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'self'",
    "form-action 'self'",
    // Vite bundle + Stripe.js; JSON-LD in index.html is type=application/ld+json
    "script-src 'self' https://js.stripe.com https://maps.googleapis.com",
    // Tailwind/Framer often set style attributes; Google Fonts CSS
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "img-src 'self' data: blob: https://*.basemaps.cartocdn.com https://*.tile.openstreetmap.org https://*.stripe.com",
    "font-src 'self' data: https://fonts.gstatic.com",
    // BFF same-origin, Stripe API, optional analytics none
    "connect-src 'self' https://api.stripe.com https://*.stripe.com wss: ws:",
    "frame-src 'self' https://js.stripe.com https://hooks.stripe.com",
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    'upgrade-insecure-requests',
  ];
  return directives.join('; ');
}

/**
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {Record<string, string>}
 */
export function buildSecurityHeaders(env = process.env) {
  const isProd =
    String(env.NODE_ENV ?? '').toLowerCase() === 'production' ||
    String(env.BC_SECURITY_HEADERS_MODE ?? '').toLowerCase() === 'production';

  const csp =
    (env.BC_CONTENT_SECURITY_POLICY && String(env.BC_CONTENT_SECURITY_POLICY).trim()) ||
    buildDefaultContentSecurityPolicy();

  const permissions =
    (env.BC_PERMISSIONS_POLICY && String(env.BC_PERMISSIONS_POLICY).trim()) ||
    DEFAULT_PERMISSIONS_POLICY;

  /** @type {Record<string, string>} */
  const headers = {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'SAMEORIGIN',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': permissions,
    'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
    'Cross-Origin-Resource-Policy': 'same-site',
    'X-DNS-Prefetch-Control': 'off',
  };

  // HSTS only when explicitly production (avoid locking localhost to HTTPS)
  if (isProd && env.BC_DISABLE_HSTS !== '1') {
    const maxAge = Number(env.BC_HSTS_MAX_AGE ?? 31_536_000);
    const age = Number.isFinite(maxAge) && maxAge > 0 ? Math.floor(maxAge) : 31_536_000;
    const includeSub = env.BC_HSTS_INCLUDE_SUBDOMAINS === '0' ? '' : '; includeSubDomains';
    headers['Strict-Transport-Security'] = `max-age=${age}${includeSub}`;
  }

  if (env.BC_DISABLE_CSP !== '1') {
    headers['Content-Security-Policy'] = csp;
  }

  return headers;
}

/**
 * Express middleware: apply security headers on every response.
 * Skips overwriting if a route already set the header.
 */
export function securityHeadersMiddleware(env = process.env) {
  return function securityHeaders(req, res, next) {
    const headers = buildSecurityHeaders(env);
    for (const [name, value] of Object.entries(headers)) {
      if (!res.getHeader(name)) {
        res.setHeader(name, value);
      }
    }
    next();
  };
}
