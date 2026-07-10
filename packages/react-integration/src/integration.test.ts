import { describe, expect, it } from 'vitest';
import { BrowserAdapter } from '@apollo/bridge-client';
import { allowSyntheticGrant, MockDesktopAdapter } from '@apollo/hardware-mock';
import { syntheticReceipt } from '@apollo/receipt-core';
import { CashDrawerService } from './drawer-service.js';
import { selectDesktopBridge } from './mode.js';
import { ReceiptPrintingService } from './printing-service.js';

describe('React integration services', () => {
  it('keeps browser as the fail-closed default', async () => {
    expect((await selectDesktopBridge({ isDevelopment: true }).getCapabilities()).platform).toBe('browser');
  });

  it('selects WebKit only when a native reply handler completes the v1 handshake', async () => {
    const bridge = selectDesktopBridge({
      isDevelopment: false,
      windowLike: {
        apolloNativeBridge: {
          postMessage: async (request: unknown) => {
            const value = request as { requestId: string; command: string; payload: { nonce?: string } };
            const result = value.command === 'bridge.getVersion'
              ? { bridgeVersion: 1, protocol: 'apollo-desktop-bridge' }
              : value.command === 'bridge.getCapabilities'
                ? { bridgeVersion: 1, platform: 'macos', capabilities: { printing: false, cashDrawer: false, printerStatus: false, deviceSettings: false } }
                : { pong: value.payload.nonce ?? '', timestamp: '2026-01-01T00:00:00.000Z' };
            return { version: 1, requestId: value.requestId, ok: true, result };
          },
        },
      },
    });

    await expect(bridge.getVersion()).resolves.toEqual({ bridgeVersion: 1, protocol: 'apollo-desktop-bridge' });
    await expect(bridge.getCapabilities()).resolves.toMatchObject({ platform: 'macos' });
    await expect(bridge.ping('react-real')).resolves.toMatchObject({ pong: 'react-real' });
  });

  it('can explicitly force browser behavior even when WebKit globals exist', async () => {
    const bridge = selectDesktopBridge({
      mode: 'browser',
      isDevelopment: false,
      windowLike: { apolloNativeBridge: { postMessage: async () => { throw new Error('must not run'); } } },
    });
    await expect(bridge.getCapabilities()).resolves.toMatchObject({ platform: 'browser' });
  });

  it('requires explicit development-only mock mode', () => {
    expect(() => selectDesktopBridge({ mode: 'mock', isDevelopment: false, mock: new MockDesktopAdapter() })).toThrow(/forbidden/);
    expect(() => selectDesktopBridge({ mode: 'mock', isDevelopment: true })).toThrow(/explicit mock/);
  });

  it('uses one printing service and browser fallback', async () => {
    let called = 0;
    const service = new ReceiptPrintingService(new BrowserAdapter({ printFallback: () => { called += 1; } }), { idFactory: () => '50000000-0000-4000-8000-000000000001' });
    expect((await service.printReceipt(syntheticReceipt())).status).toBe('completed');
    expect(called).toBe(1);
  });

  it('requires a backend grant provider before drawer.open', async () => {
    const grant = 'synthetic-service-grant';
    const adapter = new MockDesktopAdapter({ drawerState: 'closed', grantVerifier: allowSyntheticGrant(grant) });
    const service = new CashDrawerService(adapter, { requestDrawerGrant: async (reasonCode) => ({ actionId: '60000000-0000-4000-8000-000000000001', authorizationGrant: grant, reasonCode }) });
    expect((await service.openAuthorized('cash_payment', { cashSessionId: 'synthetic-session' })).status).toBe('opened');
  });
});
