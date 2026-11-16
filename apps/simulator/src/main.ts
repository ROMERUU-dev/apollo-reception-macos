import { JsonBridgeClient } from '@apollo/bridge-client';
import type { DrawerState, PrinterState } from '@apollo/bridge-contract';
import { allowSyntheticGrant, MockBridgeTransport, MockDesktopAdapter } from '@apollo/hardware-mock';
import { renderReceiptHtml, syntheticReceipt, syntheticTemplate } from '@apollo/receipt-core';
import './style.css';

const SYNTHETIC_GRANT = 'synthetic-grant-for-linux-simulator';
const adapter = new MockDesktopAdapter({ printerState: 'ready', drawerState: 'closed', grantVerifier: allowSyntheticGrant(SYNTHETIC_GRANT) });
const client = new JsonBridgeClient(new MockBridgeTransport(adapter), { timeoutMs: 1_000 });
const receipt = syntheticReceipt('payment');

const byId = <T extends HTMLElement>(id: string) => {
  const value = document.getElementById(id);
  if (!value) throw new Error(`Missing simulator element: ${id}`);
  return value as T;
};

function renderControls<T extends string>(target: HTMLElement, states: readonly T[], current: () => T, select: (state: T) => void) {
  target.replaceChildren(...states.map((state) => {
    const button = document.createElement('button');
    button.textContent = state.replaceAll('_', ' ');
    button.className = state === current() ? 'active' : '';
    button.addEventListener('click', () => { select(state); render(); });
    return button;
  }));
}

function renderLog() {
  byId('event-log').textContent = adapter.events.map((event) => JSON.stringify(event)).join('\n');
}

function render() {
  renderControls(byId('printer-controls'), ['ready', 'offline', 'out_of_paper', 'busy'] as const, () => adapter.getPrinterState(), (state: PrinterState) => adapter.setPrinterState(state));
  renderControls(byId('drawer-controls'), ['available', 'unavailable', 'open', 'closed'] as const, () => adapter.getDrawerStateValue(), (state: DrawerState) => adapter.setDrawerState(state));
  renderLog();
}

byId('preview-58').innerHTML = renderReceiptHtml(receipt, { ...syntheticTemplate, width: '58mm' });
byId('preview-80').innerHTML = renderReceiptHtml(receipt, { ...syntheticTemplate, width: '80mm' });

byId('print-success').addEventListener('click', async () => {
  adapter.setPrinterState('ready');
  await client.printJob({ printJobId: crypto.randomUUID(), document: receipt, options: { width: '80mm', copies: 1 } });
  render();
});
byId('print-failure').addEventListener('click', async () => {
  adapter.setPrinterState('out_of_paper');
  await client.printJob({ printJobId: crypto.randomUUID(), document: receipt, options: { width: '58mm' } }).catch(() => undefined);
  render();
});
byId('drawer-open').addEventListener('click', async () => {
  adapter.setDrawerState('closed');
  await client.openDrawer({ actionId: crypto.randomUUID(), authorizationGrant: SYNTHETIC_GRANT, reasonCode: 'cash_payment' });
  render();
});
byId('drawer-denied').addEventListener('click', async () => {
  adapter.setDrawerState('closed');
  await client.openDrawer({ actionId: crypto.randomUUID(), authorizationGrant: 'invalid-grant-value', reasonCode: 'supervisor_override' }).catch(() => undefined);
  render();
});

render();
