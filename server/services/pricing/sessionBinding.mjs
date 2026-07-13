import { createTariffSnapshot } from './tariffSnapshot.mjs';
import {
  createTariffFromCitrineos,
  getActiveTariffVersion,
  getSnapshotBySession,
  saveSnapshot,
  activateTariffVersion,
} from './repository.mjs';
import { citrineosTariffToComponents, buildTariffVersionPayload } from './tariffModel.mjs';

/**
 * Bindet TariffSnapshot an neue Session (Start/Autorisierung).
 * @param {object} session ChargingSession
 * @param {object} opts
 */
export async function attachTariffSnapshotToSession(session, opts = {}) {
  const {
    tariffId,
    citrineosTariff,
    midCertified = session.midCertified ?? false,
    meterProofs = [],
    source = 'bc-engine',
  } = opts;

  let version = tariffId ? await getActiveTariffVersion(tariffId) : null;

  if (!version && citrineosTariff) {
    const imported = await createTariffFromCitrineos({
      name: session.stationName ?? 'Tarif',
      citrineosTariff,
    });
    await activateTariffVersion(imported.tariffId, imported.versionId, 'system');
    version = { ...imported.version, id: imported.versionId, status: 'active' };
  }

  if (!version && citrineosTariff) {
    const body = buildTariffVersionPayload({
      tariffId: `inline_${session.stationId}`,
      version: 1,
      name: session.stationName ?? 'Inline',
      validFrom: session.startedAt ?? new Date().toISOString(),
      currency: citrineosTariff.currency ?? 'EUR',
      taxRateBp: Math.round((citrineosTariff.taxRate ?? 0.19) * 10_000),
      components: citrineosTariffToComponents(citrineosTariff),
      status: 'active',
    });
    version = { ...body, id: `inline_v_${session.id}` };
  }

  if (!version) return session;

  const snapshot = createTariffSnapshot({
    sessionId: session.id,
    tariffVersion: version,
    source,
    midCertified,
    meterProofs,
  });
  await saveSnapshot(snapshot);

  const energy = version.components.find((c) => c.kind === 'energy');
  const sessionFee = version.components.find((c) => c.kind === 'session');
  const time = version.components.find((c) => c.kind === 'time');

  return {
    ...session,
    tariffSnapshotId: snapshot.id,
    tariffSnapshotHash: snapshot.hash,
    tariffVersionId: version.id,
    pricePerKwh: energy ? Number(energy.rate) : session.pricePerKwh,
    sessionFee: sessionFee ? Number(sessionFee.rate) : session.sessionFee,
    pricePerMin: time ? Number(time.rate) : session.pricePerMin,
    currency: version.currency ?? session.currency,
  };
}

export async function loadSessionSnapshot(sessionId) {
  return getSnapshotBySession(sessionId);
}
