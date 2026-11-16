export type Currency = 'MXN' | 'USD';
export type ReceiptKind = 'payment' | 'quote' | 'cash_opening' | 'cash_close' | 'voucher';
export type ReceiptWidth = '58mm' | '80mm';
export type AdjustmentType = 'fixed_discount' | 'percentage_discount' | 'courtesy' | 'social_support' | 'other';

export interface Money {
  currency: Currency;
  amount: string;
}

export interface ReceiptDocument {
  version: 1;
  kind: ReceiptKind;
  documentId: string;
  reference?: string;
  issuedAt: string;
  header?: { lines: string[] };
  facility: {
    name: string;
    legalName?: string;
    taxId?: string;
    address?: string;
    phone?: string;
    logoReference?: string;
  };
  customer?: { displayName?: string; reference?: string };
  lines: Array<{
    code?: string;
    description: string;
    quantity: string;
    unitAmount: Money;
    total: Money;
  }>;
  subtotal: Money;
  adjustments: Array<{
    type: AdjustmentType;
    label: string;
    amount: Money;
    percentage?: string;
  }>;
  total: Money;
  payments: Array<{
    method: 'cash' | 'card' | 'transfer' | 'other';
    label?: string;
    amount: Money;
    exchangeRate?: string;
  }>;
  change?: Money;
  footer?: { lines: string[] };
  qrReference?: string;
}

export interface TicketTemplate {
  logoReference?: string;
  clinicName: string;
  legalName?: string;
  taxId?: string;
  address?: string;
  phone?: string;
  headerLines: string[];
  footerLines: string[];
  showPatient: boolean;
  showStudies: boolean;
  showDiscounts: boolean;
  showPaymentMethod: boolean;
  showChange: boolean;
  showQr: boolean;
  copies: number;
  width: ReceiptWidth;
}

export interface ReceiptPreview {
  width: ReceiptWidth;
  previewColumns: number;
  content: string;
}
