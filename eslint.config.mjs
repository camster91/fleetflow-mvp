import { FlatCompat } from '@eslint/eslintrc';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const compat = new FlatCompat({ baseDirectory: __dirname });

// Flat config equivalent of the old .eslintrc.json (extends + rule
// overrides preserved verbatim). Loading eslint-config-next through
// FlatCompat keeps the require() chain inside ESLint's CJS modules, so
// @rushstack/eslint-patch can locate ESLint and apply. Importing
// 'eslint-config-next' directly from this ESM file breaks that chain
// ("Failed to patch ESLint because the calling module was not recognized").
export default [
  ...compat.extends('next/core-web-vitals'),
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      'react/no-unescaped-entities': 'off',
      'react-hooks/exhaustive-deps': 'warn',
      'react-hooks/rules-of-hooks': 'off',
      '@next/next/no-html-link-for-pages': 'off',
    },
  },
  {
    // Scoped fix-up for files outside `next lint`'s default dirs that the
    // flat config now reaches when ESLint is invoked directly: jest mock
    // components in tests are intentionally anonymous arrow functions, so
    // react/display-name (from eslint-plugin-react's recommended set, newly
    // enforced on these files) is disabled for test code only.
    files: ['**/__tests__/**/*', '**/*.test.{ts,tsx,js,jsx}', '**/*.spec.{ts,tsx,js,jsx}', '**/jest.setup.js'],
    rules: {
      'react/display-name': 'off',
    },
  },
];
