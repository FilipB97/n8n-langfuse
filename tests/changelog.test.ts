import { test } from 'node:test';
import assert from 'node:assert/strict';

import { extractChangelogSection } from '../scripts/changelog-section.mjs';

const sample = [
  '# Changelog',
  '',
  '## [Unreleased]',
  '',
  '## [1.5.0] - 2026-06-04',
  '',
  '### Added',
  '',
  '- Feature A',
  '- Feature B',
  '',
  '## [1.4.1] - 2026-06-04',
  '',
  '### Fixed',
  '',
  '- Bug X',
  '',
  '[1.5.0]: https://example.com/v/1.5.0',
  '[1.4.1]: https://example.com/v/1.4.1',
  '',
].join('\n');

test('extractChangelogSection returns the body for a version and stops at the next one', () => {
  const section = extractChangelogSection(sample, '1.5.0');
  assert.match(section, /### Added/);
  assert.match(section, /- Feature A/);
  assert.match(section, /- Feature B/);
  assert.doesNotMatch(section, /1\.4\.1/);
  assert.doesNotMatch(section, /Bug X/);
});

test('extractChangelogSection strips trailing link-reference definitions', () => {
  const section = extractChangelogSection(sample, '1.4.1');
  assert.match(section, /- Bug X/);
  assert.doesNotMatch(section, /https:\/\/example\.com/);
});

test('extractChangelogSection returns undefined for an unknown version', () => {
  assert.equal(extractChangelogSection(sample, '9.9.9'), undefined);
});
