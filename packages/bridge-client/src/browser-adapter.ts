import { BRIDGE_PROTOCOL, validateBridgeRequest, type BridgeRequest, type DesktopCapabilities, type OpenDrawerRequest, type PrintJobRequest, type PrintJobResult } from '@apollo/bridge-contract';
import { assertReceiptDocument } from '@apollo/receipt-core';
import { UnsupportedCapabilityError } from './errors.js';
import type { ApolloDesktopBridge } from './interface.js';

export interface BrowserAdapterOptions {
  printFallback?: (request: PrintJobRequest) => Promise<void> | void;
  now?: () => Date;
}

export class BrowserAdapter implements ApolloDesktopBridge {
  private readonly now: () => Date;

  constructor(private readonly options: BrowserAdapterOptions = {}) {
    this.now = options.now ?? (() => new Date());
  }

  getVersion() { return Promise.resolve({ bridgeVersion: 1 as const, protocol: BRIDGE_PROTOCOL }); }
  getCapabilities(): Promise<DesktopCapabilities> {
    return Promise.resolve({
      bridgeVersion: 1,
      platform: 'browser',
      capabilities: { printing: Boolean(this.options.printFallback), cashDrawer: false, printerStatus: false, deviceSettings: false },
    });
  }
  ping(nonce = '') { return Promise.resolve({ pong: nonce, timestamp: this.now().toISOString() }); }
  listPrinters() { return Promise.resolve([]); }
  getPrinterStatus(): Promise<never> { return Promise.reject(new UnsupportedCapabilityError('printerStatus')); }
  printTest(): Promise<never> { return Promise.reject(new UnsupportedCapabilityError('native test printing')); }
  async printJob(request: PrintJobRequest): Promise<PrintJobResult> {
    if (!this.options.printFallback) throw new UnsupportedCapabilityError('printing');
    const validated = validateBridgeRequest({ version: 1, requestId: crypto.randomUUID(), command: 'printer.printJob', payload: request }) as BridgeRequest<'printer.printJob'>;
    assertReceiptDocument(validated.payload.document);
    const acceptedAt = this.now().toISOString();
    await this.options.printFallback(validated.payload);
    return { printJobId: validated.payload.printJobId, status: 'completed', acceptedAt, completedAt: this.now().toISOString() };
  }
  getDrawerStatus() { return Promise.resolve({ state: 'unavailable' as const, message: 'Cash drawer control is unavailable in a browser.' }); }
  openDrawer(_request: OpenDrawerRequest): Promise<never> { return Promise.reject(new UnsupportedCapabilityError('cashDrawer')); }
  getDeviceProfile() { return Promise.resolve({ deviceId: 'browser', displayName: 'Web browser', platform: 'browser' as const, settingsWritable: false }); }
}

export function windowPrintFallback(): (request: PrintJobRequest) => void {
  return () => {
    if (typeof window === 'undefined' || typeof window.print !== 'function') throw new UnsupportedCapabilityError('window.print');
    window.print();
  };
}
