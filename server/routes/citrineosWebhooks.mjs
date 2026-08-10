import { Router } from 'express';
import logger from '../utils/logger.mjs';
import { applyCitrineosWebhookToSessions } from '../db.mjs';
import { canaryValidate } from '../services/canaryValidator.mjs';

const router = Router();

/**
 * Pull Energy.Active.Import.Register from OCPP 2.0.1 meterValue arrays (Wh or kWh).
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
      const unit = String(
        sample?.unit || sample?.unitOfMeasure?.unit || ''
      ).toLowerCase();
      energyKwh = unit === 'wh' ? raw / 1000 : raw;
    }
  }
  return energyKwh;
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

  const transactionId =
    body.transactionId ?? body.transaction_id ?? body.id ?? body.transaction?.id ?? null;
  const remoteStartIdRaw =
    body.remoteStartId ?? body.remote_start_id ?? body.remoteStart?.id ?? null;
  const remoteStartId =
    remoteStartIdRaw == null || remoteStartIdRaw === ''
      ? null
      : Number.isFinite(Number(remoteStartIdRaw))
        ? Number(remoteStartIdRaw)
        : remoteStartIdRaw;

  let totalKwhRaw = body.totalKwh ?? body.totalEnergyKwh ?? body.energyKwh ?? body.total_kwh;
  const totalCostRaw = body.totalCost ?? body.cost ?? body.costEur ?? body.total_cost;
  const isActiveRaw = body.isActive ?? body.active ?? body.is_active;

  // OCPP 2.0.1 TransactionEvent: energy often only in meterValue[].sampledValue
  // (triggerReason e.g. ChargingRateChanged / MeterValuePeriodic) — no flat totalKwh.
  if (totalKwhRaw == null || totalKwhRaw === '') {
    const fromMeter = extractEnergyKwhFromMeterValues(
      body.meterValue ?? body.meterValues ?? body.transactionInfo?.meterValue
    );
    if (fromMeter != null) totalKwhRaw = fromMeter;
  }

  let isActive = undefined;
  if (typeof isActiveRaw === 'boolean') isActive = isActiveRaw;
  else if (isActiveRaw === 'true' || isActiveRaw === 1) isActive = true;
  else if (isActiveRaw === 'false' || isActiveRaw === 0) isActive = false;
  else if (typeof body.status === 'string') {
    const s = body.status.toLowerCase();
    if (s === 'completed' || s === 'stopped' || s === 'ended' || s === 'finished') isActive = false;
    if (s === 'active' || s === 'charging' || s === 'started') isActive = true;
  } else if (typeof body.eventType === 'string') {
    const s = body.eventType.toLowerCase();
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
    isActive !== undefined;

  if (!hasSignal) return null;

  return {
    transactionId: transactionId != null ? String(transactionId) : null,
    remoteStartId,
    totalKwh: Number.isFinite(totalKwh) ? totalKwh : null,
    totalCost: Number.isFinite(totalCost) ? totalCost : null,
    isActive,
  };
}

/**
 * CitrineOS Webhook for Transaction Events.
 * Writes into charging_sessions / adhoc_sessions data_json (not flat SQL columns).
 */
router.post('/', async (req, res) => {
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
      logger.info('[CitrineOS Webhook] Applied', result);
    }
    res.json({ received: true, matched: result.matched, actions: result.actions });
  } catch (e) {
    logger.error('[CitrineOS Webhook] Error processing event:', e);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

export default router;
export { normalizeCitrineosWebhookPayload };
