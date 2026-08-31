import { titleTypes } from './scripts/validate-pr-standards.mjs';

export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'scope-case': [2, 'always', 'lower-case'],
    'scope-empty': [2, 'never'],
    'subject-min-length': [2, 'always', 5],
    'type-enum': [2, 'always', titleTypes],
  },
};
