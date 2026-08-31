export default {
  '*.{ts,tsx}': ['prettier --write', 'eslint --fix', () => 'tsc --noEmit --incremental false'],
  '*.{js,mjs,cjs}': ['prettier --write', 'eslint --fix'],
  '*.{css,json,md,yml,yaml}': ['prettier --write'],
};
