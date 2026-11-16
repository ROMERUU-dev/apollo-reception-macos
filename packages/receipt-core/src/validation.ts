import { assertDecimal, moneyToMinorUnits } from './money.js';
import type { ReceiptDocument } from './types.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const KINDS = new Set(['payment', 'quote', 'cash_opening', 'cash_close', 'voucher']);
const ADJUSTMENTS = new Set(['fixed_discount', 'percentage_discount', 'courtesy', 'social_support', 'other']);
const METHODS = new Set(['cash', 'card', 'transfer', 'other']);

function requireText(value: unknown, name: string, max: number): asserts value is string {
  if (typeof value !== 'string' || value.length === 0 || value.length > max) throw new TypeError(`${name} must be a non-empty string up to ${max} characters.`);
}

export function assertReceiptDocument(value: unknown): asserts value is ReceiptDocument {
  if (!value || typeof value !== 'object') throw new TypeError('Receipt document must be an object.');
  const document = value as ReceiptDocument;
  if (document.version !== 1) throw new TypeError('Receipt document version must be 1.');
  if (!KINDS.has(document.kind)) throw new TypeError('Unsupported receipt kind.');
  if (!UUID.test(document.documentId)) throw new TypeError('documentId must be a UUID.');
  if (Number.isNaN(Date.parse(document.issuedAt))) throw new TypeError('issuedAt must be an ISO date-time.');
  requireText(document.facility?.name, 'facility.name', 160);
  if (!Array.isArray(document.lines) || document.lines.length > 100) throw new TypeError('lines must contain at most 100 entries.');
  for (const [index, line] of document.lines.entries()) {
    requireText(line.description, `lines[${index}].description`, 240);
    assertDecimal(line.quantity);
    moneyToMinorUnits(line.unitAmount);
    moneyToMinorUnits(line.total);
  }
  moneyToMinorUnits(document.subtotal);
  moneyToMinorUnits(document.total);
  if (!Array.isArray(document.adjustments) || document.adjustments.length > 50) throw new TypeError('adjustments must contain at most 50 entries.');
  for (const adjustment of document.adjustments) {
    if (!ADJUSTMENTS.has(adjustment.type)) throw new TypeError('Unsupported adjustment type.');
    requireText(adjustment.label, 'adjustment.label', 120);
    moneyToMinorUnits(adjustment.amount);
    if (adjustment.percentage !== undefined) assertDecimal(adjustment.percentage);
  }
  if (!Array.isArray(document.payments) || document.payments.length > 20) throw new TypeError('payments must contain at most 20 entries.');
  for (const payment of document.payments) {
    if (!METHODS.has(payment.method)) throw new TypeError('Unsupported payment method.');
    moneyToMinorUnits(payment.amount);
    if (payment.exchangeRate !== undefined) assertDecimal(payment.exchangeRate);
  }
  if (document.change) moneyToMinorUnits(document.change);
}

export function validateReceiptDocument(value: unknown): { valid: true } | { valid: false; errors: string[] } {
  try {
    assertReceiptDocument(value);
    return { valid: true };
  } catch (error) {
    return { valid: false, errors: [error instanceof Error ? error.message : 'Invalid receipt document.'] };
  }
}
