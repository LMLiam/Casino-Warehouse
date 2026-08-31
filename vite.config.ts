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
    exclude: ['node_modules/**', 'dist/**', '.opencode/**', 'tests/e2e/**'],
    coverage: {
      exclude: ['coverage/**', 'dist/**', 'dist-server/**', 'node_modules/**', '.opencode/**', 'src/multiplayer/serverEntry.ts', 'tests/e2e/**'],
      thresholds: {
        statements: 90,
        branches: 85,
        functions: 90,
        lines: 90,
        'src/game/beatTheHouse/settlement/**': {
          statements: 95,
          branches: 95,
          functions: 95,
          lines: 95,
        },
      },
    },
  },
});
