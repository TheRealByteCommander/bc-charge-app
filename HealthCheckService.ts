import { OCPPClientWrapper } from './ocpp-client-wrapper';

export class HealthCheckService {
    private chargers: any[];

    constructor(chargersConfig: any[]) {
        this.chargers = chargersConfig;
    }

    async performHealthCheck(): Promise<void> {
        console.log(`[HealthCheck] Starting scan at ${new Date().toISOString()}`);
        
        for (const charger of this.chargers) {
            try {
                const wrapper = new OCPPClientWrapper(charger.id, charger.url);
                
                // Logic: GetStatus -> If Not Available/Error -> Reset
                const statusResponse = await wrapper.getStatus(charger.connectorId || 1);
                console.log(`[HealthCheck] Charger ${charger.id} status: ${statusResponse.status}`);

                if (statusResponse.status !== 'Available' && statusResponse.status !== 'Charging') {
                    console.warn(`[HealthCheck] Charger ${charger.id} is in state ${statusResponse.status}. Triggering Reset.`);
                    const resetSuccess = await wrapper.reset(charger.connectorId || 1);
                    if (resetSuccess) {
                        console.log(`[HealthCheck] Reset successfully sent to ${charger.id}`);
                    } else {
                        console.error(`[HealthCheck] Reset failed for ${charger.id}`);
                    }
                }
            } catch (error) {
                console.error(`[HealthCheck] Failed to check charger ${charger.id}:`, error);
            }
        }
        console.log(`[HealthCheck] Scan completed.`);
    }
}

// Simple Runner for Cron execution
async function run() {
    const config = require('./cron-config.json');
    const service = new HealthCheckService(config.chargers);
    await service.performHealthCheck();
}

if (require.main === module) {
    run().catch(console.error);
}
