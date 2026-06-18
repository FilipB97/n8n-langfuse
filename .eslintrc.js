/**
 * ESLint config for the n8n community node.
 * Uses the official eslint-plugin-n8n-nodes-base to enforce n8n node/credential
 * conventions (display names, option ordering, descriptions, etc.).
 */
module.exports = {
  root: true,
  env: { es2021: true, node: true },
  parser: '@typescript-eslint/parser',
  parserOptions: { ecmaVersion: 2021, sourceType: 'module' },
  ignorePatterns: ['.eslintrc.js', '**/*.js', '**/*.mjs', 'node_modules/**', 'dist/**'],
  overrides: [
    {
      files: ['credentials/**/*.ts'],
      plugins: ['eslint-plugin-n8n-nodes-base'],
      extends: ['plugin:n8n-nodes-base/credentials'],
    },
    {
      files: ['nodes/**/*.ts'],
      plugins: ['eslint-plugin-n8n-nodes-base'],
      extends: ['plugin:n8n-nodes-base/nodes'],
    },
  ],
};
