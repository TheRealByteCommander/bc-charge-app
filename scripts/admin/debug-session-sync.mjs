#!/usr/bin/env node
/**
 * Zeigt CitrineOS-Sync-Status für die aktive Session eines Nutzers.
 * cd /opt/bc-charge && node scripts/admin/debug-session-sync.mjs user@example.com
 */
import { initDb, findUserByEmail, listSessions } from '../../server/db.mjs';
import { syncAccountSessionFromCitrineos } from '../../server/services/citrineosServer.mjs';

const email = process.argv[2]?.trim();
if (!email) {
  console.error('Verwendung: node scripts/admin/debug-session-sync.mjs <email>');
  process.exit(1);
}

await initDb();

const user = await findUserByEmail(email);
if (!user) {
  console.error(`Nutzer nicht gefunden: ${email}`);
  process.exit(1);
}

const sessions = await listSessions(user.id);
const active = sessions.find((s) => s.status === 'active');
if (!active) {
  console.log(`Keine aktive Sitzung für ${email}`);
  process.exit(0);
}

console.log('── DB-Session ──');
console.log(JSON.stringify(active, null, 2));

console.log('\n── Nach CitrineOS-Sync ──');
const synced = await syncAccountSessionFromCitrineos(active);
console.log(JSON.stringify(synced, null, 2));
