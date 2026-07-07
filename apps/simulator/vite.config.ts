import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const repoRoot = new URL('../../', import.meta.url);
const fromRoot = (path: string) => fileURLToPath(new URL(path, repoRoot));

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  resolve: {
    alias: {
      '@apollo/receipt-core': fromRoot('packages/receipt-core/src/index.ts'),
      '@apollo/bridge-contract': fromRoot('packages/bridge-contract/src/index.ts'),
      '@apollo/bridge-client': fromRoot('packages/bridge-client/src/index.ts'),
      '@apollo/hardware-mock': fromRoot('packages/hardware-mock/src/index.ts'),
    },
  },
  build: { outDir: fromRoot('dist/simulator'), emptyOutDir: true },
});
