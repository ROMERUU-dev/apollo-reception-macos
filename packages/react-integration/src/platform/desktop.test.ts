import { describe, expect, it } from 'vitest';
import type { ApolloDesktopBridge } from '@apollo/bridge-client';
import { BRIDGE_PROTOCOL, type DesktopCapabilities } from '@apollo/bridge-contract';
import { allowSyntheticGrant, MockDesktopAdapter } from '@apollo/hardware-mock';
import { syntheticReceipt } from '@apollo/receipt-core';
import { composeDesktopPlatform } from './desktop.js';

const GRANT = 'synthetic-composition-grant';

const MAC_CAPABILITIES: DesktopCapabilities = {
  bridgeVersion: 1,
  platform: 'macos',
  capabilities: { printing: true, cashDrawer: true, printerStatus: true, deviceSettings: true },
};

/** Minimal native-bridge stub: compose only calls getVersion + getCapabilities during the handshake. */
function macStub(overrides: Partial<ApolloDesktopBridge> = {}): ApolloDesktopBridge {
  return {
    getVersion: () => Promise.resolve({ bridgeVersion: 1, protocol: BRIDGE_PROTOCOL }),
    getCapabilities: () => Promise.resolve(MAC_CAPABILITIES),
    ...overrides,
  } as ApolloDesktopBridge;
}

describe('composeDesktopPlatform', () => {
  it('selects the browser adapter as the fail-closed default', async () => {
    const platform = await composeDesktopPlatform({ isDevelopment: true, detectMac: () => false });
    expect(platform.mode).toBe('browser');
    expect(platform.capabilities.platform).toBe('browser');
  });

  it('never selects the native path when no WKWebView handler is detected', async () => {
    const platform = await composeDesktopPlatform({ isDevelopment: false, detectMac: () => false, createMac: () => macStub() });
    expect(platform.mode).toBe('browser');
  });

  it('selects the mock adapter only in development with explicit mock mode', async () => {
    const platform = await composeDesktopPlatform({
      mode: 'mock',
      isDevelopment: true,
      createMock: () => new MockDesktopAdapter({ printerState: 'ready', drawerState: 'closed' }),
    });
    expect(platform.mode).toBe('mock');
    expect(platform.capabilities.platform).toBe('mock-linux');
  });

  it('refuses mock mode outside development and without an injected mock', async () => {
    await expect(composeDesktopPlatform({ mode: 'mock', isDevelopment: false, createMock: () => new MockDesktopAdapter() })).rejects.toThrow(/forbidden/);
    await expect(composeDesktopPlatform({ mode: 'mock', isDevelopment: true })).rejects.toThrow(/explicit mock/);
  });

  it('selects the native macOS adapter after a validated handshake', async () => {
    const platform = await composeDesktopPlatform({ isDevelopment: false, detectMac: () => true, createMac: () => macStub() });
    expect(platform.mode).toBe('macos');
    expect(platform.capabilities).toEqual(MAC_CAPABILITIES);
  });

  it('falls back to the browser adapter when the native handshake cannot be validated', async () => {
    const platform = await composeDesktopPlatform({
      isDevelopment: false,
      detectMac: () => true,
      createMac: () => macStub({ getVersion: () => Promise.resolve({ bridgeVersion: 2 as unknown as 1, protocol: BRIDGE_PROTOCOL }) }),
    });
    expect(platform.mode).toBe('browser');
  });

  it('ignores a detected native handler when allowNativeBridge is false', async () => {
    const platform = await composeDesktopPlatform({ isDevelopment: false, allowNativeBridge: false, detectMac: () => true, createMac: () => macStub() });
    expect(platform.mode).toBe('browser');
  });

  it('prints receipts through the composed service and browser fallback', async () => {
    let printed = 0;
    const platform = await composeDesktopPlatform({
      isDevelopment: true,
      detectMac: () => false,
      browserOptions: { printFallback: () => { printed += 1; } },
      printingOptions: { idFactory: () => '50000000-0000-4000-8000-000000000001' },
    });
    expect((await platform.printing.printReceipt(syntheticReceipt())).status).toBe('completed');
    expect(printed).toBe(1);
  });

  it('keeps drawer.open fail-closed when no grant provider is configured', async () => {
    const platform = await composeDesktopPlatform({
      mode: 'mock',
      isDevelopment: true,
      createMock: () => new MockDesktopAdapter({ drawerState: 'closed', grantVerifier: allowSyntheticGrant(GRANT) }),
    });
    expect(platform.capabilities.capabilities.cashDrawer).toBe(true);
    await expect(platform.drawer.openAuthorized('cash_payment', { cashSessionId: 'synthetic-session' })).rejects.toThrow(/fail-closed/);
  });

  it('opens the drawer when a backend grant provider authorizes the action', async () => {
    const platform = await composeDesktopPlatform({
      mode: 'mock',
      isDevelopment: true,
      createMock: () => new MockDesktopAdapter({ drawerState: 'closed', grantVerifier: allowSyntheticGrant(GRANT) }),
      grants: { requestDrawerGrant: (reasonCode) => Promise.resolve({ actionId: '60000000-0000-4000-8000-000000000001', authorizationGrant: GRANT, reasonCode }) },
    });
    expect((await platform.drawer.openAuthorized('cash_payment', { cashSessionId: 'synthetic-session' })).status).toBe('opened');
  });
});
