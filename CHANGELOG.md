# Changelog

All notable changes to `n8n-nodes-langfuse-studio` are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.5.0] - 2026-06-04

### Added

- **Langfuse Trigger node.** A new polling trigger that starts a workflow when
  new `New Trace`, `New Score`, or `New Observation` records appear in Langfuse.
  The first poll establishes a baseline; later polls emit only new records since
  the last poll, de-duplicated by id. Traces and scores filter by `fromTimestamp`,
  observations by `fromStartTime`. Manual mode returns one recent record without
  advancing the cursor.
- **Create Prompt** operation (node v2, `POST /api/public/v2/prompts`). Creates a
  prompt or a new version of an existing one. Supports both `text` and `chat`
  prompt types, plus optional `labels`, `tags`, `config`, and `commitMessage`.
  This completes the Prompt resource to full read + write.

## [1.4.1] - 2026-06-04

### Added

- **Official n8n linting.** Adopted `eslint-plugin-n8n-nodes-base` to enforce
  node/credential conventions (description style, `ID` casing, option ordering,
  boolean phrasing). Runs via `npm run lint` and in CI.
- **Execute-layer tests.** New `tests/nodeExecute.test.ts` exercises the node's
  `runExecute` end-to-end with a mock context and stubbed `fetch`: operation
  routing (ingestion vs Public API), POST body construction, `pairedItem`
  tagging, and `continueOnFail` behavior.

### Changed

- Applied the n8n lint conventions across the node UI: trimmed trailing periods,
  fixed `ID` casing, alphabetized option lists, and reworded boolean field
  descriptions to start with "Whether". No functional change to operations.

## [1.4.0] - 2026-06-04

### Added

- **Dataset evaluation example workflow** (`docs/example-eval-workflow.json`) — an
  importable LLM evaluation loop that runs OpenAI over a set of test cases and
  records traces, dataset items, dataset run items, and exact-match scores.

### Changed

- The node now sets `pairedItem` on every output, so multi-item workflows can
  reliably reference per-item values across nodes (e.g. `$('Node').item`).

## [1.3.0] - 2026-06-04

### Added

- **Dataset API support (node v2).** Three new entity resources cover the full
  Langfuse evaluation loop:
  - **Dataset** — `Create`, `Get`, `List` (`/api/public/v2/datasets`).
  - **Dataset Item** — `Create` (upsert), `Get`, `List`, `Delete`
    (`/api/public/dataset-items`).
  - **Dataset Run** — `List`, `Get`, `Delete`, and `Create Run Item`
    (`/api/public/datasets/{name}/runs` and `/api/public/dataset-run-items`).

### Fixed

- npm scripts (`compile`, `test`, `lint`) now resolve `tsc`/`tsx` from the local
  `node_modules/.bin` (via the bare binary name) instead of a hard-coded
  `../node_modules` path, so `npm install && npm test` works from a fresh clone.

## [1.2.0] - 2026-06-04

### Added

- **Versioned node.** The `Langfuse` node now ships as a versioned node type.
  - **v2 (default)** groups operations by entity — `Trace`, `Span`, `Generation`,
    `Score`, `Prompt`, `Session`, `Observation`, `Annotation Queue`, and `System` —
    so each resource exposes a short, focused operation list instead of two long ones.
  - **v1** keeps the original two-resource layout (`Ingestion` / `Public API`).
    Existing workflows built on v1 keep working unchanged.
- **`Delete Score`** Public API operation (`DELETE /api/public/v2/scores/{scoreId}`).
- **Automatic retries.** All ingestion and Public API requests now retry with
  exponential backoff on retryable responses (`429`, `500`, `502`, `503`, `504`).
- **Full end-to-end example workflow** (`docs/example-workflow.json` +
  `docs/example-workflow.md`) — an importable n8n workflow that exercises every
  operation in one run, driven by a real OpenAI (LangChain) call.

### Changed

- Reorganized the node UI around entity-based resources (v2) for clearer navigation.
- Refreshed `README.md` and the coverage docs to describe the versioned layout.

## [1.1.0] - 2026-06-03

### Added

- **`Get Observation`** Public API operation
  (`GET /api/public/v2/observations/{observationId}`).
- **`List Sessions`** Public API operation (`GET /api/public/sessions`).
- **`Environment`** label support on ingestion operations (`Trace Create`,
  `Span Create`, `Generation Create`, `Event Create`).
- `HEAD` method support and suppression of request bodies for `GET`/`HEAD`
  Public API requests.

### Fixed

- **`Score Create`** no longer hard-requires a `traceId`. A score can now be
  created against a session, so the node only requires *either* a trace id *or*
  a session id (matching the Langfuse API).

### CI

- Fixed the npm publish workflow and added a CI workflow that runs on pull requests.

## [1.0.5] - 2026-06-02

### Added

- Initial published release of the Langfuse community node.
- Ingestion operations: `Trace Create`, `Span Create`/`Update`,
  `Generation Create`/`Update`, `Finalize Span`, `Event Create`, `Score Create`,
  `SDK Log Create`, `Batch Raw`.
- Public API operations: `Health`, `List`/`Get Prompt`, `List`/`Get Trace`,
  `List`/`Get Score`, `List Observations`, `List`/`Get Annotation Queue`,
  `Custom Request`.
- `Langfuse API` credentials (Base URL, Public Key, Secret Key, Timeout) using
  Basic Auth.

[Unreleased]: https://github.com/FilipB97/n8n-langfuse/compare/v1.5.0...HEAD
[1.5.0]: https://github.com/FilipB97/n8n-langfuse/releases/tag/v1.5.0
[1.4.1]: https://github.com/FilipB97/n8n-langfuse/releases/tag/v1.4.1
[1.4.0]: https://github.com/FilipB97/n8n-langfuse/releases/tag/v1.4.0
[1.3.0]: https://github.com/FilipB97/n8n-langfuse/releases/tag/v1.3.0
[1.2.0]: https://github.com/FilipB97/n8n-langfuse/releases/tag/v1.2.0
[1.1.0]: https://github.com/FilipB97/n8n-langfuse/releases/tag/v1.1.0
[1.0.5]: https://github.com/FilipB97/n8n-langfuse/releases/tag/v1.0.5
