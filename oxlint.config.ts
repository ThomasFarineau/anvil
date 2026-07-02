import { defineConfig } from 'oxlint';

export default defineConfig({
  plugins: ['typescript', 'unicorn', 'oxc', 'import', 'promise', 'node'],
  env: {
    node: true,
    commonjs: true,
    builtin: true,
    browser: true,
  },
  categories: {
    correctness: 'error',
    suspicious: 'error',
    perf: 'warn',
  },
  rules: {
    'no-unused-vars': 'error',
    eqeqeq: 'error',
    'no-var': 'error',
    'no-console': 'off',
    'unicorn/no-process-exit': 'off',
    'no-underscore-dangle': 'off',
    'import/no-unassigned-import': 'off',
    'promise/always-return': 'off',
  },
  ignorePatterns: [
    '**/node_modules/**',
    'dist/**',
    'src/rust/**',
    'examples/**',
    '**/*.vue',
  ],
});
