import { describe, expect, it } from 'vitest';
import { allowSyntheticGrant, MockDesktopAdapter } from './mock-adapter.js';

const GRANT = 'synthetic-authorized-grant';
const action = (overrides = {}) => ({ actionId: '40000000-0000-4000-8000-000000000001', authorizationGrant: GRANT, reasonCode: 'cash_payment' as const, ...overrides });

describe('mock drawer', () => {
  it.each(['unavailable', 'available', 'open', 'closed'] as const)('reports %s', async (state) => {
    const adapter = new MockDesktopAdapter({ drawerState: state });
    expect((await adapter.getDrawerStatus()).state).toBe(state);
  });

  it('rejects opening when unavailable', async () => {
    const adapter = new MockDesktopAdapter({ drawerState: 'unavailable', grantVerifier: allowSyntheticGrant(GRANT) });
    await expect(adapter.openDrawer(action())).rejects.toMatchObject({ code: 'DRAWER_UNAVAILABLE' });
  });

  it('rejects an unauthorized request', async () => {
    const adapter = new MockDesktopAdapter({ drawerState: 'closed' });
    await expect(adapter.openDrawer(action())).rejects.toMatchObject({ code: 'DRAWER_UNAUTHORIZED' });
  });

  it('opens with an authorized synthetic grant and preserves reason', async () => {
    const adapter = new MockDesktopAdapter({ drawerState: 'closed', grantVerifier: allowSyntheticGrant(GRANT), now: () => new Date('2026-01-01T00:00:00Z') });
    const result = await adapter.openDrawer(action());
    expect(result).toMatchObject({ status: 'opened', reasonCode: 'cash_payment' });
    expect((await adapter.getDrawerStatus()).state).toBe('open');
  });

  it('deduplicates actionId without actuating twice', async () => {
    let verifications = 0;
    const adapter = new MockDesktopAdapter({ drawerState: 'closed', grantVerifier: () => { verifications += 1; return true; } });
    const first = await adapter.openDrawer(action());
    const second = await adapter.openDrawer(action());
    expect(second).toEqual(first);
    expect(verifications).toBe(1);
  });

  it('never includes authorizationGrant in event logs', async () => {
    const adapter = new MockDesktopAdapter({ drawerState: 'closed', grantVerifier: allowSyntheticGrant(GRANT) });
    await adapter.openDrawer(action());
    expect(JSON.stringify(adapter.events)).not.toContain(GRANT);
  });
});
