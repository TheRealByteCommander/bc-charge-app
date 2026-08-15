import { timingSafeEqual } from 'crypto';
import { Router } from 'express';
import logger from '../utils/logger.mjs';
import { applyCitrineosWebhookToSessions } from '../db.mjs';
import { canaryValidate } from '../services/canaryValidator.mjs';
import {
  resolveStationIdsForReopt,
  shouldTriggerLmReopt,
  triggerLmReoptFromWebhook,
} from '../services/loadManagementReopt.mjs';

const router = Router();

/**
 * Optional shared-secret gate for CitrineOS webhooks.
 * Env: CITRINEOS_WEBHOOK_SECRET (or alias BC_CITRINEOS_WEBHOOK_SECRET).
 * Accepts Authorization: Bearer <secret>, x-citrineos-webhook-secret, or x-webhook-secret.
 * When unset: allow in non-production (dev); reject with 503 in production.
 */
export function resolveCitrineosWebhookSecret(env = process.env) {
  const secret = (env.CITRINEOS_WEBHOOK_SECRET || env.BC_CITRINEOS_WEBHOOK_SECRET || '').trim();
  return secret || null;
}

function readPresentedWebhookSecret(req) {
  const auth = req.get('authorization') || req.get('Authorization') || '';
  if (typeof auth === 'string' && auth.toLowerCase().startsWith('bearer ')) {
    return auth.slice(7).trim();
  }
  const header =
    req.get('x-citrineos-webhook-secret') ||
    req.get('x-webhook-secret') ||
    req.get('x-bc-webhook-secret') ||
    '';
  return typeof header === 'string' ? header.trim() : '';
}

