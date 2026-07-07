import { describe, expect, it } from 'vitest';
import { JsonBridgeClient, UnsupportedCapabilityError, type BridgeTransport } from '@apollo/bridge-client';
import { MockBridgeTransport, MockDesktopAdapter } from '@apollo/hardware-mock';
import { ContractValidationError, errorResponse, validateBridgeRequest, type BridgeRequest, type BridgeResponse } from './index.js';

const REQUEST_ID = '10000000-0000-4000-8000-000000000001';
const signal = new AbortController().signal;

describe('bridge contract v1', () => {
  it('accepts a valid allowlisted request', () => {
    expect(validateBridgeRequest({ version: 1, requestId: REQUEST_ID, command: 'bridge.ping', payload: { nonce: 'ok' } }).command).toBe('bridge.ping');
  });

  it('rejects an invalid version deterministically', () => {
    expect(() => validateBridgeRequest({ version: 2, requestId: REQUEST_ID, command: 'bridge.ping', payload: {} }))
      .toThrowError(expect.objectContaining({ code: 'UNSUPPORTED_VERSION' }));
  });

  it('rejects unknown and arbitrary commands', () => {
    for (const command of ['shell.execute', 'printer.rawBytes', 'usb.raw']) {
      expect(() => validateBridgeRequest({ version: 1, requestId: REQUEST_ID, command, payload: {} }))
        .toThrowError(expect.objectContaining({ code: 'UNKNOWN_COMMAND' }));
    }
  });

  it('rejects malformed payloads and extra properties', () => {
    expect(() => validateBridgeRequest({ version: 1, requestId: REQUEST_ID, command: 'drawer.open', payload: { reasonCode: 'cash_payment', extra: true } }))
      .toThrowError(expect.objectContaining({ code: 'INVALID_REQUEST' }));
  });

  it('preserves requestId in an invalid-request response', async () => {
    const transport = new MockBridgeTransport(new MockDesktopAdapter());
    const response = await transport.send({ version: 1, requestId: REQUEST_ID, command: 'drawer.open', payload: {} } as unknown as BridgeRequest, signal) as BridgeResponse;
    expect(response.requestId).toBe(REQUEST_ID);
    expect(response.ok).toBe(false);
  });

  it('rejects oversized payloads before dispatch', () => {
    expect(() => validateBridgeRequest({ version: 1, requestId: REQUEST_ID, command: 'bridge.ping', payload: { nonce: 'x'.repeat(300_000) } }))
      .toThrowError(expect.objectContaining({ code: 'PAYLOAD_TOO_LARGE' }));
  });

  it('times out a transport that never replies', async () => {
    const transport: BridgeTransport = { send: () => new Promise(() => undefined) };
    const client = new JsonBridgeClient(transport, { timeoutMs: 5, requestIdFactory: () => REQUEST_ID });
    await expect(client.ping()).rejects.toMatchObject({ code: 'TIMEOUT' });
  });

  it('honors caller cancellation', async () => {
    const controller = new AbortController();
    const transport: BridgeTransport = { send: () => new Promise(() => undefined) };
    const client = new JsonBridgeClient(transport, { timeoutMs: 1_000, requestIdFactory: () => REQUEST_ID, signal: controller.signal });
    const pending = client.ping();
    controller.abort();
    await expect(pending).rejects.toMatchObject({ code: 'CANCELLED' });
  });

  it('surfaces a validated remote error response', async () => {
    const transport: BridgeTransport = { send: async (request) => errorResponse(request.requestId, { code: 'PRINTER_OFFLINE', message: 'offline' }) };
    const client = new JsonBridgeClient(transport, { requestIdFactory: () => REQUEST_ID });
    await expect(client.getPrinterStatus()).rejects.toMatchObject({ code: 'PRINTER_OFFLINE' });
  });

  it('rejects mismatched response correlation', async () => {
    const transport: BridgeTransport = { send: async () => ({ version: 1, requestId: '10000000-0000-4000-8000-000000000099', ok: true, result: { pong: '', timestamp: '2026-01-01T00:00:00.000Z' } }) };
    const client = new JsonBridgeClient(transport, { requestIdFactory: () => REQUEST_ID });
    await expect(client.ping()).rejects.toMatchObject({ code: 'INVALID_REQUEST' });
  });

  it('exposes contract errors with deterministic codes', () => {
    try { validateBridgeRequest(null); } catch (error) { expect(error).toBeInstanceOf(ContractValidationError); }
  });
});

describe('browser adapter', () => {
  it('reports browser capabilities without pretending drawer support', async () => {
    const { BrowserAdapter } = await import('@apollo/bridge-client');
    const browser = new BrowserAdapter();
    expect((await browser.getCapabilities()).capabilities).toEqual({ printing: false, cashDrawer: false, printerStatus: false, deviceSettings: false });
    expect((await browser.getDrawerStatus()).state).toBe('unavailable');
    await expect(browser.openDrawer({ actionId: REQUEST_ID, authorizationGrant: 'long-enough-invalid', reasonCode: 'cash_payment' })).rejects.toBeInstanceOf(UnsupportedCapabilityError);
  });
});
