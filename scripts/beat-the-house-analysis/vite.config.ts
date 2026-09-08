import { resolve } from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    outDir: 'dist-beat-the-house-analysis',
    emptyOutDir: true,
    ssr: 'scripts/beat-the-house-analysis/index.ts',
    rollupOptions: {
      input: resolve(import.meta.dirname, 'index.ts'),
      output: { entryFileNames: 'index.js', format: 'es' },
    },
  },
});
