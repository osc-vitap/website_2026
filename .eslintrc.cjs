/**
 * The lint script runs `eslint .` from the repo root, which covers both
 * the Vite site in src/ and the Cloudflare Worker in osc-events-worker/.
 * Those run in different environments, so the Worker gets its own
 * override below instead of a second ESLint setup.
 */
module.exports = {
  root: true,

  env: {
    browser: true,
    es2022: true,
  },

  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react-hooks/recommended',
  ],

  parser: '@typescript-eslint/parser',

  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    ecmaFeatures: { jsx: true },
  },

  plugins: ['@typescript-eslint', 'react-refresh'],

  ignorePatterns: [
    'dist',
    'node_modules',
    'osc-events-worker/worker-configuration.d.ts',
    '**/*.config.js',
    '**/*.config.ts',
  ],

  rules: {
    'react-refresh/only-export-components': [
      'warn',
      { allowConstantExport: true },
    ],

    // The Worker is tab-indented and Prettier aligns wrapped union
    // members with trailing spaces. smart-tabs allows that while still
    // catching genuinely mixed indentation.
    'no-mixed-spaces-and-tabs': ['error', 'smart-tabs'],

    // Unused function arguments are often there for signature clarity
    // (handler params, ignored leading args). Prefixing with _ opts out.
    '@typescript-eslint/no-unused-vars': [
      'error',
      {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrors: 'none',
      },
    ],
  },

  overrides: [
    {
      // Cloudflare Worker: no DOM, no React, and its own tsconfig.
      files: ['osc-events-worker/**/*.ts'],

      env: {
        browser: false,
        worker: true,
        es2022: true,
      },

      // Worker globals (Env, D1Database, ScheduledController, ...) come
      // from worker-configuration.d.ts and are checked by `tsc --noEmit`
      // in the deploy workflow, so no `globals` list is needed here.

      rules: {
        'react-refresh/only-export-components': 'off',
      },
    },

    {
      // Node scripts run outside the browser.
      files: ['scripts/**/*.{js,cjs,ts}'],

      env: {
        browser: false,
        node: true,
      },
    },
  ],
};
