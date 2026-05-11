import js from '@eslint/js';
import tseslint from 'typescript-eslint';

const globals = {
  AudioContext: 'readonly',
  Blob: 'readonly',
  Buffer: 'readonly',
  CustomEvent: 'readonly',
  DataTransfer: 'readonly',
  DragEvent: 'readonly',
  Event: 'readonly',
  HTMLButtonElement: 'readonly',
  HTMLDivElement: 'readonly',
  HTMLElement: 'readonly',
  HTMLInputElement: 'readonly',
  HTMLLabelElement: 'readonly',
  HTMLOptionElement: 'readonly',
  HTMLSelectElement: 'readonly',
  HTMLSpanElement: 'readonly',
  HTMLTextAreaElement: 'readonly',
  KeyboardEvent: 'readonly',
  MessageEvent: 'readonly',
  MouseEvent: 'readonly',
  URL: 'readonly',
  WebSocket: 'readonly',
  clearTimeout: 'readonly',
  console: 'readonly',
  crypto: 'readonly',
  document: 'readonly',
  fetch: 'readonly',
  localStorage: 'readonly',
  process: 'readonly',
  setInterval: 'readonly',
  setTimeout: 'readonly',
  window: 'readonly',
};

export default [
  {
    ignores: ['coverage/**', 'dist/**', 'dist-server/**', 'node_modules/**', 'playwright-report/**', 'test-results/**'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx,mjs}'],
    languageOptions: {
      globals,
    },
    rules: {
      'no-undef': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_', ignoreRestSiblings: true }],
    },
  },
];
