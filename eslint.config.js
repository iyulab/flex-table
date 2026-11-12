import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import litPlugin from 'eslint-plugin-lit';
import reactHooks from 'eslint-plugin-react-hooks';

export default [
  {
    ignores: ['dist/**', 'node_modules/**', 'demo/**', '*.config.*'],
  },
  {
    files: ['src/**/*.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      lit: litPlugin,
      // 게시되는 React 훅(`useArraySource` · `useODataSource`)의 규칙. 훅이 없는 파일에서는 발화하지 않으므로 대상을 열거하지 않고 src 전체에 건다.
      'react-hooks': reactHooks,
    },
    rules: {
      // TypeScript
      '@typescript-eslint/no-unused-vars': ['warn', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
      }],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/explicit-member-accessibility': 'off',

      // Lit
      'lit/no-legacy-template-syntax': 'error',
      'lit/no-useless-template-literals': 'warn',
      'lit/attribute-names': 'warn',

      // React hooks
      ...reactHooks.configs['recommended-latest'].rules,

      // General
      'no-console': 'warn',
      'no-debugger': 'error',
      'prefer-const': 'warn',
      'eqeqeq': ['warn', 'smart'],
    },
  },
  {
    files: ['src/**/*.test.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      'no-console': 'off',
    },
  },
];
