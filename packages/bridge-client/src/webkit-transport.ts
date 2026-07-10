import type { BridgeRequest } from '@apollo/bridge-contract';
import type { BridgeTransport } from './client.js';

export interface WebKitReplyHandler {
  postMessage(message: unknown): Promise<unknown>;
}

export interface ApolloWebKitWindow {
  apolloNativeBridge?: WebKitReplyHandler;
  webkit?: { messageHandlers?: { apolloBridge?: WebKitReplyHandler } };
}

export function hasApolloWebKitBridge(windowLike: ApolloWebKitWindow): boolean {
  return Boolean(windowLike.apolloNativeBridge ?? windowLike.webkit?.messageHandlers?.apolloBridge);
}

export function createApolloWebKitTransport(windowLike: ApolloWebKitWindow): BridgeTransport {
  const handler = windowLike.apolloNativeBridge ?? windowLike.webkit?.messageHandlers?.apolloBridge;
  if (!handler) throw new Error('Apollo WKWebView bridge is unavailable.');

  return {
    send(request: BridgeRequest, signal: AbortSignal): Promise<unknown> {
      if (signal.aborted) return Promise.reject(signal.reason ?? new DOMException('Cancelled', 'AbortError'));
      return new Promise((resolve, reject) => {
        const abort = () => reject(signal.reason ?? new DOMException('Cancelled', 'AbortError'));
        signal.addEventListener('abort', abort, { once: true });
        Promise.resolve(handler.postMessage(request)).then(resolve, reject).finally(() => {
          signal.removeEventListener('abort', abort);
        });
      });
    },
  };
}
