import {
  BRIDGE_PROTOCOL,
  validateBridgeRequest,
  type BridgeRequest,
  type DesktopCapabilities,
  type DrawerReasonCode,
  type DrawerResult,
  type DrawerState,
  type OpenDrawerRequest,
  type PrinterInfo,
  type PrinterState,
  type PrintJobRequest,
  type PrintJobResult,
  type PrintOptions,
} from '@apollo/bridge-contract';
import { DesktopBridgeError, type ApolloDesktopBridge } from '@apollo/bridge-client';
import { assertReceiptDocument, syntheticReceipt } from '@apollo/receipt-core';

export interface MockEvent {
  command: string;
  correlationId?: string;
  result: 'success' | 'failure';
  timestamp: string;
  errorCode?: string;
}

export interface MockDesktopAdapterOptions {
  printerState?: PrinterState;
  drawerState?: DrawerState;
  grantVerifier?: (request: OpenDrawerRequest) => boolean | Promise<boolean>;
  now?: () => Date;
  idFactory?: () => string;
}

const PRINTER_ERRORS: Partial<Record<PrinterState, { code: 'PRINTER_UNAVAILABLE' | 'PRINTER_OFFLINE' | 'PRINTER_OUT_OF_PAPER' | 'PRINTER_COVER_OPEN' | 'PRINTER_BUSY' | 'PRINT_FAILED'; message: string }>> = {
  unavailable: { code: 'PRINTER_UNAVAILABLE', message: 'Mock printer is unavailable.' },
  offline: { code: 'PRINTER_OFFLINE', message: 'Mock printer is offline.' },
  out_of_paper: { code: 'PRINTER_OUT_OF_PAPER', message: 'Mock printer is out of paper.' },
  cover_open: { code: 'PRINTER_COVER_OPEN', message: 'Mock printer cover is open.' },
  busy: { code: 'PRINTER_BUSY', message: 'Mock printer is busy.' },
  error: { code: 'PRINT_FAILED', message: 'Mock printer reported an error.' },
};

export class MockDesktopAdapter implements ApolloDesktopBridge {
  private printerState: PrinterState;
  private drawerState: DrawerState;
  private readonly now: () => Date;
  private readonly idFactory: () => string;
  private readonly grantVerifier: NonNullable<MockDesktopAdapterOptions['grantVerifier']>;
  private readonly printResults = new Map<string, PrintJobResult>();
  private readonly drawerResults = new Map<string, DrawerResult>();
  readonly events: MockEvent[] = [];

  constructor(options: MockDesktopAdapterOptions = {}) {
    this.printerState = options.printerState ?? 'ready';
    this.drawerState = options.drawerState ?? 'unavailable';
    this.now = options.now ?? (() => new Date());
    this.idFactory = options.idFactory ?? (() => crypto.randomUUID());
    this.grantVerifier = options.grantVerifier ?? (() => false);
  }

  setPrinterState(state: PrinterState): void { this.printerState = state; }
  setDrawerState(state: DrawerState): void { this.drawerState = state; }
  getPrinterState(): PrinterState { return this.printerState; }
  getDrawerStateValue(): DrawerState { return this.drawerState; }

  private record(command: string, result: 'success' | 'failure', correlationId?: string, errorCode?: string): void {
    this.events.push({ command, result, timestamp: this.now().toISOString(), ...(correlationId ? { correlationId } : {}), ...(errorCode ? { errorCode } : {}) });
  }

  private ensurePrinterReady(correlationId: string): void {
    const error = PRINTER_ERRORS[this.printerState];
    if (error) {
      this.record('printer.printJob', 'failure', correlationId, error.code);
      throw new DesktopBridgeError(error.code, error.message);
    }
  }

