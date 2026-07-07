import { describe, expect, it } from 'vitest';
import { formatMoney, money } from './money.js';
import { renderReceiptHtml, renderReceiptText } from './render.js';
import { syntheticReceipt, syntheticTemplate } from './fixtures.js';
import type { AdjustmentType, ReceiptDocument } from './types.js';
import { validateReceiptDocument } from './validation.js';

describe('receipt core', () => {
  it.each(['payment', 'quote', 'cash_opening', 'cash_close', 'voucher'] as const)('validates %s documents', (kind) => {
    expect(validateReceiptDocument(syntheticReceipt(kind))).toEqual({ valid: true });
  });

  it.each([
    ['fixed_discount', 'Descuento fijo'], ['percentage_discount', 'Descuento 10%'], ['courtesy', 'Cortesía'], ['social_support', 'Apoyo social'],
  ] as const)('renders %s adjustments', (type, label) => {
    const document: ReceiptDocument = { ...syntheticReceipt('payment'), adjustments: [{ type: type as AdjustmentType, label, amount: money('MXN', '100.00'), ...(type === 'percentage_discount' ? { percentage: '10.00' } : {}) }], total: money('MXN', '1100.00') };
    expect(renderReceiptText(document, syntheticTemplate).content).toContain(label);
  });

  it('renders change', () => {
    expect(renderReceiptText(syntheticReceipt(), syntheticTemplate).content).toContain('Cambio');
  });

  it('formats MXN and USD without floating-point arithmetic', () => {
    expect(formatMoney(money('MXN', '1200.00'))).toBe('$1,200.00 MXN');
    expect(formatMoney(money('USD', '42.05'))).toBe('$42.05 USD');
    expect(() => money('MXN', '1200.0000001')).toThrow();
  });

  it('produces distinct 58 mm and 80 mm conceptual previews', () => {
    const narrow = renderReceiptText(syntheticReceipt(), { ...syntheticTemplate, width: '58mm' });
    const wide = renderReceiptText(syntheticReceipt(), { ...syntheticTemplate, width: '80mm' });
    expect(narrow.previewColumns).toBe(32);
    expect(wide.previewColumns).toBe(48);
    expect(narrow.content).not.toBe(wide.content);
  });

  it('escapes all receipt content in HTML preview', () => {
    const document = syntheticReceipt();
    document.lines[0]!.description = '<img src=x onerror=alert(1)>';
    const html = renderReceiptHtml(document, syntheticTemplate);
    expect(html).toContain('&lt;img');
    expect(html).not.toContain('<img');
  });
});
