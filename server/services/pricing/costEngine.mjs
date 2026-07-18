import {
  applyTax,
  clampMoney,
  energyCost,
  moneyFromDecimal,
  moneyToDecimal,
  roundMoneyToCents,
  timeCost,
} from './money.mjs';
import { parseMinMax } from './tariffModel.mjs';
import {
  deriveChargingWindow,
  deriveIdleIntervals,
  durationSeconds,
  latestEnergyWh,
} from './events.mjs';

/**
 * Deterministische Kostenberechnung aus Snapshot + Ereignissen.
 * @param {object} input
 * @param {import('./types.mjs').TariffSnapshot} input.snapshot
 * @param {import('./types.mjs').SessionPricingEvent[]} input.events
 * @param {string} [input.asOf] ISO – für offene Sessions
 */
export function computeCost({ snapshot, events, asOf }) {
  const tariff = snapshot.tariff;
  const taxRateBp = tariff.taxRateBp ?? 0;
  const { min, max } = parseMinMax(tariff);
  const endAt =
    asOf ??
    events.find((e) => e.type === 'session_stop')?.at ??
    new Date().toISOString();

  const energyWh = latestEnergyWh(events);
  const window = deriveChargingWindow(events);
  const chargingSeconds = durationSeconds(window.start, window.stop ?? endAt);
  const idleIntervals = deriveIdleIntervals(events);

  /** @type {import('./types.mjs').CostLineItem[]} */
  const lines = [];
  let net = 0n;

  const byKind = groupComponents(tariff.components);

  if (byKind.session?.length) {
    const rate = moneyFromDecimal(byKind.session[0].rate);
    net += rate;
    lines.push(line('session_fee', 'session', 'Session-Gebühr', rate, taxRateBp));
  }

  if (byKind.energy?.length && energyWh > 0) {
    const rate = moneyFromDecimal(byKind.energy[0].rate);
    const amount = energyCost(energyWh, rate);
    net += amount;
    lines.push(
      line('energy', 'energy', 'Energie', amount, taxRateBp, {
        energyWh,
        midCertified: snapshot.midCertified,
      })
    );
  }

  if (byKind.time?.length && chargingSeconds > 0) {
    const rate = moneyFromDecimal(byKind.time[0].rate);
    const amount = timeCost(chargingSeconds, rate);
    net += amount;
    lines.push(line('time', 'time', 'Ladezeit', amount, taxRateBp, { chargingSeconds }));
  }

  if (byKind.idle?.length) {
    const comp = byKind.idle[0];
    const grace = comp.idleGraceSeconds ?? 0;
    const rate = moneyFromDecimal(comp.rate);
    let idleSeconds = 0;
    for (const iv of idleIntervals) {
      const end = iv.end ?? endAt;
      const sec = durationSeconds(iv.start, end);
      idleSeconds += Math.max(0, sec - grace);
    }
    if (idleSeconds > 0) {
      const amount = timeCost(idleSeconds, rate);
      net += amount;
      lines.push(line('idle', 'idle', 'Blockiergebühr', amount, taxRateBp, { idleSeconds, grace }));
    }
  }

  if (byKind.reservation?.length) {
    const resStart = events.find((e) => e.type === 'reservation_start')?.at;
    const resEnd = events.find((e) => e.type === 'reservation_end')?.at ?? endAt;
    const resSec = durationSeconds(resStart, resEnd);
    if (resSec > 0) {
      const rate = moneyFromDecimal(byKind.reservation[0].rate);
      const amount = timeCost(resSec, rate);
      net += amount;
      lines.push(line('reservation', 'reservation', 'Reservierung', amount, taxRateBp, { resSec }));
    }
  }

  net = clampMoney(net, min, max);
  const netRounded = roundMoneyToCents(net);
  const grossScaled = applyTax(netRounded, taxRateBp);
  const grossRounded = roundMoneyToCents(grossScaled);
  const tax = grossRounded - netRounded;

  return {
    netEur: moneyToDecimal(netRounded),
    taxEur: moneyToDecimal(tax),
    grossEur: moneyToDecimal(grossRounded),
    energyWh,
    chargingSeconds,
    idleSeconds: idleIntervals.reduce((s, iv) => {
      const end = iv.end ?? endAt;
      return s + durationSeconds(iv.start, end);
    }, 0),
    lines,
    snapshotHash: snapshot.hash,
  };
}

function groupComponents(components) {
  return components.reduce((acc, c) => {
    if (!acc[c.kind]) acc[c.kind] = [];
    acc[c.kind].push(c);
    return acc;
  }, /** @type {Record<string, import('./types.mjs').TariffComponent[]>} */ ({}));
}

function line(code, kind, label, netScaled, taxRateBp, meta) {
  const netRounded = roundMoneyToCents(netScaled);
  const gross = applyTax(netRounded, taxRateBp);
  const tax = gross - netRounded;
  return {
    code,
    kind,
    label,
    netEur: moneyToDecimal(netRounded),
    taxEur: moneyToDecimal(tax),
    grossEur: moneyToDecimal(gross),
    meta,
  };
}

/**
 * Nachträgliche Korrektur: Storno + Adjustment statt Mutation abgeschlossener Abrechnung.
 * @param {import('./types.mjs').CostResult} original
 * @param {import('./types.mjs').CostResult} corrected
 */
export function buildAdjustmentEntries(original, corrected, reason) {
  const storno = {
    entryType: 'storno',
    netEur: moneyToDecimal(-roundMoneyToCents(moneyFromDecimal(original.netEur))),
    taxEur: moneyToDecimal(-roundMoneyToCents(moneyFromDecimal(original.taxEur))),
    grossEur: moneyToDecimal(-roundMoneyToCents(moneyFromDecimal(original.grossEur))),
    reason: `Storno: ${reason}`,
  };
  const adjustment = {
    entryType: 'adjustment',
    netEur: corrected.netEur,
    taxEur: corrected.taxEur,
    grossEur: corrected.grossEur,
    reason,
  };
  return [storno, adjustment];
}
