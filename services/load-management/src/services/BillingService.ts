import { createWriteStream, existsSync, mkdirSync } from 'fs';
import { join, resolve } from 'path';
import type { ChargingSession } from './pricing';

/**
 * DATEV / Lexoffice mapping for EV charging sessions.
 */
export type PaymentMethod = 'stripe' | 'rfid' | 'guest' | 'deeplink' | 'unknown';

export interface BillingTransaction {
  sessionId: string;
  customerId: string;
  timestamp: Date;
  energyKwh: number;
  totalAmount: number;
  taxAmount: number;
  netAmount: number;
  currency: string;
  locationId: string;
  stationId: string;
  connectorId: number;
  paymentMethod: PaymentMethod;
  idleFee?: number;
  energyFee?: number;
}

export interface AccountingRow {
  date: string;
  account: string;
  amount: string;
  text: string;
  taxCode: string;
  currency: string;
  documentField: string;
  contraAccount: string;
}

export interface BillingServiceConfig {
  exportDir: string;
  revenueAccount: string;
  bankAccount: string;
  vatRate: number;
  vatCode: string;
  currency: string;
}

const DEFAULT_CONFIG: BillingServiceConfig = {
  exportDir:
    process.env.BILLING_EXPORT_DIR ||
    join(process.cwd(), 'exports'),
  revenueAccount: process.env.BILLING_REVENUE_ACCOUNT || '8400',
  bankAccount: process.env.BILLING_BANK_ACCOUNT || '1200',
  vatRate: parseFloat(process.env.BILLING_VAT_RATE || '0.19'),
  vatCode: process.env.BILLING_VAT_CODE || '3', // DATEV Steuerschlüssel 19% often "3" depending on consultant
  currency: process.env.BILLING_CURRENCY || 'EUR',
};

export class BillingService {
  private readonly config: BillingServiceConfig;

  constructor(config: Partial<BillingServiceConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    if (!existsSync(this.config.exportDir)) {
      mkdirSync(this.config.exportDir, { recursive: true });
    }
  }

  /**
   * Build a billing transaction from a completed/idle pricing session.
   */
  public fromChargingSession(
    session: ChargingSession,
    options: {
      customerId?: string;
      locationId?: string;
      paymentMethod?: PaymentMethod;
      currency?: string;
      vatRate?: number;
    } = {}
  ): BillingTransaction {
    if (session.status === 'active') {
      throw new Error(`Session ${session.id} is still active; end it before billing`);
    }
    if (session.status === 'cancelled') {
      throw new Error(`Session ${session.id} is cancelled and not billable`);
    }

    const gross = Number(session.totalPrice ?? 0);
    if (!Number.isFinite(gross) || gross < 0) {
      throw new Error(`Session ${session.id} has invalid totalPrice`);
    }

    const vatRate = options.vatRate ?? this.config.vatRate;
    const netAmount = this.round2(gross / (1 + vatRate));
    const taxAmount = this.round2(gross - netAmount);
    const energyFee = session.totalEnergy !== undefined && session.tariffApplied
      ? this.round2(session.totalEnergy * session.tariffApplied.pricePerKwh)
      : undefined;

    return {
      sessionId: session.id,
      customerId: options.customerId || 'GUEST',
      timestamp: session.endTimestamp || session.startTimestamp,
      energyKwh: this.round3(session.totalEnergy ?? 0),
      totalAmount: this.round2(gross),
      taxAmount,
      netAmount,
      currency: options.currency || this.config.currency,
      locationId: options.locationId || session.stationId,
      stationId: session.stationId,
      connectorId: session.connectorId,
      paymentMethod: options.paymentMethod || 'unknown',
      idleFee: session.idleFee !== undefined ? this.round2(session.idleFee) : undefined,
      energyFee,
    };
  }

  /**
   * Map a billing transaction to a DATEV-style booking row (gross amount).
   */
  public mapToDatev(tx: BillingTransaction): AccountingRow {
    const date = this.formatDatevDate(tx.timestamp);
    const amount = this.formatDatevAmount(tx.totalAmount);
    const text = this.sanitizeText(
      `BC Charge ${tx.sessionId} ${tx.stationId}/c${tx.connectorId} ${tx.energyKwh.toFixed(3)}kWh ${tx.paymentMethod}`
    );

    return {
      date,
      account: this.config.revenueAccount,
      amount,
      text,
      taxCode: this.config.vatCode,
      currency: tx.currency || this.config.currency,
      documentField: tx.sessionId.slice(0, 36),
      contraAccount: this.config.bankAccount,
    };
  }

  /**
   * Export transactions as DATEV-compatible CSV (semicolon, European decimals).
   */
  public async exportToCsv(
    transactions: BillingTransaction[],
    filename = `billing_export_${this.stamp()}.csv`
  ): Promise<string> {
    if (!Array.isArray(transactions) || transactions.length === 0) {
      throw new Error('No transactions to export');
    }

    const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    const filePath = resolve(this.config.exportDir, safeName);

    if (!existsSync(this.config.exportDir)) {
      mkdirSync(this.config.exportDir, { recursive: true });
    }

    const writeStream = createWriteStream(filePath, { encoding: 'utf8' });

    // Header aligned with common DATEV ASCII import fields (simplified subset)
    writeStream.write(
      'Umsatz (ohne Soll/Haben-Kz);Soll/Haben-Kennzeichen;WKZ Umsatz;Kurs;Basis-Umsatz;WKZ Basis-Umsatz;Konto;Gegenkonto (ohne BU-Schlüssel);BU-Schlüssel;Belegdatum;Belegfeld 1;Belegfeld 2;Skonto;Buchungstext\n'
    );

    for (const tx of transactions) {
      const row = this.mapToDatev(tx);
      const line = [
        row.amount, // Umsatz
        'H', // Haben on revenue
        row.currency,
        '', // Kurs
        '', // Basis-Umsatz
        '', // WKZ Basis
        row.account,
        row.contraAccount,
        row.taxCode,
        row.date,
        row.documentField,
        tx.locationId,
        '', // Skonto
        row.text,
      ].join(';');
      writeStream.write(`${line}\n`);
    }

    await new Promise<void>((resolvePromise, reject) => {
      writeStream.end(() => resolvePromise());
      writeStream.on('error', reject);
    });

    return filePath;
  }

  public getExportDir(): string {
    return this.config.exportDir;
  }

  private formatDatevDate(date: Date): string {
    // DATEV Belegdatum often TTMM
    const dd = String(date.getDate()).padStart(2, '0');
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    return `${dd}${mm}`;
  }

  private formatDatevAmount(value: number): string {
    return this.round2(value).toFixed(2).replace('.', ',');
  }

  private sanitizeText(value: string): string {
    return value.replace(/[;\r\n]+/g, ' ').trim().slice(0, 60);
  }

  private round2(n: number): number {
    return Math.round((n + Number.EPSILON) * 100) / 100;
  }

  private round3(n: number): number {
    return Math.round((n + Number.EPSILON) * 1000) / 1000;
  }

  private stamp(): string {
    const d = new Date();
    const p = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
  }
}
