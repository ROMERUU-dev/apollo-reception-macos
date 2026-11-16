import type {
  DesktopCapabilities,
  DeviceProfile,
  DrawerResult,
  DrawerStatus,
  OpenDrawerRequest,
  PrinterInfo,
  PrinterStatus,
  PrintJobRequest,
  PrintJobResult,
  PrintOptions,
} from '@apollo/bridge-contract';

export interface ApolloDesktopBridge {
  getVersion(): Promise<{ bridgeVersion: 1; protocol: 'apollo-desktop-bridge' }>;
  getCapabilities(): Promise<DesktopCapabilities>;
  ping(nonce?: string): Promise<{ pong: string; timestamp: string }>;
  listPrinters(): Promise<PrinterInfo[]>;
  getPrinterStatus(printerId?: string): Promise<PrinterStatus>;
  printTest(options?: PrintOptions): Promise<PrintJobResult>;
  printJob(request: PrintJobRequest): Promise<PrintJobResult>;
  getDrawerStatus(): Promise<DrawerStatus>;
  openDrawer(request: OpenDrawerRequest): Promise<DrawerResult>;
  getDeviceProfile(): Promise<DeviceProfile>;
}
