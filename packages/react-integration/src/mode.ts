import {
  BrowserAdapter,
  JsonBridgeClient,
  createApolloWebKitTransport,
  hasApolloWebKitBridge,
  type ApolloDesktopBridge,
  type ApolloWebKitWindow,
  type BridgeClientOptions,
} from '@apollo/bridge-client';

export type DesktopMode = 'auto' | 'browser' | 'mock';

export function selectDesktopBridge(options: {
  mode?: DesktopMode;
  isDevelopment: boolean;
  browser?: ApolloDesktopBridge;
  mock?: ApolloDesktopBridge;
  windowLike?: ApolloWebKitWindow;
  bridgeClientOptions?: BridgeClientOptions;
}): ApolloDesktopBridge {
  const mode = options.mode ?? 'auto';
  if (mode === 'mock') {
    if (!options.isDevelopment) throw new Error('Mock desktop mode is forbidden outside development.');
    if (!options.mock) throw new Error('Mock desktop mode was selected without an explicit mock adapter.');
    return options.mock;
  }
  if (mode === 'auto' && options.windowLike && hasApolloWebKitBridge(options.windowLike)) {
    return new JsonBridgeClient(
      createApolloWebKitTransport(options.windowLike),
      options.bridgeClientOptions,
    );
  }
  return options.browser ?? new BrowserAdapter();
}
