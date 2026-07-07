import type { ReceiptDocument, ReceiptWidth } from '@apollo/receipt-core';

export const BRIDGE_VERSION = 1 as const;
export const BRIDGE_PROTOCOL = 'apollo-desktop-bridge' as const;
export const MAX_BRIDGE_PAYLOAD_BYTES = 256 * 1024;

export const BRIDGE_COMMANDS = [
  'bridge.getVersion',
  'bridge.getCapabilities',
  'bridge.ping',
  'printer.list',
  'printer.status',
  'printer.printTest',
  'printer.printJob',
  'drawer.status',
  'drawer.open',
  'device.getProfile',
] as const;

export type BridgeCommand = typeof BRIDGE_COMMANDS[number];
export type BridgePlatform = 'browser' | 'mock-linux' | 'macos';
export type PrinterState = 'ready' | 'offline' | 'out_of_paper' | 'cover_open' | 'busy' | 'error' | 'unavailable';
export type DrawerState = 'available' | 'unavailable' | 'open' | 'closed' | 'unknown';
export type DrawerReasonCode = 'cash_payment' | 'cash_deposit' | 'cash_withdrawal' | 'cash_opening' | 'cash_closing' | 'supervisor_override';

export interface DesktopCapabilities {
  bridgeVersion: 1;
  platform: BridgePlatform;
  capabilities: {
    printing: boolean;
    cashDrawer: boolean;
    printerStatus: boolean;
    deviceSettings: boolean;
  };
}

export interface PrinterInfo { id: string; name: string; isDefault: boolean; supportedWidths: ReceiptWidth[] }
export interface PrinterStatus { printerId: string; state: PrinterState; message?: string }
export interface PrintOptions { printerId?: string; copies?: number; width?: ReceiptWidth }
export interface PrintJobRequest { printJobId: string; document: ReceiptDocument; options: PrintOptions }
export interface PrintJobResult { printJobId: string; status: 'accepted' | 'completed' | 'failed'; acceptedAt: string; completedAt?: string; errorCode?: string }
export interface DrawerStatus { state: DrawerState; message?: string }
export interface OpenDrawerRequest { actionId: string; authorizationGrant: string; reasonCode: DrawerReasonCode }
export interface DrawerResult { actionId: string; status: 'opened' | 'rejected'; reasonCode: DrawerReasonCode; performedAt: string }
export interface DeviceProfile { deviceId: string; displayName: string; platform: BridgePlatform; settingsWritable: boolean }

export interface BridgePayloadMap {
  'bridge.getVersion': Record<string, never>;
  'bridge.getCapabilities': Record<string, never>;
  'bridge.ping': { nonce?: string };
  'printer.list': Record<string, never>;
  'printer.status': { printerId?: string };
  'printer.printTest': PrintOptions;
  'printer.printJob': PrintJobRequest;
  'drawer.status': Record<string, never>;
  'drawer.open': OpenDrawerRequest;
  'device.getProfile': Record<string, never>;
}

export interface BridgeResultMap {
  'bridge.getVersion': { bridgeVersion: 1; protocol: typeof BRIDGE_PROTOCOL };
  'bridge.getCapabilities': DesktopCapabilities;
  'bridge.ping': { pong: string; timestamp: string };
  'printer.list': PrinterInfo[];
  'printer.status': PrinterStatus;
  'printer.printTest': PrintJobResult;
  'printer.printJob': PrintJobResult;
  'drawer.status': DrawerStatus;
  'drawer.open': DrawerResult;
  'device.getProfile': DeviceProfile;
}

export type BridgeRequest<C extends BridgeCommand = BridgeCommand> = C extends BridgeCommand ? {
  version: 1;
  requestId: string;
  command: C;
  payload: BridgePayloadMap[C];
} : never;

export type BridgeErrorCode =
  | 'INVALID_REQUEST' | 'UNSUPPORTED_VERSION' | 'UNKNOWN_COMMAND' | 'PAYLOAD_TOO_LARGE'
  | 'TIMEOUT' | 'CANCELLED' | 'UNSUPPORTED_CAPABILITY' | 'PRINTER_UNAVAILABLE'
  | 'PRINTER_OFFLINE' | 'PRINTER_OUT_OF_PAPER' | 'PRINTER_COVER_OPEN' | 'PRINTER_BUSY'
  | 'PRINT_FAILED' | 'DRAWER_UNAVAILABLE' | 'DRAWER_UNAUTHORIZED' | 'DUPLICATE_ACTION'
  | 'INTERNAL_ERROR';

export interface BridgeErrorBody { code: BridgeErrorCode; message: string; details?: Record<string, unknown> }
export type BridgeSuccessResponse<T = unknown> = { version: 1; requestId: string; ok: true; result: T };
export type BridgeFailureResponse = { version: 1; requestId: string; ok: false; error: BridgeErrorBody };
export type BridgeResponse<T = unknown> = BridgeSuccessResponse<T> | BridgeFailureResponse;
