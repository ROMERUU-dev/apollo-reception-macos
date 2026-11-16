import {
  BrowserAdapter,
  createMacDesktopBridge,
  detectWebKitBridge,
  handshakeMacDesktopBridge,
  windowPrintFallback,
  type ApolloDesktopBridge,
  type BrowserAdapterOptions,
} from '@apollo/bridge-client';
import type { DesktopCapabilities } from '@apollo/bridge-contract';
import { CashDrawerService, type HardwareActionGrantProvider } from '../drawer-service.js';
import { selectDesktopBridge, type DesktopMode } from '../mode.js';
import { ReceiptPrintingService, type ReceiptPrintingServiceOptions } from '../printing-service.js';

/**
 * Apollo-side desktop composition root.
 *
 * This is the single module Apollo should adopt as `src/platform/desktop`. It
 * resolves exactly one bridge adapter, wraps it in the two React-facing
 * services, and reports the active capability state. Reception and `CashModule`
 * depend only on these services, never on bridge commands, AppKit, or vendor
 * SDKs.
 *
 * Adapter selection is fail-closed:
 *  1. Browser adapter by default.
 *  2. Mock adapter only when `isDevelopment` and `mode === 'mock'`; the mock is
 *     injected via `createMock` so `@apollo/hardware-mock` stays out of the web
 *     bundle (import it behind a dev-only dynamic import).
 *  3. The native macOS adapter only after a validated WKWebView handshake; any
 *     handshake failure falls back to the browser adapter.
 */

export type ResolvedDesktopMode = 'browser' | 'mock' | 'macos';

export interface DesktopPlatform {
  /** The adapter class that was actually selected. */
  readonly mode: ResolvedDesktopMode;
  /** The single resolved bridge adapter. */
  readonly bridge: ApolloDesktopBridge;
  /** Centralized receipt printing for Reception. */
  readonly printing: ReceiptPrintingService;
  /** Centralized, grant-gated cash drawer control for `CashModule`. */
  readonly drawer: CashDrawerService;
  /** Capability state, loaded once (the macOS path's validated handshake result). */
  readonly capabilities: DesktopCapabilities;
}

export interface ComposeDesktopPlatformOptions {
  /** From `VITE_APOLLO_DESKTOP_MODE`. Browser is the fail-closed default. */
  mode?: DesktopMode;
  /** Typically `import.meta.env.DEV`. Required so mock mode cannot leak to production. */
  isDevelopment: boolean;
  /** Supply a pre-built browser adapter instead of the default one. */
  browser?: ApolloDesktopBridge;
  /** Options for the default browser adapter; ignored when `browser` is provided. */
  browserOptions?: BrowserAdapterOptions;
  /** Factory for the development mock adapter; keeps `@apollo/hardware-mock` optional for the web build. */
  createMock?: () => ApolloDesktopBridge;
  /** Backend one-time hardware-grant provider. Defaults to a fail-closed provider that refuses every drawer action. */
  grants?: HardwareActionGrantProvider;
  /** Options for the printing service (e.g. a deterministic id factory). */
  printingOptions?: ReceiptPrintingServiceOptions;
  /** Master switch for the native WKWebView path. Defaults to `true`. */
  allowNativeBridge?: boolean;
  /** Presence probe for the native handler. Defaults to {@link detectWebKitBridge}. */
  detectMac?: () => boolean;
  /** Factory for the native macOS bridge. Defaults to {@link createMacDesktopBridge}. */
  createMac?: () => ApolloDesktopBridge;
}

/**
 * A grant provider that refuses every drawer action. Used when no backend
 * hardware-grant endpoint is wired yet so `drawer.open` can never succeed by
 * default — capability negotiation is not authorization.
 */
export function failClosedGrantProvider(): HardwareActionGrantProvider {
  return {
    requestDrawerGrant: () => Promise.reject(new Error('No backend hardware-action grant provider is configured; drawer.open is fail-closed.')),
  };
}

function assemble(
  mode: ResolvedDesktopMode,
  bridge: ApolloDesktopBridge,
  capabilities: DesktopCapabilities,
  grants: HardwareActionGrantProvider,
  printingOptions: ReceiptPrintingServiceOptions | undefined,
): DesktopPlatform {
  return {
    mode,
    bridge,
    capabilities,
    printing: new ReceiptPrintingService(bridge, printingOptions ?? {}),
    drawer: new CashDrawerService(bridge, grants),
  };
}

export async function composeDesktopPlatform(options: ComposeDesktopPlatformOptions): Promise<DesktopPlatform> {
  const { isDevelopment } = options;
  const grants = options.grants ?? failClosedGrantProvider();
  const printingOptions = options.printingOptions;

  // (2) Explicit development-only mock mode.
  if (options.mode === 'mock') {
    const mock = options.createMock?.();
    const bridge = selectDesktopBridge({ mode: 'mock', isDevelopment, ...(mock ? { mock } : {}) });
    return assemble('mock', bridge, await bridge.getCapabilities(), grants, printingOptions);
  }

  // (3) Native macOS path: detect presence, then trust only after a validated handshake.
  const allowNative = options.allowNativeBridge ?? true;
  const detectMac = options.detectMac ?? (() => detectWebKitBridge());
  if (allowNative && detectMac()) {
    const createMac = options.createMac ?? (() => createMacDesktopBridge());
    const candidate = createMac();
    try {
      const capabilities = await handshakeMacDesktopBridge(candidate);
      return assemble('macos', candidate, capabilities, grants, printingOptions);
    } catch {
      // Handshake could not be validated: fall through to the fail-closed browser adapter.
    }
  }

  // (1) Browser default.
  const browser = options.browser ?? new BrowserAdapter(options.browserOptions ?? { printFallback: windowPrintFallback() });
  return assemble('browser', browser, await browser.getCapabilities(), grants, printingOptions);
}
