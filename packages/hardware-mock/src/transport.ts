import {
  ContractValidationError,
  errorResponse,
  successResponse,
  validateBridgeRequest,
  type BridgeRequest,
} from '@apollo/bridge-contract';
import { DesktopBridgeError, type BridgeTransport } from '@apollo/bridge-client';
import type { MockDesktopAdapter } from './mock-adapter.js';

const FALLBACK_REQUEST_ID = '00000000-0000-4000-8000-000000000000';

export class MockBridgeTransport implements BridgeTransport {
  constructor(private readonly adapter: MockDesktopAdapter, private readonly latencyMs = 0) {}

  async send(rawRequest: BridgeRequest, signal: AbortSignal): Promise<unknown> {
    const candidate = rawRequest as unknown as Record<string, unknown>;
    const requestId = typeof candidate?.requestId === 'string' ? candidate.requestId : FALLBACK_REQUEST_ID;
    try {
      const request = validateBridgeRequest(rawRequest);
      if (this.latencyMs) await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(resolve, this.latencyMs);
        signal.addEventListener('abort', () => { clearTimeout(timer); reject(signal.reason); }, { once: true });
      });
      let result: unknown;
      switch (request.command) {
        case 'bridge.getVersion': result = await this.adapter.getVersion(); break;
        case 'bridge.getCapabilities': result = await this.adapter.getCapabilities(); break;
        case 'bridge.ping': result = await this.adapter.ping(request.payload.nonce); break;
        case 'printer.list': result = await this.adapter.listPrinters(); break;
        case 'printer.status': result = await this.adapter.getPrinterStatus(request.payload.printerId); break;
        case 'printer.printTest': result = await this.adapter.printTest(request.payload); break;
        case 'printer.printJob': result = await this.adapter.printJob(request.payload); break;
        case 'drawer.status': result = await this.adapter.getDrawerStatus(); break;
        case 'drawer.open': result = await this.adapter.openDrawer(request.payload); break;
        case 'device.getProfile': result = await this.adapter.getDeviceProfile(); break;
      }
      return successResponse(request.requestId, result);
    } catch (error) {
      if (error instanceof ContractValidationError || error instanceof DesktopBridgeError) {
        return errorResponse(requestId, { code: error.code, message: error.message, ...(error.details ? { details: error.details } : {}) });
      }
      return errorResponse(requestId, { code: 'INTERNAL_ERROR', message: error instanceof Error ? error.message : 'Mock transport failed.' });
    }
  }
}
