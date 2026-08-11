/**
 * Proxy routes: main BC API → Load-Management service.
 * Mount at /api/load-management
 */

import { Router } from 'express';
import { optionalAuth, requireAuth } from '../middleware/auth.mjs';
import {
  getLoadManagementApiBase,
  getLoadManagementApiKey,
  getLoadManagementHealth,
  getLoadManagementHealthBase,
  isLoadManagementEnabled,
  loadManagementFetch,
} from '../services/loadManagementClient.mjs';

const router = Router();

function notConfigured(res) {
  res.status(503).json({
    ok: false,
    configured: false,
    error: 'Load-Management ist nicht aktiv (LOAD_MANAGEMENT_ENABLED / LM_API_URL / LM_API_KEY).',
  });
}

function requireLm(res) {
  if (!isLoadManagementEnabled()) {
    notConfigured(res);
    return false;
  }
  return true;
}

/** Status of LM integration from the main API POV */
router.get('/status', optionalAuth, async (_req, res) => {
  const enabled = isLoadManagementEnabled();
  const hasKey = Boolean(getLoadManagementApiKey());
  let health = null;
  if (enabled) {
    health = await getLoadManagementHealth();
  }
  res.json({
    ok: enabled && Boolean(health?.ok),
    configured: enabled,
    hasApiKey: hasKey,
    apiBase: getLoadManagementApiBase(),
    healthBase: getLoadManagementHealthBase(),
    health,
    features: {
      externalLimits: true,
      compositeSchedule: true,
      stations: true,
      deepLinkProxy: true,
    },
  });
});

router.get('/health', optionalAuth, async (_req, res) => {
  if (!requireLm(res)) return;
  const health = await getLoadManagementHealth();
  res.status(health.ok ? 200 : 502).json(health);
});

/** Stations + external limits + composite cache */
router.get('/stations', requireAuth, async (_req, res) => {
  if (!requireLm(res)) return;
  const r = await loadManagementFetch('/api/stations');
  res.status(r.status || 502).json(r.data ?? { ok: false, error: r.error });
});

router.get('/external-limits', requireAuth, async (_req, res) => {
  if (!requireLm(res)) return;
  const r = await loadManagementFetch('/api/load/external-limits');
  res.status(r.status || 502).json(r.data ?? { ok: false, error: r.error });
});

router.delete('/external-limits/:stationId', requireAuth, async (req, res) => {
  if (!requireLm(res)) return;
  const stationId = encodeURIComponent(String(req.params.stationId || ''));
  const source =
    typeof req.query.source === 'string' ? req.query.source : undefined;
  const r = await loadManagementFetch(`/api/load/external-limits/${stationId}`, {
    method: 'DELETE',
    query: source ? { source } : undefined,
  });
  res.status(r.status || 502).json(r.data ?? { ok: false, error: r.error });
});

router.get('/composite-schedules', requireAuth, async (_req, res) => {
  if (!requireLm(res)) return;
  const r = await loadManagementFetch('/api/load/composite-schedules');
  res.status(r.status || 502).json(r.data ?? { ok: false, error: r.error });
});

router.post('/composite-schedules/:stationId', requireAuth, async (req, res) => {
  if (!requireLm(res)) return;
  const stationId = encodeURIComponent(String(req.params.stationId || ''));
  const r = await loadManagementFetch(`/api/load/composite-schedules/${stationId}`, {
    method: 'POST',
    body: req.body ?? {},
    timeoutMs: 20_000,
  });
  res.status(r.status || 502).json(r.data ?? { ok: false, error: r.error });
});

router.post('/composite-schedules', requireAuth, async (req, res) => {
  if (!requireLm(res)) return;
  const r = await loadManagementFetch('/api/load/composite-schedules', {
    method: 'POST',
    body: req.body ?? {},
    timeoutMs: 60_000,
  });
  res.status(r.status || 502).json(r.data ?? { ok: false, error: r.error });
});

router.post('/limit/:stationId', requireAuth, async (req, res) => {
  if (!requireLm(res)) return;
  const stationId = encodeURIComponent(String(req.params.stationId || ''));
  const r = await loadManagementFetch(`/api/load/limit/${stationId}`, {
    method: 'POST',
    body: req.body ?? {},
  });
  res.status(r.status || 502).json(r.data ?? { ok: false, error: r.error });
});

/**
 * Generic authenticated proxy for remaining LM admin paths.
 * Body: { path, method?, query?, body? } — path must start with /api/
 */
router.post('/proxy', requireAuth, async (req, res) => {
  if (!requireLm(res)) return;
  const { path, method = 'GET', query, body } = req.body ?? {};
  if (!path || typeof path !== 'string' || !path.startsWith('/api/')) {
    res.status(400).json({ error: 'path muss mit /api/ beginnen' });
    return;
  }
  // Block deep-link public capability paths via admin proxy? allow admin deep-link mint
  const r = await loadManagementFetch(path, {
    method: String(method || 'GET').toUpperCase(),
    query,
    body,
    timeoutMs: 20_000,
  });
  res.status(r.status || 502).json({
    ok: r.ok,
    status: r.status,
    data: r.data,
    error: r.error,
  });
});

export default router;
