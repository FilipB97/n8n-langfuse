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
      rules: {
        // This node runs on a framework-agnostic execution layer (src/n8n-lite.ts)
        // and intentionally does not depend on `n8n-workflow`, so it throws plain
        // Error instead of NodeOperationError/NodeApiError.
        'n8n-nodes-base/node-execute-block-wrong-error-thrown': 'off',
      },
    },
  ],
};
