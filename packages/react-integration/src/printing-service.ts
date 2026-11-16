import type { PrintJobResult, PrintOptions } from '@apollo/bridge-contract';
import type { ApolloDesktopBridge } from '@apollo/bridge-client';
import { assertReceiptDocument, type ReceiptDocument } from '@apollo/receipt-core';

export interface ReceiptPrintingServiceOptions {
  idFactory?: () => string;
}

export class ReceiptPrintingService {
  private readonly idFactory: () => string;

  constructor(private readonly bridge: ApolloDesktopBridge, options: ReceiptPrintingServiceOptions = {}) {
    this.idFactory = options.idFactory ?? (() => crypto.randomUUID());
  }

  private async print(document: ReceiptDocument, allowedKinds: ReceiptDocument['kind'][], options: PrintOptions = {}): Promise<PrintJobResult> {
    assertReceiptDocument(document);
    if (!allowedKinds.includes(document.kind)) throw new TypeError(`Receipt kind ${document.kind} is not valid for this print operation.`);
    const capabilities = await this.bridge.getCapabilities();
    if (!capabilities.capabilities.printing) throw new Error(`Printing is unavailable on ${capabilities.platform}.`);
    return this.bridge.printJob({ printJobId: this.idFactory(), document, options });
  }

  printReceipt(document: ReceiptDocument, options?: PrintOptions) { return this.print(document, ['payment', 'voucher'], options); }
  printQuote(document: ReceiptDocument, options?: PrintOptions) { return this.print(document, ['quote'], options); }
  printCashOpening(document: ReceiptDocument, options?: PrintOptions) { return this.print(document, ['cash_opening'], options); }
  printCashClose(document: ReceiptDocument, options?: PrintOptions) { return this.print(document, ['cash_close'], options); }
}
