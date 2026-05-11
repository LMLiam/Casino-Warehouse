import { defineConfig } from 'vitest/config';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [tailwindcss()],
  server: {
    host: '127.0.0.1',
    port: 5173,
  },
  test: {
    globals: true,
    environment: 'node',
    exclude: ['node_modules/**', 'dist/**', 'tests/e2e/**'],
    coverage: {
      exclude: ['coverage/**', 'dist/**', 'dist-server/**', 'node_modules/**', 'src/multiplayer/serverEntry.ts', 'tests/e2e/**'],
    },
  },
});
