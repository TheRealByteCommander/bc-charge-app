/**
 * Security response headers.
 * Run: node --test server/middleware/securityHeaders.test.mjs
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildDefaultContentSecurityPolicy,
  buildSecurityHeaders,
  securityHeadersMiddleware,
} from './securityHeaders.mjs';

describe('buildDefaultContentSecurityPolicy', () => {
  it('includes frame-ancestors, Stripe, fonts, and map tile hosts', () => {
    const csp = buildDefaultContentSecurityPolicy();
    assert.match(csp, /default-src 'self'/);
    assert.match(csp, /frame-ancestors 'self'/);
    assert.match(csp, /js\.stripe\.com/);
    assert.match(csp, /fonts\.googleapis\.com/);
    assert.match(csp, /basemaps\.cartocdn\.com/);
    assert.match(csp, /object-src 'none'/);
  });
});

describe('buildSecurityHeaders', () => {
  it('sets the six securityheaders.com baseline headers in production', () => {
    const h = buildSecurityHeaders({ NODE_ENV: 'production' });
    assert.equal(h['X-Content-Type-Options'], 'nosniff');
    assert.equal(h['X-Frame-Options'], 'SAMEORIGIN');
    assert.equal(h['Referrer-Policy'], 'strict-origin-when-cross-origin');
    assert.ok(h['Permissions-Policy']?.includes('geolocation'));
    assert.ok(h['Strict-Transport-Security']?.startsWith('max-age='));
    assert.match(h['Strict-Transport-Security'], /includeSubDomains/);
    assert.ok(h['Content-Security-Policy']?.includes("default-src 'self'"));
  });

  it('omits HSTS outside production unless forced', () => {
    const h = buildSecurityHeaders({ NODE_ENV: 'development' });
    assert.equal(h['Strict-Transport-Security'], undefined);
    assert.ok(h['Content-Security-Policy']);
  });

  it('honors BC_SECURITY_HEADERS_MODE=production for HSTS in non-NODE prod', () => {
    const h = buildSecurityHeaders({
      NODE_ENV: 'test',
      BC_SECURITY_HEADERS_MODE: 'production',
    });
    assert.ok(h['Strict-Transport-Security']);
  });

  it('allows CSP override and disable flags', () => {
    const custom = buildSecurityHeaders({
      NODE_ENV: 'production',
      BC_CONTENT_SECURITY_POLICY: "default-src 'none'",
    });
    assert.equal(custom['Content-Security-Policy'], "default-src 'none'");

    const off = buildSecurityHeaders({
      NODE_ENV: 'production',
      BC_DISABLE_CSP: '1',
      BC_DISABLE_HSTS: '1',
    });
    assert.equal(off['Content-Security-Policy'], undefined);
    assert.equal(off['Strict-Transport-Security'], undefined);
  });
});

describe('securityHeadersMiddleware', () => {
  it('sets headers when missing and does not overwrite existing', () => {
    const headers = {};
    const res = {
      getHeader(name) {
        return headers[name.toLowerCase()];
      },
      setHeader(name, value) {
        headers[name.toLowerCase()] = value;
      },
    };
    let nextCalled = false;
    // Pre-set one header
    headers['x-frame-options'] = 'DENY';

    securityHeadersMiddleware({ NODE_ENV: 'production' })({}, res, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, true);
    assert.equal(headers['x-frame-options'], 'DENY');
    assert.equal(headers['x-content-type-options'], 'nosniff');
    assert.ok(headers['content-security-policy']);
    assert.ok(headers['strict-transport-security']);
    assert.ok(headers['permissions-policy']);
    assert.ok(headers['referrer-policy']);
  });
});
