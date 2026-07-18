import { Router } from 'express';
import { requireAuth, optionalAuth } from '../middleware/auth.mjs';
import { computeCost } from '../services/pricing/costEngine.mjs';
import { buildTariffVersionPayload } from '../services/pricing/tariffModel.mjs';
import { createTariffSnapshot } from '../services/pricing/tariffSnapshot.mjs';
import {
  activateTariffVersion,
  appendAudit,
  createTariffFromCitrineos,
  getActiveTariffVersion,
  getSnapshotBySession,
  listTariffAudit,
  listTariffs,
  listTariffVersions,
  rollbackTariffVersion,
  saveSnapshot,
} from '../services/pricing/repository.mjs';

const router = Router();

router.get('/tariffs', optionalAuth, async (_req, res) => {
  try {
    const tariffs = await listTariffs();
    res.json({ tariffs });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'Tarife nicht ladbar' });
  }
});

router.get('/tariffs/:tariffId/versions', optionalAuth, async (req, res) => {
  try {
    const versions = await listTariffVersions(req.params.tariffId);
    res.json({ versions });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'Versionen nicht ladbar' });
  }
});

router.get('/tariffs/:tariffId/audit', requireAuth, async (req, res) => {
  try {
    const audit = await listTariffAudit(req.params.tariffId);
    res.json({ audit });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'Audit nicht ladbar' });
  }
});

router.post('/tariffs/import-citrineos', requireAuth, async (req, res) => {
  const { name, citrineosTariff } = req.body ?? {};
  if (!name || !citrineosTariff) {
    res.status(400).json({ error: 'name und citrineosTariff erforderlich' });
    return;
  }
  try {
    const result = await createTariffFromCitrineos({ name, citrineosTariff });
    res.status(201).json(result);
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'Import fehlgeschlagen' });
  }
});

router.post('/tariffs/:tariffId/versions/:versionId/activate', requireAuth, async (req, res) => {
  try {
    await activateTariffVersion(req.params.tariffId, req.params.versionId, req.userId);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'Aktivierung fehlgeschlagen' });
  }
});

router.post('/tariffs/:tariffId/versions/:versionId/rollback', requireAuth, async (req, res) => {
  try {
    await rollbackTariffVersion(req.params.tariffId, req.params.versionId, req.userId);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'Rollback fehlgeschlagen' });
  }
});

/** Kostenvorschau anhand Beispiel-Sitzung + Ereignissen */
router.post('/preview', optionalAuth, async (req, res) => {
  const { tariffVersion, events, asOf } = req.body ?? {};
  if (!tariffVersion?.components || !Array.isArray(events)) {
    res.status(400).json({ error: 'tariffVersion und events[] erforderlich' });
    return;
  }
  try {
    const body = buildTariffVersionPayload({
      tariffId: tariffVersion.tariffId ?? 'preview',
      version: tariffVersion.version ?? 1,
      name: tariffVersion.name ?? 'Vorschau',
      validFrom: tariffVersion.validFrom ?? new Date().toISOString(),
      validTo: tariffVersion.validTo ?? null,
      timezone: tariffVersion.timezone ?? 'Europe/Berlin',
      currency: tariffVersion.currency ?? 'EUR',
      taxRateBp: tariffVersion.taxRateBp ?? 1900,
      components: tariffVersion.components,
      minPrice: tariffVersion.minPrice ?? null,
      maxPrice: tariffVersion.maxPrice ?? null,
      status: 'draft',
    });
    const snapshot = createTariffSnapshot({
      sessionId: 'preview',
      tariffVersion: { ...body, id: tariffVersion.id ?? 'preview_v' },
      source: 'manual',
      midCertified: Boolean(req.body?.midCertified),
      meterProofs: req.body?.meterProofs ?? [],
    });
    const cost = computeCost({ snapshot, events, asOf });
    res.json({ snapshot: { hash: snapshot.hash, frozenAt: snapshot.frozenAt }, cost });
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : 'Vorschau fehlgeschlagen' });
  }
});

/** Aktuelle Preisbestandteile für App / Ad-hoc */
router.get('/current/:tariffId', optionalAuth, async (req, res) => {
  try {
    const version = await getActiveTariffVersion(req.params.tariffId);
    if (!version) {
      res.status(404).json({ error: 'Kein aktiver Tarif' });
      return;
    }
    res.json({
      tariffId: req.params.tariffId,
      version,
      ocpi: toOcpiTariff(version),
    });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'Tarif nicht ladbar' });
  }
});

/** OCPI-ähnliche Tarifdarstellung (vereinfacht) */
router.get('/ocpi/tariffs', optionalAuth, async (_req, res) => {
  try {
    const tariffs = await listTariffs();
    const out = [];
    for (const t of tariffs) {
      const version = await getActiveTariffVersion(t.id);
      if (version) out.push(toOcpiTariff(version, t));
    }
    res.json({ tariffs: out, version: '2.2.1' });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'OCPI-Export fehlgeschlagen' });
  }
});

router.get('/snapshots/session/:sessionId', requireAuth, async (req, res) => {
  try {
    const snapshot = await getSnapshotBySession(req.params.sessionId);
    if (!snapshot) {
      res.status(404).json({ error: 'Kein Snapshot' });
      return;
    }
    res.json({ snapshot });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'Snapshot nicht ladbar' });
  }
});

function toOcpiTariff(version, tariffRow) {
  return {
    id: version.tariffId,
    currency: version.currency,
    tax_rate: (version.taxRateBp ?? 0) / 10_000,
    elements: version.components.map((c, i) => ({
      price_components: [
        {
          type: mapOcpiType(c.kind),
          price: Number(c.rate),
          step_size: c.kind === 'energy' ? 1 : 60,
        },
      ],
      restrictions: {
        start_time: c.validFromLocal,
        end_time: c.validToLocal,
        day_of_week: c.weekdays,
      },
      position: c.priority ?? i,
    })),
    last_updated: version.activatedAt ?? tariffRow?.updated_at,
    tariff_alt_text: [{ language: 'de', text: version.name ?? tariffRow?.name }],
  };
}

function mapOcpiType(kind) {
  const map = {
    energy: 'ENERGY',
    time: 'TIME',
    session: 'FLAT',
    idle: 'PARKING_TIME',
    reservation: 'FLAT',
  };
  return map[kind] ?? 'FLAT';
}

export default router;
