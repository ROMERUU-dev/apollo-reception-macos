import {
  BRIDGE_PROTOCOL,
  ContractValidationError,
  validateBridgeRequest,
  validateBridgeResponse,
  validateCommandResult,
  type BridgeCommand,
  type BridgePayloadMap,
  type BridgeRequest,
  type BridgeResultMap,
} from '@apollo/bridge-contract';
import { BridgeRemoteError, DesktopBridgeError } from './errors.js';
import type { ApolloDesktopBridge } from './interface.js';

export interface BridgeTransport {
  send(request: BridgeRequest, signal: AbortSignal): Promise<unknown>;
}

export interface BridgeClientOptions {
  timeoutMs?: number;
  requestIdFactory?: () => string;
  signal?: AbortSignal;
}

export class JsonBridgeClient implements ApolloDesktopBridge {
  private readonly timeoutMs: number;
  private readonly requestIdFactory: () => string;

  constructor(private readonly transport: BridgeTransport, private readonly options: BridgeClientOptions = {}) {
    this.timeoutMs = options.timeoutMs ?? 5_000;
    this.requestIdFactory = options.requestIdFactory ?? (() => crypto.randomUUID());
  }

  private async call<C extends BridgeCommand>(command: C, payload: BridgePayloadMap[C]): Promise<BridgeResultMap[C]> {
    const request = validateBridgeRequest({ version: 1, requestId: this.requestIdFactory(), command, payload }) as BridgeRequest<C>;
    const controller = new AbortController();
    const abortPromise = new Promise<never>((_, reject) => controller.signal.addEventListener('abort', () => {
      const code = this.options.signal?.aborted ? 'CANCELLED' : 'TIMEOUT';
      reject(new DesktopBridgeError(code, code === 'TIMEOUT' ? `Bridge request timed out after ${this.timeoutMs} ms.` : 'Bridge request was cancelled.'));
    }, { once: true }));
    const timeout = setTimeout(() => controller.abort(new Error('timeout')), this.timeoutMs);
    const abort = () => controller.abort(this.options.signal?.reason ?? new Error('cancelled'));
    this.options.signal?.addEventListener('abort', abort, { once: true });
    if (this.options.signal?.aborted) abort();
    try {
      const responseValue = await Promise.race([
        this.transport.send(request, controller.signal),
        abortPromise,
      ]);
      const response = validateBridgeResponse(responseValue);
      if (response.requestId !== request.requestId) throw new DesktopBridgeError('INVALID_REQUEST', 'Bridge response requestId does not match the request.');
      if (!response.ok) throw new BridgeRemoteError(response.error);
      return validateCommandResult(command, response.result);
    } catch (error) {
      if (error instanceof DesktopBridgeError) throw error;
      if (error instanceof ContractValidationError) throw new DesktopBridgeError(error.code, error.message, error.details);
      throw new DesktopBridgeError('INTERNAL_ERROR', error instanceof Error ? error.message : 'Bridge transport failed.');
    } finally {
      clearTimeout(timeout);
      this.options.signal?.removeEventListener('abort', abort);
    }
  }

  getVersion() { return this.call('bridge.getVersion', {}); }
  getCapabilities() { return this.call('bridge.getCapabilities', {}); }
  ping(nonce?: string) { return this.call('bridge.ping', nonce === undefined ? {} : { nonce }); }
  listPrinters() { return this.call('printer.list', {}); }
  getPrinterStatus(printerId?: string) { return this.call('printer.status', printerId === undefined ? {} : { printerId }); }
  printTest(options = {}) { return this.call('printer.printTest', options); }
  printJob(request: BridgePayloadMap['printer.printJob']) { return this.call('printer.printJob', request); }
  getDrawerStatus() { return this.call('drawer.status', {}); }
  openDrawer(request: BridgePayloadMap['drawer.open']) { return this.call('drawer.open', request); }
  getDeviceProfile() { return this.call('device.getProfile', {}); }
}

export { BRIDGE_PROTOCOL };
