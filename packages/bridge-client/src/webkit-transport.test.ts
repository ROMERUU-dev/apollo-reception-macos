import { describe, expect, it, vi } from 'vitest';
import { JsonBridgeClient } from './client.js';
import { createApolloWebKitTransport, hasApolloWebKitBridge } from './webkit-transport.js';

const REQUEST_ID = '10000000-0000-4000-8000-000000000001';

describe('WKWebView bridge transport', () => {
  it('roundtrips a correlated reply-handler response', async () => {
    const postMessage = vi.fn(async (request: unknown) => {
      const candidate = request as { requestId: string; payload: { nonce?: string } };
      return {
        version: 1,
        requestId: candidate.requestId,
        ok: true,
        result: { pong: candidate.payload.nonce ?? '', timestamp: '2026-01-01T00:00:00.000Z' },
      };
    });
    const windowLike = { apolloNativeBridge: { postMessage } };
    expect(hasApolloWebKitBridge(windowLike)).toBe(true);

    const client = new JsonBridgeClient(createApolloWebKitTransport(windowLike), {
      requestIdFactory: () => REQUEST_ID,
    });
    await expect(client.ping('native')).resolves.toMatchObject({ pong: 'native' });
    expect(postMessage).toHaveBeenCalledOnce();
  });

  it('fails closed when no reply handler is present', () => {
    expect(hasApolloWebKitBridge({})).toBe(false);
    expect(() => createApolloWebKitTransport({})).toThrow('Apollo WKWebView bridge is unavailable.');
  });
});
