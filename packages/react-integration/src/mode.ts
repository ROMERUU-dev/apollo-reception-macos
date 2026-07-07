import { BrowserAdapter, type ApolloDesktopBridge } from '@apollo/bridge-client';

export type DesktopMode = 'browser' | 'mock';

export function selectDesktopBridge(options: {
  mode?: DesktopMode;
  isDevelopment: boolean;
  browser?: ApolloDesktopBridge;
  mock?: ApolloDesktopBridge;
}): ApolloDesktopBridge {
  const mode = options.mode ?? 'browser';
  if (mode === 'mock') {
    if (!options.isDevelopment) throw new Error('Mock desktop mode is forbidden outside development.');
    if (!options.mock) throw new Error('Mock desktop mode was selected without an explicit mock adapter.');
    return options.mock;
  }
  return options.browser ?? new BrowserAdapter();
}
