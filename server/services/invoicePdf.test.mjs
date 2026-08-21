import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  INVOICE_TABLE_LAYOUT,
  buildInvoicePdf,
  buildLineRows,
  computeInvoiceAmounts,
  measureInvoiceRowHeight,
} from './invoicePdf.mjs';

function makeDocStub({ labelH = 12, subH = 9 } = {}) {
  return {
    font() {
      return this;
    },
    fontSize() {
      return this;
    },
    heightOfString(text, opts = {}) {
      const width = opts.width || 200;
      // crude wrap estimate: ~5.2pt per char at 9pt Helvetica
      const charsPerLine = Math.max(1, Math.floor(width / 5.2));
      const lines = Math.max(1, Math.ceil(String(text || '').length / charsPerLine));
      if (opts._kind === 'sub' || (text && String(text).includes('Ref.'))) {
        return lines * (subH / 1); // keep simple
      }
      return lines * labelH;
    },
  };
}

describe('invoicePdf layout', () => {
  it('computes net/vat from gross', () => {
    const a = computeInvoiceAmounts(1.19);
    assert.equal(a.gross, 1.19);
    assert.equal(a.vatRate, 0.19);
    assert.ok(Math.abs(a.net + a.vat - a.gross) < 0.011);
  });

  it('table columns do not overlap and leave room for wrapped position text', () => {
    const { pageLeft, pageRight, pos, qty, unit, total } = INVOICE_TABLE_LAYOUT;
    assert.equal(pageLeft, 50);
    assert.equal(pageRight, 545);
    assert.ok(pos.x + pos.width <= qty.x, 'position must end before menge');
    assert.ok(qty.x + qty.width <= unit.x, 'menge must end before einzelpreis');
    assert.ok(unit.x + unit.width <= total.x, 'einzelpreis must end before betrag');
    assert.ok(total.x + total.width <= pageRight + 0.5, 'betrag must stay in page');
    // Position column needs enough width for multi-word DE labels
    assert.ok(pos.width >= 220, `expected wide position column, got ${pos.width}`);
    // Numeric columns must have explicit widths (prevents bleed)
    assert.ok(qty.width >= 55);
    assert.ok(unit.width >= 65);
    assert.ok(total.width >= 65);
  });

  it('buildLineRows for collective keeps label short and detail separate', () => {
    const session = {
      isCollectiveInvoice: true,
      lineItems: [
        {
          label: 'Ladevorgang Byte Commander, Machern · Type2 · 11 kW · LP 1',
          detail: '21.08.2026, 10:00 · 2.436 kWh · Ref. sxx_17R7R5D3117_3x1Tx3e6n6p0',
          energyKwh: 2.436,
          pricePerKwh: 0.45,
          usageEur: 1.1,
        },
      ],
    };
    const rows = buildLineRows(session, 1.1);
    assert.equal(rows.length, 1);
    assert.match(rows[0].label, /Machern/);
    assert.ok(rows[0].sub, 'detail must be sub-line, not mashed into qty columns');
    assert.match(rows[0].qty, /2\.436/);
    assert.match(rows[0].unit, /0,45/);
    assert.match(rows[0].total, /1,10/);
  });

  it('measureInvoiceRowHeight grows with long wrapped labels instead of fixed short step', () => {
    const doc = makeDocStub();
    const short = measureInvoiceRowHeight(doc, {
      label: 'Startgebühr',
      sub: null,
    });
    const long = measureInvoiceRowHeight(doc, {
      label: 'Ladevorgang Byte Commander, Machern · Type2 · 11 kW · LP 1',
      sub: '21.08.2026, 10:15 · 2.436 kWh · Ref. sxx_17R7R5D3117_3x1Tx3e6n6p0_extra_long_id_tail',
    });
    assert.ok(short >= 18);
    assert.ok(long > short + 8, `long row (${long}) should be taller than short (${short})`);
  });

  it('buildInvoicePdf renders collective rows without throwing and returns PDF bytes', async () => {
    const pdf = await buildInvoicePdf({
      invoiceNumber: 'BC-2026-000042',
      customer: {
        firstName: 'Max',
        lastName: 'Mustermann',
        email: 'max@example.com',
        membershipId: 'BC-1001',
      },
      session: {
        isCollectiveInvoice: true,
        invoiceKind: 'collective',
        id: 'batch_test_1',
        stationName: 'Sammelrechnung',
        connectorType: 'Type2',
        powerKw: 0,
        energyKwh: 2.649,
        costEur: 1.2,
        amountChargedEur: 1.2,
        pricePerKwh: 0.45,
        paymentStatus: 'paid',
        startedAt: '2026-08-21T08:00:00.000Z',
        endedAt: '2026-08-21T10:00:00.000Z',
        batchSessionIds: ['s1', 's2', 's3'],
        stripePaymentIntentId: 'pi_test_layout',
        lineItems: [
          {
            label: 'Ladevorgang Byte Commander, Machern · Type2 · 11 kW · LP 1',
            detail:
              '21.08.2026, 08:10 · 2.436 kWh · Ref. sxx_17R7R5D3117_3x1Tx3e6n6p0',
            energyKwh: 2.436,
            pricePerKwh: 0.45,
            usageEur: 1.1,
          },
          {
            label: 'Ladevorgang Byte Commander, Machern · Type2 · 11 kW · LP 1',
            detail:
              '21.08.2026, 09:00 · 0.193 kWh · Ref. sxx_17R8R6A4D35_a4Rh71e6f53f',
            energyKwh: 0.193,
            pricePerKwh: 0.45,
            usageEur: 0.09,
          },
          {
            label: 'Ladevorgang Byte Commander, Machern · Type2 · 11 kW · LP 1',
            detail:
              '21.08.2026, 09:40 · 0.020 kWh · Ref. sxx_17R9R5D4116_311e6a4c1R',
            energyKwh: 0.02,
            pricePerKwh: 0.45,
            usageEur: 0.01,
          },
        ],
      },
    });
    assert.ok(Buffer.isBuffer(pdf));
    assert.ok(pdf.length > 1000);
    assert.equal(pdf.subarray(0, 4).toString('utf8'), '%PDF');
  });
});
