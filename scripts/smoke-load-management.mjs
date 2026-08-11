#!/usr/bin/env node
/**
 * Smoke checks for Load-Management wiring (main API proxy + LM service).
 *
 * Env:
 *   BC_API_URL              default http://127.0.0.1:4242
 *   LOAD_MANAGEMENT_API_URL default http://127.0.0.1:3003
 *   LOAD_MANAGEMENT_HEALTH_URL default http://127.0.0.1:3001
 *   LM_API_KEY              optional; required for LM admin routes when auth on
 *   BC_SMOKE_TOKEN          optional Bearer JWT for main API auth routes
 *
 * Exit 0 if critical paths respond; non-zero on hard failures.
 */

const bcApi = (process.env.BC_API_URL || 'http://127.0.0.1:4242').replace(/\/$/, '');
const lmApi = (
  process.env.LOAD_MANAGEMENT_API_URL ||
  process.env.LM_API_URL ||
  'http://127.0.0.1:3003'
).replace(/\/$/, '');
const lmHealth = (
  process.env.LOAD_MANAGEMENT_HEALTH_URL ||
  process.env.LM_HEALTH_URL ||
  'http://127.0.0.1:3001'
).replace(/\/$/, '');
const lmKey = (process.env.LM_API_KEY || process.env.LOAD_MANAGEMENT_API_KEY || '').trim();
const jwt = (process.env.BC_SMOKE_TOKEN || '').trim();

/** @type {{ name: string, ok: boolean, detail: string }[]} */
const results = [];

async function check(name, fn) {
  try {
    const detail = await fn();
    results.push({ name, ok: true, detail: detail || 'ok' });
  } catch (e) {
    results.push({
      name,
      ok: false,
      detail: e instanceof Error ? e.message : String(e),
    });
  }
}

async function fetchJson(url, opts = {}) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), opts.timeoutMs ?? 5000);
  try {
    const r = await fetch(url, {
      ...opts,
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        ...(opts.headers || {}),
      },
    });
    const text = await r.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }
    return { status: r.status, ok: r.ok, data };
  } finally {
    clearTimeout(t);
  }
}

await check('BC /api/health', async () => {
  const r = await fetchJson(`${bcApi}/api/health`);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return JSON.stringify(r.data);
});

await check('BC /api/citrineos/canary (pinBump field)', async () => {
  const r = await fetchJson(`${bcApi}/api/citrineos/canary`);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  if (!r.data?.canary?.pinBump) {
    throw new Error('missing canary.pinBump in response');
  }
  return `ready=${r.data.canary.pinBump.ready} blockers=${(r.data.canary.pinBump.blockers || []).join(',') || 'none'}`;
});

await check('BC /api/load-management/status', async () => {
  const r = await fetchJson(`${bcApi}/api/load-management/status`);
  if (r.status === 404) throw new Error('route not mounted');
  // 200 even when LM down — body tells configured/ok
  if (r.status >= 500) throw new Error(`HTTP ${r.status}`);
  return JSON.stringify({
    configured: r.data?.configured,
    ok: r.data?.ok,
    hasApiKey: r.data?.hasApiKey,
  });
});

await check('LM health :3001', async () => {
  const r = await fetchJson(`${lmHealth}/health`);
  if (!r.ok) throw new Error(`HTTP ${r.status} (is load-manager running?)`);
  return JSON.stringify(r.data);
});

await check('LM stations (admin)', async () => {
  const headers = {};
  if (lmKey) {
    headers.Authorization = `Bearer ${lmKey}`;
    headers['x-lm-api-key'] = lmKey;
  }
  const r = await fetchJson(`${lmApi}/api/stations`, { headers });
  if (r.status === 401 || r.status === 503) {
    return `auth gate HTTP ${r.status} (set LM_API_KEY if required)`;
  }
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const hasExt = Array.isArray(r.data?.data?.externalLimits);
  const hasComp = Array.isArray(r.data?.data?.compositeSchedules);
  if (!hasExt || !hasComp) {
    throw new Error('stations payload missing externalLimits/compositeSchedules');
  }
  return `stations=${(r.data?.data?.stations || []).length} externalLimits+composite ok`;
});

await check('LM external-limits route', async () => {
  const headers = {};
  if (lmKey) {
    headers.Authorization = `Bearer ${lmKey}`;
    headers['x-lm-api-key'] = lmKey;
  }
  const r = await fetchJson(`${lmApi}/api/load/external-limits`, { headers });
  if (r.status === 401 || r.status === 503) return `auth gate HTTP ${r.status}`;
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return `limits=${(r.data?.data?.limits || []).length}`;
});

if (jwt) {
  await check('BC proxy stations (auth)', async () => {
    const r = await fetchJson(`${bcApi}/api/load-management/stations`, {
      headers: { Authorization: `Bearer ${jwt}` },
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return 'ok';
  });
}

let failed = 0;
for (const r of results) {
  const mark = r.ok ? 'PASS' : 'FAIL';
  if (!r.ok) failed += 1;
  console.log(`${mark}  ${r.name}: ${r.detail}`);
}

console.log(
  failed === 0
    ? `\nSmoke OK (${results.length} checks)`
    : `\nSmoke FAILED: ${failed}/${results.length}`
);
process.exit(failed === 0 ? 0 : 1);
