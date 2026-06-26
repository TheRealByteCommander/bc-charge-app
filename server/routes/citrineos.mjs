import { Router } from 'express';
import { optionalAuth } from '../middleware/auth.mjs';
import { citrineosIntegrationContract } from '../contracts/citrineosContract.mjs';

const router = Router();

function citrineosApiUrl() {
  return (process.env.CITRINEOS_API_URL ?? 'http://localhost:8080').replace(/\/$/, '');
}

function hasuraUrl() {
  return (process.env.CITRINEOS_HASURA_URL ?? 'http://localhost:8090/v1/graphql').replace(/\/$/, '');
}

function isConfigured() {
  return Boolean(process.env.CITRINEOS_API_URL || process.env.CITRINEOS_HASURA_URL);
}

router.get('/health', async (_req, res) => {
  if (!process.env.CITRINEOS_API_URL) {
    res.json({ ok: false, configured: false, message: 'CitrineOS API URL nicht konfiguriert' });
    return;
  }
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    const r = await fetch(`${citrineosApiUrl()}/health`, { signal: controller.signal });
    clearTimeout(timeout);
    res.json({ ok: r.ok, configured: true, status: r.status });
  } catch (e) {
    res.json({
      ok: false,
      configured: true,
      error: e instanceof Error ? e.message : 'Nicht erreichbar',
    });
  }
});

router.get('/status', (_req, res) => {
  res.json({
    configured: isConfigured(),
    apiUrl: Boolean(process.env.CITRINEOS_API_URL),
    hasuraUrl: Boolean(process.env.CITRINEOS_HASURA_URL),
    tenantId: process.env.CITRINEOS_TENANT_ID ?? '1',
  });
});

router.get('/contract', (_req, res) => {
  res.json({
    ...citrineosIntegrationContract,
    configured: isConfigured(),
    env: {
      tenantId: process.env.CITRINEOS_TENANT_ID ?? '1',
      apiUrl: process.env.CITRINEOS_API_URL ?? null,
      hasuraUrl: process.env.CITRINEOS_HASURA_URL ?? null,
    },
  });
});

router.post('/hasura', optionalAuth, async (req, res) => {
  if (!process.env.CITRINEOS_HASURA_URL) {
    res.status(503).json({ error: 'Hasura nicht konfiguriert' });
    return;
  }
  const { query, variables } = req.body ?? {};
  if (!query || typeof query !== 'string') {
    res.status(400).json({ error: 'GraphQL query erforderlich' });
    return;
  }

  const headers = { 'Content-Type': 'application/json' };
  const secret = process.env.CITRINEOS_HASURA_ADMIN_SECRET;
  if (secret) headers['x-hasura-admin-secret'] = secret;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const r = await fetch(hasuraUrl(), {
      method: 'POST',
      headers,
      body: JSON.stringify({ query, variables }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    const data = await r.json();
    if (!r.ok) {
      res.status(r.status).json(data);
      return;
    }
    res.json(data);
  } catch (e) {
    res.status(502).json({ error: e instanceof Error ? e.message : 'Hasura-Anfrage fehlgeschlagen' });
  }
});

router.get('/tariffs', optionalAuth, async (_req, res) => {
  if (!process.env.CITRINEOS_API_URL) {
    res.status(503).json({ error: 'CitrineOS API nicht konfiguriert' });
    return;
  }
  try {
    const tenantId = process.env.CITRINEOS_TENANT_ID ?? '1';
    const url = `${citrineosApiUrl()}/data/transactions/tariff?tenantId=${tenantId}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const r = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    const data = await r.json();
    if (!r.ok) {
      res.status(r.status).json(data);
      return;
    }
    res.json(data);
  } catch (e) {
    res.status(502).json({ error: e instanceof Error ? e.message : 'Tarife nicht abrufbar' });
  }
});

router.post('/proxy', optionalAuth, async (req, res) => {
  if (!process.env.CITRINEOS_API_URL) {
    res.status(503).json({ error: 'CitrineOS API nicht konfiguriert' });
    return;
  }

  const { path, method = 'GET', query, body } = req.body ?? {};
  if (!path || typeof path !== 'string' || !path.startsWith('/')) {
    res.status(400).json({ error: 'path muss mit / beginnen' });
    return;
  }

  const url = new URL(path, `${citrineosApiUrl()}/`);
  if (query && typeof query === 'object') {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== '') url.searchParams.set(k, String(v));
    }
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const r = await fetch(url.toString(), {
      method,
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    clearTimeout(timeout);
    const text = await r.text();
    let parsed;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      parsed = text;
    }
    res.status(r.status).json({ ok: r.ok, status: r.status, data: parsed });
  } catch (e) {
    res.status(502).json({ error: e instanceof Error ? e.message : 'CitrineOS-Proxy fehlgeschlagen' });
  }
});

export default router;