  getVersion() { return Promise.resolve({ bridgeVersion: 1 as const, protocol: BRIDGE_PROTOCOL }); }
  getCapabilities(): Promise<DesktopCapabilities> {
    return Promise.resolve({ bridgeVersion: 1, platform: 'mock-linux', capabilities: {
      printing: this.printerState !== 'unavailable',
      cashDrawer: !['unavailable', 'unknown'].includes(this.drawerState),
      printerStatus: true,
      deviceSettings: true,
    } });
  }
  ping(nonce = '') { return Promise.resolve({ pong: nonce, timestamp: this.now().toISOString() }); }
  listPrinters(): Promise<PrinterInfo[]> { return Promise.resolve(this.printerState === 'unavailable' ? [] : [{ id: 'mock-printer-1', name: 'Synthetic Thermal Printer', isDefault: true, supportedWidths: ['58mm', '80mm'] }]); }
  getPrinterStatus(printerId = 'mock-printer-1') { return Promise.resolve({ printerId, state: this.printerState, message: `Synthetic printer state: ${this.printerState}` }); }
  printTest(options: PrintOptions = {}) {
    return this.printJob({ printJobId: this.idFactory(), document: syntheticReceipt('voucher'), options });
  }
  async printJob(request: PrintJobRequest): Promise<PrintJobResult> {
    const validated = (validateBridgeRequest({ version: 1, requestId: crypto.randomUUID(), command: 'printer.printJob', payload: request }) as BridgeRequest<'printer.printJob'>).payload;
    const prior = this.printResults.get(validated.printJobId);
    if (prior) { this.record('printer.printJob', 'success', validated.printJobId); return prior; }
    assertReceiptDocument(validated.document);
    this.ensurePrinterReady(validated.printJobId);
    const acceptedAt = this.now().toISOString();
    const result: PrintJobResult = { printJobId: validated.printJobId, status: 'completed', acceptedAt, completedAt: this.now().toISOString() };
    this.printResults.set(validated.printJobId, result);
    this.record('printer.printJob', 'success', validated.printJobId);
    return result;
  }
  getDrawerStatus() { return Promise.resolve({ state: this.drawerState, message: `Synthetic drawer state: ${this.drawerState}` }); }
  async openDrawer(request: OpenDrawerRequest): Promise<DrawerResult> {
    const validated = (validateBridgeRequest({ version: 1, requestId: crypto.randomUUID(), command: 'drawer.open', payload: request }) as BridgeRequest<'drawer.open'>).payload;
    const prior = this.drawerResults.get(validated.actionId);
    if (prior) { this.record('drawer.open', 'success', validated.actionId); return prior; }
    if (['unavailable', 'unknown'].includes(this.drawerState)) {
      this.record('drawer.open', 'failure', validated.actionId, 'DRAWER_UNAVAILABLE');
      throw new DesktopBridgeError('DRAWER_UNAVAILABLE', 'Mock cash drawer is unavailable.');
    }
    if (!await this.grantVerifier(validated)) {
      this.record('drawer.open', 'failure', validated.actionId, 'DRAWER_UNAUTHORIZED');
      throw new DesktopBridgeError('DRAWER_UNAUTHORIZED', 'Mock authorization grant was rejected.');
    }
    this.drawerState = 'open';
    const result = { actionId: validated.actionId, status: 'opened' as const, reasonCode: validated.reasonCode, performedAt: this.now().toISOString() };
    this.drawerResults.set(validated.actionId, result);
    this.record('drawer.open', 'success', validated.actionId);
    return result;
  }
  getDeviceProfile() { return Promise.resolve({ deviceId: 'mock-linux-1', displayName: 'Apollo Linux Hardware Simulator', platform: 'mock-linux' as const, settingsWritable: true }); }
}

export function allowSyntheticGrant(expectedGrant: string, allowedReasons?: DrawerReasonCode[]) {
  return (request: OpenDrawerRequest): boolean => request.authorizationGrant === expectedGrant
    && (!allowedReasons || allowedReasons.includes(request.reasonCode));
}
