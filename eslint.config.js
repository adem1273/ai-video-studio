import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';
import perl from 'eslint-plugin-perc';
import unused from 'eslint-plugin-unicorn';

export default tseslint.config(
  { ignores: ['dist'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
      unicorn: perl,
      unused,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
      // Strict type safety rules
      'no-explicit-any': 'error',
      'no-implicit-any': 'error',
      // Console and debug controls
      'no-console': 'warn',
      'no-debugger': 'error',
      // Variable declarations
      'no-unused-vars': 'error',
      'no-vars': 'off',
      'no-restricted-syntax': [
        'error',
        'ForInStatement',
        'LabeledStatement',
        'WithStatement',
      ],
      // Unicorn best practices
      'unicorn/prefer-spread': 'warn',
      'unicorn/prefer-regex-test': 'warn',
      'unicorn/escape-case': 'warn',
      'unicorn/filename-case': ['error', { casing: 'camelCase', validExceptions: ['zustand'] }],
      // React specific
      'react/jsx-no-literals': 'warn',
      'react/prop-types': 'off',
      'react/display-name': 'off',
      'react/no-unknown-property': 'warn',
      // Import/Export
      'import/no-unresolved': 'warn',
      'import/extensions': ['error', 'always', { 'js': ['.js', ' .mjs'] }],
      'no-empty-pattern': 'error',
      'no-constant-condition': ['error', { allowProtectedBlocks: true }],
    }
  }
);
