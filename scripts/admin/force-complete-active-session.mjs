#!/usr/bin/env node
/**
 * Beendet die aktive Ladung eines Nutzers (Admin/Ops).
 *
 * Auf dem Server:
 *   cd /opt/bc-charge
 *   node scripts/admin/force-complete-active-session.mjs demo@bc-charge.com
 */
import { initDb, findUserByEmail, listSessions, upsertSession } from '../../server/db.mjs';
import {
  syncAccountSessionFromCitrineos,
  stopAndSyncAccountSession,
} from '../../server/services/citrineosServer.mjs';

const email = process.argv[2]?.trim();
if (!email) {
  console.error('Verwendung: node scripts/admin/force-complete-active-session.mjs <email>');
  process.exit(1);
}

await initDb();

const user = await findUserByEmail(email);
if (!user) {
  console.error(`Nutzer nicht gefunden: ${email}`);
  process.exit(1);
}

const sessions = await listSessions(user.id);
let active = sessions.find((s) => s.status === 'active');
if (!active) {
  console.log(`Keine aktive Sitzung für ${email} (${user.id}).`);
  process.exit(0);
}

console.log(`Aktive Sitzung: ${active.id} · ${active.stationName} · seit ${active.startedAt}`);

try {
  active = await syncAccountSessionFromCitrineos(active);
  console.log(`Nach Sync: ${formatKwh(active.energyKwh)} · txActive=${active.citrineosTxActive ?? 'n/a'}`);
} catch (e) {
  console.warn('CitrineOS-Sync fehlgeschlagen:', e instanceof Error ? e.message : e);
}

if (active.citrineosTransactionId && active.citrineosTxActive !== false) {
  try {
    active = await stopAndSyncAccountSession(active);
    console.log(`Remote-Stop OK: ${formatKwh(active.energyKwh)}`);
  } catch (e) {
    console.warn('Remote-Stop fehlgeschlagen, schließe lokal ab:', e instanceof Error ? e.message : e);
  }
}

const completed = {
  ...active,
  status: 'completed',
  endedAt: new Date().toISOString(),
  paymentStatus: active.costEur >= 0.5 ? active.paymentStatus ?? 'skipped' : 'skipped',
};

await upsertSession(user.id, completed);
console.log(`✓ Sitzung ${completed.id} abgeschlossen (${formatKwh(completed.energyKwh)}, ${completed.costEur} €)`);

function formatKwh(kwh) {
  return `${Number(kwh ?? 0).toFixed(2)} kWh`;
}
