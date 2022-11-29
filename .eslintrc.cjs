/* eslint-env node */

module.exports = {
  parserOptions: {
    sourceType: 'module',
    ecmaVersion: 2021,
  },
  extends: ['eslint:recommended', 'prettier'],
  plugins: ['prettier'],
  env: {
    node: true,
    es6: true,
  },
  rules: {
    'prettier/prettier': 'error',
    'no-use-before-define': 'off',
    'prefer-const': 'off',
    'no-useless-rename': 'error',
    quotes: ['error', 'single', { avoidEscape: true }],
    'no-useless-concat': 'error',
    'prefer-template': 'error',
    'object-shorthand': 'error',
    'no-prototype-builtins': 'off',
    'no-empty': ['error', { allowEmptyCatch: true }],
  },
}
