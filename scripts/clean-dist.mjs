import { rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const distPath = resolve(projectRoot, 'dist');

rmSync(distPath, { recursive: true, force: true });
