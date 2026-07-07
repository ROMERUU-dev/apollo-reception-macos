import { describe, expect, it } from 'vitest';
import { DesktopBridgeError } from '@apollo/bridge-client';
import { syntheticReceipt } from '@apollo/receipt-core';
import { MockDesktopAdapter } from './mock-adapter.js';

const job = (id: string) => ({ printJobId: id, document: syntheticReceipt(), options: { width: '58mm' as const } });

describe('mock printer', () => {
  it.each(['ready', 'offline', 'out_of_paper', 'busy'] as const)('reports %s', async (state) => {
    const adapter = new MockDesktopAdapter({ printerState: state });
    expect((await adapter.getPrinterStatus()).state).toBe(state);
  });

  it('completes a synthetic print when ready', async () => {
    const adapter = new MockDesktopAdapter({ printerState: 'ready', now: () => new Date('2026-01-01T00:00:00Z') });
    expect((await adapter.printJob(job('30000000-0000-4000-8000-000000000001'))).status).toBe('completed');
  });

  it.each([
    ['offline', 'PRINTER_OFFLINE'], ['out_of_paper', 'PRINTER_OUT_OF_PAPER'], ['cover_open', 'PRINTER_COVER_OPEN'], ['busy', 'PRINTER_BUSY'], ['error', 'PRINT_FAILED'],
  ] as const)('fails deterministically for %s', async (state, code) => {
    const adapter = new MockDesktopAdapter({ printerState: state });
    await expect(adapter.printJob(job('30000000-0000-4000-8000-000000000002'))).rejects.toEqual(expect.objectContaining({ code }));
  });

  it('deduplicates a printJobId and preserves job correlation', async () => {
    const adapter = new MockDesktopAdapter({ printerState: 'ready' });
    const request = job('30000000-0000-4000-8000-000000000003');
    const first = await adapter.printJob(request);
    adapter.setPrinterState('offline');
    const second = await adapter.printJob(request);
    expect(second).toEqual(first);
    expect(second.printJobId).toBe(request.printJobId);
  });

  it('uses bridge errors rather than raw device failures', async () => {
    const adapter = new MockDesktopAdapter({ printerState: 'offline' });
    await expect(adapter.printJob(job('30000000-0000-4000-8000-000000000004'))).rejects.toBeInstanceOf(DesktopBridgeError);
  });
});
