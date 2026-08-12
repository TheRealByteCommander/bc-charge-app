import { readFileSync } from 'fs';
import { BillingService, BillingTransaction } from './services/BillingService';
import { PricingService } from './services/pricing';

async function testBillingExport(): Promise<void> {
  const billingService = new BillingService();

  const mockTransactions: BillingTransaction[] = [
    {
      sessionId: 'sess_12345',
      customerId: 'cust_abc',
      timestamp: new Date(),
      energyKwh: 25.5,
      totalAmount: 15.2,
      taxAmount: 2.43,
      netAmount: 12.77,
      currency: 'EUR',
      locationId: 'LOC_BERLIN_01',
      stationId: 'CS001',
      connectorId: 1,
      paymentMethod: 'stripe',
      energyFee: 12.75,
    },
    {
      sessionId: 'sess_67890',
      customerId: 'cust_def',
      timestamp: new Date(),
      energyKwh: 12.1,
      totalAmount: 7.5,
      taxAmount: 1.2,
      netAmount: 6.3,
      currency: 'EUR',
      locationId: 'LOC_MUNICH_02',
      stationId: 'CS002',
      connectorId: 1,
      paymentMethod: 'rfid',
    },
  ];

  console.log('Starting billing export test...');
  const path = await billingService.exportToCsv(mockTransactions, 'test_billing_export.csv');
  console.log(`Export successful! File saved at: ${path}`);

  const content = readFileSync(path, 'utf8');
  console.log('CSV Content:\n', content);

  if (content.includes('8400') && content.includes('15,20')) {
    console.log('✅ Validation passed: DATEV mapping and amount format are correct.');
  } else {
    throw new Error('Validation failed: Expected DATEV format not found.');
  }

  // Also verify session → billing mapping
  const pricing = new PricingService(
    {
      defaultPricePerKwh: 0.3,
      defaultIdleFeePerMin: 0.05,
      currency: 'EUR',
      timezone: 'Europe/Berlin',
    },
    console
  );
  const sessionId = pricing.startSession('CS001', 1, 100, {
    customerId: 'cust_map',
    locationId: 'LOC_X',
    source: 'deeplink',
  });
  const session = pricing.endSession(sessionId, 110);
  const tx = billingService.fromChargingSession(session, {
    customerId: session.customerId,
    locationId: session.locationId,
    paymentMethod: 'deeplink',
  });

  if (tx.energyKwh !== 10 || tx.totalAmount <= 0 || !tx.netAmount) {
    throw new Error(`fromChargingSession produced invalid transaction: ${JSON.stringify(tx)}`);
  }
  console.log('✅ Session→Billing mapping OK:', tx);
}

testBillingExport().catch((error) => {
  console.error('Billing export test failed:', error);
  process.exit(1);
});
