import { defineConfig } from 'oxlint';

export default defineConfig({
  plugins: ['typescript', 'unicorn', 'oxc'],
  env: {
    node: true,
    commonjs: true,
    builtin: true,
  },
  categories: {
    correctness: 'error',
    suspicious: 'warn',
  },
  rules: {
    'no-unused-vars': 'warn',
    eqeqeq: 'warn',
    'no-var': 'warn',
    'no-console': 'off',
    'unicorn/no-process-exit': 'off',
  },
  ignorePatterns: [
    '**/node_modules/**',
    'src/rust/**',
    'src/template/**',
    'example/**',
  ],
});
