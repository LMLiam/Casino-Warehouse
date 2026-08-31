import { fixupPluginRules } from '@eslint/compat';
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import eslintPluginStrictDependencies from 'eslint-plugin-strict-dependencies';
import eslintPluginZod from 'eslint-plugin-zod';
import requireZodRecordKeyValue from './scripts/require-zod-record-key-value.mjs';

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
  {
    rules: {
      'no-eval': 'error',
      'no-new-func': 'error',
    },
  },
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx,mjs}'],
    languageOptions: {
      globals,
    },
    plugins: {
      local: {
        rules: {
          'require-zod-record-key-value': requireZodRecordKeyValue,
        },
      },
      'strict-dependencies': fixupPluginRules(eslintPluginStrictDependencies),
      zod: eslintPluginZod,
    },
    rules: {
      'local/require-zod-record-key-value': 'error',
      'no-throw-literal': 'error',
      'no-undef': 'off',
      // Use semantic Zod rules without forcing an import or formatting migration.
      'zod/no-any-schema': 'error',
      'zod/no-coerce-boolean': 'error',
      'zod/no-conflicting-checks': 'error',
      'zod/no-duplicate-schema-methods': 'error',
      'zod/no-empty-custom-schema': 'error',
      'zod/no-native-enum': 'error',
      'zod/no-number-schema-with-finite': 'error',
      'zod/no-number-schema-with-int': 'error',
      'zod/no-number-schema-with-is-finite': 'error',
      'zod/no-number-schema-with-is-int': 'error',
      'zod/no-number-schema-with-safe': 'error',
      'zod/no-number-schema-with-step': 'error',
      'zod/no-optional-and-default-together': 'error',
      'zod/no-promise-schema': 'error',
      'zod/no-schema-with-is-nullable': 'error',
      'zod/no-schema-with-is-optional': 'error',
      'zod/no-string-schema-with-uuid': 'error',
      'zod/no-throw-in-refine': 'error',
      'zod/no-transform-in-record-key': 'error',
      'zod/no-unnecessary-readonly': 'error',
      'zod/require-brand-type-parameter': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_', ignoreRestSiblings: true },
      ],
      'no-restricted-syntax': [
        'error',
        { selector: 'TSUnknownKeyword', message: 'Do not use the unknown type. Use a named domain type.' },
        { selector: 'TSObjectKeyword', message: 'Do not use the object type. Use a named domain type.' },
        { selector: "CallExpression[callee.type='MemberExpression'][callee.property.name='unknown']", message: 'Do not use unknown-valued schemas.' },
        { selector: 'TSNonNullExpression', message: 'Do not use non-null assertion (!). Use a guard or fallback.' },
        {
          selector: "BinaryExpression[left.type='UnaryExpression'][left.operator='typeof'][right.value='object']",
          message: "Do not use typeof x === 'object'. Use a Zod schema (e.g., cardSchema.safeParse) or a strict 'in' guard (e.g., 'bets' in snapshot) instead.",
        },
        {
          selector: "TSPropertySignature[key.name='profileId'] TSTypeAnnotation > TSStringKeyword",
          message:
            "Use ProfileId (string & { __brand: 'profile' }) instead of string for profileId. Import ProfileId from 'src/schemas/casinoSchemas/profileIdSchema'.",
        },
        {
          selector: "TSPropertySignature[key.name='roomId'] TSTypeAnnotation > TSStringKeyword",
          message: "Use RoomId (string & { __brand: 'room' }) instead of string for roomId. Import RoomId from 'src/schemas/casinoSchemas/roomIdSchema'.",
        },
        {
          selector: "TSPropertySignature[key.name='hostProfileId'] TSTypeAnnotation > TSStringKeyword",
          message: 'Use ProfileId instead of string for hostProfileId.',
        },
      ],
    },
  },
  {
    files: ['src/game/**/*.{ts,tsx}'],
    rules: {
      'strict-dependencies/strict-dependencies': ['error', [{ module: 'src/ui/', allowReferenceFrom: [] }], { resolveRelativeImport: true }],
      'no-restricted-syntax': [
        'error',
        { selector: 'TSUnknownKeyword', message: 'Do not use the unknown type. Use a named domain type.' },
        { selector: 'TSObjectKeyword', message: 'Do not use the object type. Use a named domain type.' },
        { selector: "CallExpression[callee.type='MemberExpression'][callee.property.name='unknown']", message: 'Do not use unknown-valued schemas.' },
        { selector: 'TSNonNullExpression', message: 'Do not use non-null assertion (!). Use a guard or fallback.' },
        {
          selector: "BinaryExpression[left.type='UnaryExpression'][left.operator='typeof'][right.value='object']",
          message: "Do not use typeof x === 'object'. Use a Zod schema (e.g., cardSchema.safeParse) or a strict 'in' guard (e.g., 'bets' in snapshot) instead.",
        },
        {
          selector: "TSPropertySignature[key.name='profileId'] TSTypeAnnotation > TSStringKeyword",
          message: 'Use ProfileId instead of string for profileId.',
        },
        {
          selector: "TSPropertySignature[key.name='roomId'] TSTypeAnnotation > TSStringKeyword",
          message: 'Use RoomId instead of string for roomId.',
        },
        {
          selector: "MemberExpression[object.name='Math'][property.name='random']",
          message: 'Do not use Math.random() in src/game/. Use src/game/rng.ts and inject deterministic RNG in tests.',
        },
      ],
    },
  },
];
