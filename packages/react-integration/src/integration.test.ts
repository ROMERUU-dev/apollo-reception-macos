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
