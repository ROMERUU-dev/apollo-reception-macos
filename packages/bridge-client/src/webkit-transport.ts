import { BRIDGE_PROTOCOL, type BridgeRequest, type DesktopCapabilities } from '@apollo/bridge-contract';
import { JsonBridgeClient, type BridgeClientOptions, type BridgeTransport } from './client.js';
import { DesktopBridgeError } from './errors.js';
import type { ApolloDesktopBridge } from './interface.js';

/**
 * JavaScript half of the native macOS bridge channel.
 *
 * On a real Mac the Swift shell registers a WKScriptMessageHandler named
 * `apolloBridge`. React posts a validated {@link BridgeRequest} through
 * `window.webkit.messageHandlers.apolloBridge.postMessage(request)`; Swift
 * decodes, validates, dispatches to one native adapter method, and returns a
 * `BridgeResponse` by evaluating `window.__APOLLO_DESKTOP_BRIDGE__.deliver(response)`.
 *
 * This module is portable and testable from Linux with an injected message
 * handler and no WKWebView. It performs no device access; it only correlates
 * requests to responses by `requestId`.
 */

export const APOLLO_BRIDGE_HANDLER = 'apolloBridge';
export const APOLLO_BRIDGE_RESPONSE_GLOBAL = '__APOLLO_DESKTOP_BRIDGE__';

/** The minimal shape of a WKScriptMessageHandler exposed to JavaScript. */
export interface WebKitMessageHandler {
  postMessage(message: unknown): void;
}

/** The async response channel the native shell drives back into the page. */
export interface BridgeResponseSink {
  deliver(response: unknown): void;
}

interface WebKitHost {
  webkit?: { messageHandlers?: Record<string, WebKitMessageHandler | undefined> };
}

/** Returns the named message handler if the host exposes a usable one. */
export function getBridgeMessageHandler(
  host: unknown = globalThis,
  handlerName: string = APOLLO_BRIDGE_HANDLER,
): WebKitMessageHandler | undefined {
  const handler = (host as WebKitHost | null | undefined)?.webkit?.messageHandlers?.[handlerName];
  return typeof handler?.postMessage === 'function' ? handler : undefined;
}

/**
 * Presence probe for the native handler. This is a necessary precondition for
 * the macOS path, not a trust decision: capabilities must still be confirmed
 * through {@link handshakeMacDesktopBridge} before native actions are enabled.
 */
export function detectWebKitBridge(
  host: unknown = globalThis,
  handlerName: string = APOLLO_BRIDGE_HANDLER,
): boolean {
  return getBridgeMessageHandler(host, handlerName) !== undefined;
}

function readRequestId(value: unknown): string | undefined {
  const requestId = (value as { requestId?: unknown } | null | undefined)?.requestId;
  return typeof requestId === 'string' ? requestId : undefined;
}

export interface WebKitBridgeTransportOptions {
  /** Host object carrying `webkit.messageHandlers` and the response global. Defaults to `globalThis`. */
  host?: unknown;
  /** Message handler name. Defaults to `apolloBridge`. */
  handlerName?: string;
  /** Override how requests are posted. Defaults to the WKWebView message handler. */
  post?: (request: BridgeRequest) => void;
  /** When false, the response sink global is not installed (the caller wires `deliver` itself). */
  installResponseGlobal?: boolean;
}

interface PendingCall {
  resolve: (value: unknown) => void;
  reject: (reason: unknown) => void;
  dispose: () => void;
}

/**
 * Correlated transport over a WKWebView message handler. One instance owns a
 * map of in-flight requests keyed by `requestId`; {@link deliver} resolves the
 * matching call. Uncorrelatable or already-settled responses are dropped so a
 * late or malformed native reply can never resolve the wrong promise. Envelope
 * shape is validated by {@link JsonBridgeClient} after correlation.
 */
export class WebKitBridgeTransport implements BridgeTransport, BridgeResponseSink {
  private readonly pending = new Map<string, PendingCall>();
  private readonly post: (request: BridgeRequest) => void;

