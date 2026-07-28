import { initDb } from './db.mjs';
import { initConfigTable } from './services/configService.mjs';
import app from './app.mjs';
import { logger } from './utils/logger.mjs';

async function bootstrap() {
  try {
    logger.info('Bootstrapping BC-Charge-Server...');
    await initDb();
    await initConfigTable();
    logger.info('Server started successfully.');
  } catch (e) {
    logger.error('Bootstrap failed:', e);
    process.exit(1);
  }
}

bootstrap();
