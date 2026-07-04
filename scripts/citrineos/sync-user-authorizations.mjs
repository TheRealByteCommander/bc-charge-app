#!/usr/bin/env node
/**
 * Legt für alle BC-Nutzer membershipId als CitrineOS-Authorization an.
 * Auf dem Server: cd /opt/bc-charge && node scripts/citrineos/sync-user-authorizations.mjs
 */
import { initDb, listUserMembershipIds } from '../../server/db.mjs';
import { ensureCitrineosAuthorization } from '../../server/services/citrineosAuth.mjs';

await initDb();

const users = await listUserMembershipIds();
if (users.length === 0) {
  console.log('Keine Nutzer mit membershipId gefunden.');
  process.exit(0);
}

let ok = 0;
let failed = 0;

for (const { userId, membershipId } of users) {
  try {
    const result = await ensureCitrineosAuthorization(membershipId);
    if (result.skipped) {
      console.warn(`⊘ ${userId} (${membershipId}): ${result.reason}`);
      continue;
    }
    console.log(`✓ ${userId} → ${result.idToken} (id ${result.id ?? '—'})`);
    ok += 1;
  } catch (e) {
    console.error(`✗ ${userId} (${membershipId}):`, e instanceof Error ? e.message : e);
    failed += 1;
  }
}

console.log(`\nFertig: ${ok} ok, ${failed} fehlgeschlagen, ${users.length} gesamt`);
process.exit(failed > 0 ? 1 : 0);