function secretsEqual(presented, expected) {
  if (!presented || !expected) return false;
  const a = Buffer.from(presented, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function assertCitrineosWebhookAuthorized(req, env = process.env) {
  const expected = resolveCitrineosWebhookSecret(env);
  const nodeEnv = (env.NODE_ENV || '').toLowerCase();
  const production = nodeEnv === 'production';

  if (!expected) {
    if (production) {
      return {
        ok: false,
        status: 503,
        error:
          'CitrineOS webhook secret not configured (set CITRINEOS_WEBHOOK_SECRET)',
      };
    }
    return { ok: true, mode: 'open-dev' };
  }

  const presented = readPresentedWebhookSecret(req);
  if (!secretsEqual(presented, expected)) {
    return { ok: false, status: 401, error: 'Unauthorized webhook' };
  }
  return { ok: true, mode: 'secret' };
}

/**
 * Pull Energy.Active.Import.Register from OCPP 2.0.1 meterValue arrays (Wh or kWh).
 * OCPP default unit for this measurand is Wh when unit/unitOfMeasure is omitted.
 * Honors unitOfMeasure.multiplier (value × 10^multiplier) per the protocol.
 * Returns null when no usable sample is present.
 */
function extractEnergyKwhFromMeterValues(meterValue) {
  if (!meterValue || !Array.isArray(meterValue)) return null;
  let energyKwh = null;
  for (const entry of meterValue) {
    const samples = entry?.sampledValue || entry?.sampled_value;
    if (!samples || !Array.isArray(samples)) continue;
    for (const sample of samples) {
      const measurand = sample?.measurand || sample?.Measurand;
      if (measurand !== 'Energy.Active.Import.Register') continue;
      const raw = Number(sample?.value);
      if (!Number.isFinite(raw)) continue;

      const uom =
        sample?.unitOfMeasure && typeof sample.unitOfMeasure === 'object'
          ? sample.unitOfMeasure
          : sample?.unit_of_measure && typeof sample.unit_of_measure === 'object'
            ? sample.unit_of_measure
            : null;
      const unitRaw =
        sample?.unit ??
        sample?.Unit ??
        (uom ? uom.unit ?? uom.Unit : null) ??
        '';
      // Spec default for Energy.Active.Import.Register is Wh — never treat empty as kWh.
      const unit = String(unitRaw || 'Wh').trim().toLowerCase();

      let multiplier = 0;
      if (uom) {
        const m = uom.multiplier ?? uom.Multiplier;
        if (m != null && Number.isFinite(Number(m))) multiplier = Number(m);
      }
      const scaled = raw * 10 ** multiplier;

      if (unit === 'kwh' || unit === 'kw.h' || unit === 'kilowatthour') {
        energyKwh = scaled;
      } else {
        // Wh / W.h / watthour / unknown → Wh
        energyKwh = scaled / 1000;
      }
    }
  }
  return energyKwh;
}

/** OCPP 2.0.1 Transaction.ChargingStateEnumType (+ common casing variants). */
const OCPP_CHARGING_STATE_BY_KEY = Object.freeze(
  Object.fromEntries(
    ['Idle', 'EVConnected', 'Charging', 'SuspendedEV', 'SuspendedEVSE'].map((s) => [
      s.toLowerCase(),
      s,
    ])
  )
);

/**
 * Accept only real OCPP charging states; drop session lifecycle strings / garbage.
 * @param {unknown} raw
 * @returns {string | null}
 */
function normalizeOcppChargingState(raw) {
  if (typeof raw !== 'string') return null;
  const t = raw.trim();
  if (!t) return null;
  return OCPP_CHARGING_STATE_BY_KEY[t.toLowerCase()] ?? null;
}

/**
 * Normalize CitrineOS / custom dispatcher payloads into a stable internal shape.
 * Mirrors server/services/citrineosServer.mjs normalizeTransactionRow field aliases.
 */
function normalizeCitrineosWebhookPayload(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;

  // Some dispatchers wrap the event: { type, data } / { event, payload }
  const body =
    raw.data && typeof raw.data === 'object' && !Array.isArray(raw.data)
      ? raw.data
      : raw.payload && typeof raw.payload === 'object' && !Array.isArray(raw.payload)
        ? raw.payload
        : raw;

  const transactionInfo =
    body.transactionInfo && typeof body.transactionInfo === 'object' && !Array.isArray(body.transactionInfo)
      ? body.transactionInfo
      : body.transaction && typeof body.transaction === 'object' && !Array.isArray(body.transaction)
        ? body.transaction
        : null;

  // OCPP 2.0.1 TransactionEvent: transactionId is usually under transactionInfo
  const transactionId =
    body.transactionId ??
    body.transaction_id ??
    transactionInfo?.transactionId ??
    transactionInfo?.transaction_id ??
    transactionInfo?.id ??
    body.id ??
    null;
  const remoteStartIdRaw =
    body.remoteStartId ??
    body.remote_start_id ??
    body.remoteStart?.id ??
    transactionInfo?.remoteStartId ??
    transactionInfo?.remote_start_id ??
    null;
  const remoteStartId =
    remoteStartIdRaw == null || remoteStartIdRaw === ''
      ? null
      : Number.isFinite(Number(remoteStartIdRaw))
        ? Number(remoteStartIdRaw)
        : remoteStartIdRaw;

  let totalKwhRaw = body.totalKwh ?? body.totalEnergyKwh ?? body.energyKwh ?? body.total_kwh;
  const totalCostRaw = body.totalCost ?? body.cost ?? body.costEur ?? body.total_cost;
  const isActiveRaw = body.isActive ?? body.active ?? body.is_active;
  const eventType =
    typeof body.eventType === 'string'
      ? body.eventType
      : typeof body.event_type === 'string'
        ? body.event_type
        : null;
  const seqNoRaw = body.seqNo ?? body.seq_no ?? transactionInfo?.seqNo ?? transactionInfo?.seq_no;
  const seqNo =
    seqNoRaw == null || seqNoRaw === ''
      ? null
      : Number.isFinite(Number(seqNoRaw))
        ? Number(seqNoRaw)
        : null;
  // OCPP 2.0.1 TransactionEvent triggerReason (ChargingRateChanged → LM re-opt signal).
  const triggerReasonRaw =
    body.triggerReason ??
    body.trigger_reason ??
    transactionInfo?.triggerReason ??
    transactionInfo?.trigger_reason ??
    null;
  const triggerReason =
    typeof triggerReasonRaw === 'string' && triggerReasonRaw.trim()
      ? triggerReasonRaw.trim()
      : null;

  // OCPP 2.0.1 transactionInfo.chargingState (Idle/EVConnected/Charging/SuspendedEV/SuspendedEVSE).
  // Useful for LM/UI when triggerReason is ChargingStateChanged or Suspended* without rate change.
  // Do NOT fall back to body.state — session/lifecycle status ("active"/"completed") is not OCPP chargingState
  // and would poison idle-fee / UI consumers (see pricing OCPP_IDLE_STATES).
  const chargingStateRaw =
    body.chargingState ??
    body.charging_state ??
    transactionInfo?.chargingState ??
    transactionInfo?.charging_state ??
    null;
  const chargingState = normalizeOcppChargingState(chargingStateRaw);

  // Station id for LM GetCompositeSchedule re-opt (top-level or nested).
  const stationIdRaw =
    body.stationId ??
    body.station_id ??
    body.chargingStationId ??
    body.charging_station_id ??
    body.identifier ??
    body.connectionName ??
    body.connection_name ??
    transactionInfo?.stationId ??
    transactionInfo?.station_id ??
    null;
  const stationId =
    stationIdRaw == null || stationIdRaw === ''
      ? null
      : String(stationIdRaw).trim() || null;

  // OCPP 2.0.1 TransactionEvent: energy often only in meterValue[].sampledValue
  // (triggerReason e.g. ChargingRateChanged / MeterValuePeriodic) — no flat totalKwh.
  if (totalKwhRaw == null || totalKwhRaw === '') {
    const fromMeter = extractEnergyKwhFromMeterValues(
      body.meterValue ?? body.meterValues ?? body.transactionInfo?.meterValue
    );
    if (fromMeter != null) totalKwhRaw = fromMeter;
  }

  // Prefer explicit flags, then status, then resolved eventType (camel- or snake_case).
  let isActive = undefined;
  if (typeof isActiveRaw === 'boolean') isActive = isActiveRaw;
  else if (isActiveRaw === 'true' || isActiveRaw === 1) isActive = true;
  else if (isActiveRaw === 'false' || isActiveRaw === 0) isActive = false;
  else if (typeof body.status === 'string') {
    const s = body.status.toLowerCase();
    if (s === 'completed' || s === 'stopped' || s === 'ended' || s === 'finished') isActive = false;
    if (s === 'active' || s === 'charging' || s === 'started') isActive = true;
  } else if (typeof eventType === 'string') {
    // Must use resolved eventType — body.event_type alone used to leave isActive unset,
    // so Ended webhooks never completed local sessions.
    const s = eventType.toLowerCase();
    if (s === 'ended' || s.includes('end') || s.includes('stop') || s.includes('complete')) {
      isActive = false;
    } else if (s === 'started' || s === 'updated') {
      isActive = true;
    }
  }

  const totalKwh =
    totalKwhRaw == null || totalKwhRaw === '' ? null : Number(totalKwhRaw);
  const totalCost =
    totalCostRaw == null || totalCostRaw === '' ? null : Number(totalCostRaw);

  const hasSignal =
    transactionId != null ||
    remoteStartId != null ||
    totalKwh != null ||
    totalCost != null ||
    isActive !== undefined ||
    // Rate/limit re-opt may arrive with only trigger + station context.
    (triggerReason != null && shouldTriggerLmReopt(triggerReason));

  if (!hasSignal) return null;

  return {
    transactionId: transactionId != null ? String(transactionId) : null,
    remoteStartId,
    totalKwh: Number.isFinite(totalKwh) ? totalKwh : null,
    totalCost: Number.isFinite(totalCost) ? totalCost : null,
    isActive,
    eventType,
    seqNo,
    triggerReason,
    chargingState,
    stationId,
  };
}

/**
 * CitrineOS Webhook for Transaction Events.
 * Writes into charging_sessions / adhoc_sessions data_json (not flat SQL columns).
 */
router.post('/', async (req, res) => {
  const authz = assertCitrineosWebhookAuthorized(req);
  if (!authz.ok) {
    if (authz.status === 503) {
      logger.error('[CitrineOS Webhook] Rejected: secret missing in production');
    } else {
      logger.warn('[CitrineOS Webhook] Unauthorized request');
    }
    res.status(authz.status).json({ error: authz.error });
    return;
  }
  if (authz.mode === 'open-dev') {
    logger.warn(
      '[CitrineOS Webhook] CITRINEOS_WEBHOOK_SECRET unset — accepting unauthenticated (dev only)'
    );
  }

  const payload = req.body;

  if (payload == null || payload === '') {
    res.status(400).json({ error: 'Empty payload' });
    return;
  }

  // Sampled Zod canary on raw ingress — drift alert only, does not reject.
  if (payload && typeof payload === 'object') {
    canaryValidate('webhook.citrineos.raw', payload, {
      source: 'citrineosWebhooks.post',
    });
  }

  const event = normalizeCitrineosWebhookPayload(payload);
  if (!event) {
    logger.warn('[CitrineOS Webhook] Unrecognized payload shape', {
      keys: payload && typeof payload === 'object' ? Object.keys(payload) : typeof payload,
    });
    res.status(400).json({ error: 'Unrecognized webhook payload' });
    return;
  }

  logger.info('[CitrineOS Webhook] Normalized event', event);

  try {
    const result = await applyCitrineosWebhookToSessions(event);
    if (result.matched === 0) {
      logger.info('[CitrineOS Webhook] No matching local sessions', event);
    } else {
      logger.info('[CitrineOS Webhook] Applied', {
        matched: result.matched,
        actions: result.actions,
      });
    }

    // True fire-and-forget: never await LM/OCPP composite refresh on the webhook path
    // (GetCompositeSchedule can take many seconds / 504). Respond first, reopt in background.
    let lmReoptMeta = null;
    if (shouldTriggerLmReopt(event.triggerReason)) {
      const stationIds = resolveStationIdsForReopt({
        event,
        sessionRows: result.matchedRows,
      });
      lmReoptMeta = { queued: true, stations: stationIds };
      const triggerReason = event.triggerReason;
      const transactionId = event.transactionId;
      setImmediate(() => {
        triggerLmReoptFromWebhook({
          triggerReason,
          stationIds,
          transactionId,
        })
          .then((lmReopt) => {
            if (lmReopt.attempted) {
              logger.info('[CitrineOS Webhook] LM reopt', lmReopt);
            } else if (lmReopt.skipped && lmReopt.skipped !== 'lm_disabled') {
              logger.info('[CitrineOS Webhook] LM reopt skipped', lmReopt);
            }
          })
          .catch((reoptErr) => {
            logger.warn('[CitrineOS Webhook] LM reopt error (ignored)', {
              message: reoptErr instanceof Error ? reoptErr.message : String(reoptErr),
            });
          });
      });
    }

    res.json({
      received: true,
      matched: result.matched,
      actions: result.actions,
      ...(lmReoptMeta ? { lmReopt: lmReoptMeta } : {}),
    });
  } catch (e) {
    logger.error('[CitrineOS Webhook] Error processing event:', e);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

export default router;
export { normalizeCitrineosWebhookPayload };
