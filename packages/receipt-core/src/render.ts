import { formatMoney } from './money.js';
import type { ReceiptDocument, ReceiptPreview, ReceiptWidth, TicketTemplate } from './types.js';
import { assertReceiptDocument } from './validation.js';

const PROFILE: Record<ReceiptWidth, { previewColumns: number; cssWidth: string }> = {
  '58mm': { previewColumns: 32, cssWidth: '58mm' },
  '80mm': { previewColumns: 48, cssWidth: '80mm' },
};

function wrap(value: string, width: number): string[] {
  const words = value.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    if (word.length > width) {
      if (current) lines.push(current);
      for (let offset = 0; offset < word.length; offset += width) lines.push(word.slice(offset, offset + width));
      current = '';
    } else if (!current) current = word;
    else if (`${current} ${word}`.length <= width) current += ` ${word}`;
    else { lines.push(current); current = word; }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [''];
}

function columns(left: string, right: string, width: number): string[] {
  const rightWidth = Math.min(right.length, Math.floor(width * 0.48));
  const leftWidth = width - rightWidth - 1;
  const leftLines = wrap(left, leftWidth);
  return leftLines.map((line, index) => index === leftLines.length - 1
    ? `${line}${' '.repeat(Math.max(1, width - line.length - right.length))}${right}`
    : line);
}

export function renderReceiptText(document: ReceiptDocument, template: TicketTemplate): ReceiptPreview {
  assertReceiptDocument(document);
  const profile = PROFILE[template.width];
  const width = profile.previewColumns;
  const output: string[] = [];
  const pushCentered = (value: string) => wrap(value, width).forEach((line) => output.push(line.padStart(line.length + Math.floor((width - line.length) / 2))));
  pushCentered(template.clinicName);
  if (template.legalName) pushCentered(template.legalName);
  if (template.taxId) pushCentered(`RFC ${template.taxId}`);
  if (template.address) wrap(template.address, width).forEach((line) => output.push(line));
  if (template.phone) output.push(template.phone);
  template.headerLines.forEach((line) => wrap(line, width).forEach((part) => output.push(part)));
  output.push('-'.repeat(width));
  output.push(document.kind.replace('_', ' ').toUpperCase());
  if (document.reference) output.push(`Ref: ${document.reference}`);
  output.push(new Date(document.issuedAt).toISOString());
  if (template.showPatient && document.customer?.displayName) output.push(...wrap(`Paciente: ${document.customer.displayName}`, width));
  if (template.showStudies) {
    document.lines.forEach((line) => output.push(...columns(`${line.quantity} x ${line.description}`, formatMoney(line.total), width)));
  }
  output.push('-'.repeat(width));
  output.push(...columns('Subtotal', formatMoney(document.subtotal), width));
  if (template.showDiscounts) document.adjustments.forEach((item) => output.push(...columns(`-${item.label}`, formatMoney(item.amount), width)));
  output.push(...columns('TOTAL', formatMoney(document.total), width));
  if (template.showPaymentMethod) document.payments.forEach((item) => output.push(...columns(item.label ?? item.method, formatMoney(item.amount), width)));
  if (template.showChange && document.change) output.push(...columns('Cambio', formatMoney(document.change), width));
  if (template.showQr && document.qrReference) output.push(...wrap(`Referencia QR: ${document.qrReference}`, width));
  output.push('-'.repeat(width));
  template.footerLines.forEach((line) => wrap(line, width).forEach((part) => output.push(part)));
  return { width: template.width, previewColumns: width, content: output.join('\n') };
}

const escapeHtml = (value: string) => value
  .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;').replaceAll("'", '&#039;');

export function renderReceiptHtml(document: ReceiptDocument, template: TicketTemplate): string {
  const preview = renderReceiptText(document, template);
  const cssWidth = PROFILE[template.width].cssWidth;
  return `<article class="apollo-receipt" data-width="${template.width}" style="box-sizing:border-box;width:${cssWidth};max-width:100%;padding:4mm;background:#fff;color:#111;font:12px/1.35 ui-monospace,monospace"><pre style="margin:0;white-space:pre-wrap;overflow-wrap:anywhere">${escapeHtml(preview.content)}</pre></article>`;
}
