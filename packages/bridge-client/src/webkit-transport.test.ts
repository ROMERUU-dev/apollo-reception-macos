import { describe, expect, it } from 'vitest';
import {
  BRIDGE_PROTOCOL,
  errorResponse,
  successResponse,
  type BridgeRequest,
  type DesktopCapabilities,
} from '@apollo/bridge-contract';
import { JsonBridgeClient } from './client.js';
import { DesktopBridgeError } from './errors.js';
import type { ApolloDesktopBridge } from './interface.js';
import {
  APOLLO_BRIDGE_HANDLER,
  APOLLO_BRIDGE_RESPONSE_GLOBAL,
  WebKitBridgeTransport,
  createMacDesktopBridge,
  detectWebKitBridge,
  getBridgeMessageHandler,
  handshakeMacDesktopBridge,
} from './webkit-transport.js';

const MAC_CAPABILITIES: DesktopCapabilities = {
  bridgeVersion: 1,
  platform: 'macos',
  capabilities: { printing: true, cashDrawer: true, printerStatus: true, deviceSettings: true },
};

type Responder = (request: BridgeRequest) => unknown;

/** A WKWebView stand-in: posts route to `responder`, whose reply is delivered back async. */
function nativeShell(responder: Responder) {
  const host: Record<string, unknown> & {
    webkit?: { messageHandlers?: Record<string, { postMessage(message: unknown): void }> };
  } = {};
  host.webkit = {
    messageHandlers: {
      [APOLLO_BRIDGE_HANDLER]: {
        postMessage(message: unknown) {
          const reply = responder(message as BridgeRequest);
          if (reply === undefined) return;
          queueMicrotask(() => {
            const sink = host[APOLLO_BRIDGE_RESPONSE_GLOBAL] as { deliver(r: unknown): void } | undefined;
            sink?.deliver(reply);
          });
        },
      },
    },
  };
  return host;
}

function defaultResponder(request: BridgeRequest): unknown {
  switch (request.command) {
    case 'bridge.getVersion':
      return successResponse(request.requestId, { bridgeVersion: 1, protocol: BRIDGE_PROTOCOL });
    case 'bridge.getCapabilities':
      return successResponse(request.requestId, MAC_CAPABILITIES);
    case 'bridge.ping':
      return successResponse(request.requestId, { pong: request.payload.nonce ?? '', timestamp: '2026-01-01T00:00:00.000Z' });
    case 'drawer.open':
      return errorResponse(request.requestId, { code: 'DRAWER_UNAUTHORIZED', message: 'Grant rejected by native shell.' });
    default:
      return errorResponse(request.requestId, { code: 'INTERNAL_ERROR', message: 'Unhandled in test shell.' });
  }
}

describe('apolloBridge WKWebView channel', () => {
  it('round-trips a correlated success through the client', async () => {
    const client: ApolloDesktopBridge = createMacDesktopBridge({ host: nativeShell(defaultResponder) });
    expect(await client.ping('hello')).toEqual({ pong: 'hello', timestamp: '2026-01-01T00:00:00.000Z' });
  });

  it('surfaces a native error envelope with its deterministic code', async () => {
    const client = createMacDesktopBridge({ host: nativeShell(defaultResponder) });
    await expect(client.openDrawer({ actionId: '40000000-0000-4000-8000-000000000001', authorizationGrant: 'long-enough-invalid-grant', reasonCode: 'cash_payment' }))
      .rejects.toMatchObject({ code: 'DRAWER_UNAUTHORIZED' });
  });

  it('detects the native handler only when postMessage is present', () => {
    expect(detectWebKitBridge(nativeShell(defaultResponder))).toBe(true);
    expect(detectWebKitBridge({})).toBe(false);
    expect(detectWebKitBridge({ webkit: { messageHandlers: {} } })).toBe(false);
    expect(getBridgeMessageHandler({})).toBeUndefined();
  });

  it('reports UNSUPPORTED_CAPABILITY when no native handler is installed', async () => {
    const client = createMacDesktopBridge({ host: {} });
    await expect(client.getVersion()).rejects.toMatchObject({ code: 'UNSUPPORTED_CAPABILITY' });
  });

  it('drops an uncorrelated reply and lets the request time out without leaking', async () => {
    // Native replies with a valid envelope but a requestId that matches no in-flight call.
    const host = nativeShell(() => successResponse('10000000-0000-4000-8000-000000000099', { pong: '', timestamp: '2026-01-01T00:00:00.000Z' }));
    const transport = new WebKitBridgeTransport({ host });
    const client = new JsonBridgeClient(transport, { timeoutMs: 20 });
    await expect(client.ping()).rejects.toMatchObject({ code: 'TIMEOUT' });
    expect(transport.inFlight).toBe(0);
  });

  it('honors caller cancellation and clears the in-flight entry', async () => {
    const controller = new AbortController();
    const transport = new WebKitBridgeTransport({ host: nativeShell(() => undefined) });
    const client = new JsonBridgeClient(transport, { timeoutMs: 1_000, signal: controller.signal });
    const pending = client.ping();
    controller.abort();
    await expect(pending).rejects.toMatchObject({ code: 'CANCELLED' });
    expect(transport.inFlight).toBe(0);
  });

  it('rejects a duplicate in-flight requestId', async () => {
    const transport = new WebKitBridgeTransport({ host: nativeShell(() => undefined) });
    const request = { version: 1, requestId: '10000000-0000-4000-8000-000000000001', command: 'bridge.ping', payload: {} } as BridgeRequest;
    const first = transport.send(request, new AbortController().signal);
    await expect(transport.send(request, new AbortController().signal)).rejects.toMatchObject({ code: 'INVALID_REQUEST' });
    void first.catch(() => undefined);
  });

  it('validates the handshake and returns native capabilities', async () => {
    const bridge = createMacDesktopBridge({ host: nativeShell(defaultResponder) });
    expect(await handshakeMacDesktopBridge(bridge)).toEqual(MAC_CAPABILITIES);
  });

  it('fails the handshake on an unexpected protocol version', async () => {
    const bridge = createMacDesktopBridge({ host: nativeShell((request) => successResponse(request.requestId, { bridgeVersion: 1, protocol: BRIDGE_PROTOCOL })) });
    const stub: ApolloDesktopBridge = { ...bridge, getVersion: () => Promise.resolve({ bridgeVersion: 2 as unknown as 1, protocol: 'apollo-desktop-bridge' }) };
    await expect(handshakeMacDesktopBridge(stub)).rejects.toBeInstanceOf(DesktopBridgeError);
  });

  it('installs the response sink global on the host', () => {
    const host = nativeShell(defaultResponder);
    createMacDesktopBridge({ host });
    expect(typeof (host[APOLLO_BRIDGE_RESPONSE_GLOBAL] as { deliver: unknown }).deliver).toBe('function');
  });
});
