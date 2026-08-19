import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Vitest owns pricing/price-optimization suites.
    // node:test server-unit files stay on `npm run test:server-unit` (not Vitest).
    include: [
      'server/services/pricing/**/*.test.mjs',
      'server/services/priceOptimization/**/*.test.mjs',
      'src/utils/safeJson.test.ts',
      'src/utils/sessionLiveEqual.test.ts',
      'src/utils/storage.activeSessionCache.test.ts',
      'src/utils/storage.localStores.test.ts',
      'src/utils/offlineCache.test.ts',
      'src/services/localStores.guards.test.ts',
      'src/api/citrineos/dto.test.ts',
      'src/api/citrineos/messages.test.ts',
      'src/api/citrineos/paths.test.ts',
      'src/api/parse.test.ts',
      'src/api/backend/schemas.test.ts',
      'src/services/stationCheckIn.test.ts',
    ],
    environment: 'node',
  },
});