  constructor(options: WebKitBridgeTransportOptions = {}) {
    const host = options.host ?? globalThis;
    const handlerName = options.handlerName ?? APOLLO_BRIDGE_HANDLER;
    this.post = options.post ?? ((request) => {
      const handler = getBridgeMessageHandler(host, handlerName);
      if (!handler) {
        throw new DesktopBridgeError('UNSUPPORTED_CAPABILITY', `WKWebView message handler "${handlerName}" is unavailable.`);
      }
      handler.postMessage(request);
    });
    if (options.installResponseGlobal !== false) {
      installResponseSink(this, host);
    }
  }

  send(request: BridgeRequest, signal: AbortSignal): Promise<unknown> {
    if (this.pending.has(request.requestId)) {
      return Promise.reject(new DesktopBridgeError('INVALID_REQUEST', 'A bridge request with this requestId is already in flight.'));
    }
    return new Promise<unknown>((resolve, reject) => {
      const onAbort = () => {
        this.pending.delete(request.requestId);
        reject(signal.reason ?? new DesktopBridgeError('CANCELLED', 'Bridge request was cancelled.'));
      };
      const dispose = () => signal.removeEventListener('abort', onAbort);
      this.pending.set(request.requestId, { resolve, reject, dispose });
      if (signal.aborted) {
        onAbort();
        return;
      }
      signal.addEventListener('abort', onAbort, { once: true });
      try {
        this.post(request);
      } catch (error) {
        this.pending.delete(request.requestId);
        dispose();
        reject(error);
      }
    });
  }

  /** Entry point the native shell calls with a correlated `BridgeResponse`. */
  deliver(response: unknown): void {
    const requestId = readRequestId(response);
    if (requestId === undefined) return; // Uncorrelatable reply: drop it.
    const pending = this.pending.get(requestId);
    if (!pending) return; // Unknown or already-settled request: drop it.
    this.pending.delete(requestId);
    pending.dispose();
    pending.resolve(response);
  }

  /** Number of requests awaiting a native response. Exposed for diagnostics and tests. */
  get inFlight(): number {
    return this.pending.size;
  }
}

/** Installs `host.__APOLLO_DESKTOP_BRIDGE__ = { deliver }` so the native shell can reply. */
export function installResponseSink(
  sink: BridgeResponseSink,
  host: unknown = globalThis,
  key: string = APOLLO_BRIDGE_RESPONSE_GLOBAL,
): void {
  (host as Record<string, unknown>)[key] = { deliver: (response: unknown) => sink.deliver(response) };
}

export interface CreateMacDesktopBridgeOptions extends WebKitBridgeTransportOptions {
  client?: BridgeClientOptions;
}

/**
 * Builds the macOS bridge client over the WKWebView channel. Construction does
 * not imply the native shell is present or trusted; always confirm with
 * {@link handshakeMacDesktopBridge} before enabling native actions.
 */
export function createMacDesktopBridge(options: CreateMacDesktopBridgeOptions = {}): ApolloDesktopBridge {
  const { client, ...transportOptions } = options;
  return new JsonBridgeClient(new WebKitBridgeTransport(transportOptions), client ?? {});
}

/**
 * Validated WKWebView handshake. Confirms the native shell speaks bridge
 * protocol v1 and returns its advertised capabilities. Rejects (so callers can
 * fail closed to the browser adapter) if the version or protocol is unexpected.
 */
export async function handshakeMacDesktopBridge(bridge: ApolloDesktopBridge): Promise<DesktopCapabilities> {
  const version = await bridge.getVersion();
  if (version.bridgeVersion !== 1 || version.protocol !== BRIDGE_PROTOCOL) {
    throw new DesktopBridgeError('UNSUPPORTED_VERSION', 'WKWebView bridge handshake returned an unexpected protocol or version.');
  }
  return bridge.getCapabilities();
}
