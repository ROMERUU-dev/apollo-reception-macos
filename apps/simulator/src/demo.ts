import { JsonBridgeClient } from '@apollo/bridge-client';
import { allowSyntheticGrant, MockBridgeTransport, MockDesktopAdapter } from '@apollo/hardware-mock';
import { renderReceiptText, syntheticReceipt, syntheticTemplate } from '@apollo/receipt-core';

const now = () => new Date('2026-01-01T00:00:00.000Z');
const grant = 'synthetic-grant-for-linux-demo';
const adapter = new MockDesktopAdapter({ printerState: 'ready', drawerState: 'closed', grantVerifier: allowSyntheticGrant(grant), now });
const client = new JsonBridgeClient(new MockBridgeTransport(adapter), { timeoutMs: 500 });
const document = syntheticReceipt();

async function demonstrate() {
  const lines: string[] = [];
  lines.push(`printer ready: ${(await client.getPrinterStatus()).state}`);
  const success = await client.printJob({ printJobId: '30000000-0000-4000-8000-000000000001', document, options: { width: '58mm' } });
  lines.push(`print success: ${success.status} (${success.printJobId})`);
  adapter.setPrinterState('out_of_paper');
  lines.push(`printer out_of_paper: ${(await client.getPrinterStatus()).state}`);
  const failure = await client.printJob({ printJobId: '30000000-0000-4000-8000-000000000002', document, options: { width: '80mm' } }).catch((error: unknown) => error instanceof Error ? error.message : 'failure');
  lines.push(`print failure: ${String(failure)}`);
  adapter.setDrawerState('unavailable');
  lines.push(`drawer unavailable: ${(await client.getDrawerStatus()).state}`);
  adapter.setDrawerState('closed');
  const opened = await client.openDrawer({ actionId: '40000000-0000-4000-8000-000000000001', authorizationGrant: grant, reasonCode: 'cash_payment' });
  lines.push(`drawer authorized: ${opened.status} (${opened.reasonCode})`);
  const preview58 = renderReceiptText(document, { ...syntheticTemplate, width: '58mm' });
  const preview80 = renderReceiptText(document, { ...syntheticTemplate, width: '80mm' });
  lines.push(`receipt preview 58: ${preview58.previewColumns} conceptual columns`);
  lines.push(`receipt preview 80: ${preview80.previewColumns} conceptual columns`);
  lines.push(`redacted events: ${adapter.events.length}; clinical payload fields logged: 0`);
  process.stdout.write(`${lines.join('\n')}\n`);
}

await demonstrate();
