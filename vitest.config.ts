import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const fromRoot = (path: string) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@apollo/receipt-core': fromRoot('./packages/receipt-core/src/index.ts'),
      '@apollo/bridge-contract': fromRoot('./packages/bridge-contract/src/index.ts'),
      '@apollo/bridge-client': fromRoot('./packages/bridge-client/src/index.ts'),
      '@apollo/hardware-mock': fromRoot('./packages/hardware-mock/src/index.ts'),
      '@apollo/react-integration': fromRoot('./packages/react-integration/src/index.ts'),
      '@apollo/webview-policy': fromRoot('./packages/webview-policy/src/index.ts'),
    },
  },
  test: {
    include: ['packages/**/*.test.ts'],
    testTimeout: 5_000,
  },
});
