import { money } from './money.js';
import type { ReceiptDocument, TicketTemplate } from './types.js';

export const syntheticTemplate: TicketTemplate = {
  clinicName: 'Centro de Imagen Sintético',
  legalName: 'Entidad de Pruebas',
  taxId: 'XAXX010101000',
  address: 'Domicilio de prueba, México',
  phone: '000-000-0000',
  headerLines: ['COMPROBANTE NO FISCAL'],
  footerLines: ['Fixture sintético. Sin datos clínicos reales.'],
  showPatient: true,
  showStudies: true,
  showDiscounts: true,
  showPaymentMethod: true,
  showChange: true,
  showQr: true,
  copies: 1,
  width: '80mm',
};

export function syntheticReceipt(kind: ReceiptDocument['kind'] = 'payment'): ReceiptDocument {
  return {
    version: 1,
    kind,
    documentId: '20000000-0000-4000-8000-000000000001',
    reference: `SYN-${kind.toUpperCase()}`,
    issuedAt: '2026-01-01T00:00:00.000Z',
    facility: { name: syntheticTemplate.clinicName },
    customer: { displayName: 'Persona Sintética', reference: 'TEST-0001' },
    lines: [{ code: 'SYN-01', description: 'Servicio de imagen sintético', quantity: '1', unitAmount: money('MXN', '1200.00'), total: money('MXN', '1200.00') }],
    subtotal: money('MXN', '1200.00'),
    adjustments: [],
    total: money('MXN', '1200.00'),
    payments: kind === 'payment' ? [{ method: 'cash', label: 'Efectivo', amount: money('MXN', '1300.00') }] : [],
    ...(kind === 'payment' ? { change: money('MXN', '100.00') } : {}),
    qrReference: 'SYNTHETIC-REFERENCE-NOT-A-URL',
  };
}
