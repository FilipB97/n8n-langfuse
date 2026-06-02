import { copyFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const assets = [
  ['nodes/Langfuse/langfuse.svg', 'dist/nodes/Langfuse/langfuse.svg'],
  ['credentials/langfuse.svg', 'dist/credentials/langfuse.svg'],
];

for (const [source, target] of assets) {
  const sourcePath = resolve(projectRoot, source);
  const targetPath = resolve(projectRoot, target);
  mkdirSync(dirname(targetPath), { recursive: true });
  copyFileSync(sourcePath, targetPath);
}
