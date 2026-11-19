const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const globals = require('globals');

module.exports = defineConfig([
  expoConfig,
  { ignores: ['dist/*'] },
  {
    files: ['**/__tests__/**/*.{js,jsx}', '**/*-test.{js,jsx}'],
    languageOptions: { globals: globals.jest },
  },
]);
