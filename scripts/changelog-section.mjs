// Extract the release-notes body for a single version from CHANGELOG.md.
// Used by the publish workflow to populate GitHub Release notes, and unit-tested.
//
// Usage: node scripts/changelog-section.mjs <version>
//   e.g. node scripts/changelog-section.mjs 1.5.0
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const VERSION_HEADER = /^##\s+\[([^\]]+)\]/;
const LINK_REFERENCE = /^\[[^\]]+\]:\s/;

/**
 * Return the lines of the `## [version]` section (without the heading itself),
 * or `undefined` if the version is not present. Trailing blank lines and the
 * Markdown link-reference block at the bottom are stripped.
 */
export function extractChangelogSection(changelog, version) {
  const lines = changelog.split('\n');
  let start = -1;
  let end = lines.length;

  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(VERSION_HEADER);
    if (!match) {
      continue;
    }
    if (match[1] === version && start === -1) {
      start = i + 1;
    } else if (start !== -1) {
      end = i;
      break;
    }
  }

  if (start === -1) {
    return undefined;
  }

  const section = lines.slice(start, end);
  while (section.length > 0 && (section[section.length - 1].trim() === '' || LINK_REFERENCE.test(section[section.length - 1]))) {
    section.pop();
  }
  while (section.length > 0 && section[0].trim() === '') {
    section.shift();
  }

  return section.join('\n');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const version = process.argv[2];
  if (!version) {
    console.error('usage: node scripts/changelog-section.mjs <version>');
    process.exit(1);
  }

  const changelog = readFileSync(new URL('../CHANGELOG.md', import.meta.url), 'utf8');
  const section = extractChangelogSection(changelog, version);
  if (section === undefined || section.trim() === '') {
    console.error(`No CHANGELOG section found for ${version}`);
    process.exit(1);
  }

  process.stdout.write(`${section}\n`);
}
