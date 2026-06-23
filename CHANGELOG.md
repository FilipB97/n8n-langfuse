# Changelog

All notable changes to `n8n-nodes-langfuse-studio` are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.8.1] - 2026-06-19

### Fixed

- **Ingestion output now returns the written ids (`traceId`, `ids`, `eventIds`).** Previously the node never surfaced the trace/observation ids it sent, so when a trace used an auto-generated id you couldn't reliably attach a later span/score to it — the span would create its own trace and appear disconnected. Expressions can now read `{{$json.traceId}}` / `{{$json.ids[0]}}` to chain operations. (Reminder: `sessionId` is a trace-level field — set it on Trace Create, not on a span.)

## [1.8.0] - 2026-06-19

### Added

- **`LangfuseAi` — Anthropic provider.** New `Provider` selector (OpenAI | Anthropic). The matching credential (`openAiApi` / `anthropicApi`) is requested based on the selection, and the call targets the Anthropic Messages API when Anthropic is chosen.
- **`LangfuseAi` — free-text `Model` field.** Any model the provider exposes can be entered (e.g. `gpt-4o`, `gpt-4o-mini`, `claude-opus-4-8`, `claude-sonnet-4-6`, `claude-haiku-4-5`), replacing the fixed dropdown so new models don't require a node release.
- **`LangfuseAi` — `Base URL` override (advanced).** Point the OpenAI provider at any OpenAI-compatible endpoint (Gemini's OpenAI API, OpenRouter, Together, Ollama).
- **`Langfuse` — "Return All" for list operations.** Opt-in auto-pagination walks every page of a Public API list endpoint and returns all matching records. Default off, so existing single-page behavior is unchanged.

### Changed

- **`LangfuseAi` — logging is now awaited but non-fatal.** The AI call still succeeds if Langfuse ingestion fails; the outcome is reported on the output (`logged` / `loggingError`) instead of being silently dropped. Failed model calls are also logged to Langfuse as an `ERROR` generation. The model call now has retry (429/5xx) and timeout handling.
- **`Langfuse` — richer `Continue On Fail` errors.** Failed API calls now include the HTTP `status` and response `errorBody` on the item, not just the message.
- **New Langfuse logo** used as the icon for all nodes and the credential.

### Fixed

- **Credential test base URL.** The credential test now strips a trailing slash and an existing `/api/public` suffix, matching the runtime URL builders, so the test no longer fails when the base URL already ends in `/api/public`.

### Internal

- CI hardened: zero-warning lint gate, Node 20 + 22 matrix, build + packaged-content verification, `engines.node >= 20.19`, and `docs/verification-readiness.md` tracking the path to an n8n verified community node.

## [1.7.1] - 2026-06-09

### Fixed

- **`LangfuseAi` node — complete Langfuse tracing.**
  - The prompt version number is now extracted from the Langfuse prompt response and logged to the generation (`promptVersion`), so Langfuse links each generation to the exact prompt version used.
  - `modelParameters` (temperature, `max_tokens`) are now logged to the generation for full reproducibility.
- **`LangfuseAi` node — multi-turn conversations.** Added `Previous Messages (JSON)` field (under Show Advanced Fields). Pass the `messages` output from a previous Langfuse AI node directly into this field to continue a multi-turn chat. The node now outputs a `messages` array containing the full conversation including the assistant reply.

## [1.7.0] - 2026-06-09

### Added

- **`Langfuse AI` node.** An all-in-one node that fetches a Langfuse prompt, calls an
  OpenAI model, and logs the trace and generation to Langfuse automatically.
  - Uses both `Langfuse API` and `OpenAI API` credentials.
  - Supported models: `gpt-4o`, `gpt-4o-mini`, `gpt-4 Turbo`, `gpt-3.5-turbo`.
  - **Prompt from Langfuse**: set **Prompt Name** to fetch a `text` or `chat` prompt and
    substitute `{{variable}}` placeholders via **Prompt Variables (JSON)**. When blank,
    the optional **System Message** field is used instead.
  - **Advanced fields** (toggle): Prompt Label, Prompt Version, Temperature, Max Tokens,
    Trace Name, Session ID, User ID, Tags, Environment.
  - Langfuse ingestion (trace + generation) is fire-and-forget — a Langfuse failure
    never blocks the OpenAI response.
  - Returns `content`, `traceId`, `generationId`, `model`, and `usage`
    (`promptTokens`, `completionTokens`, `totalTokens`).

## [1.6.1] - 2026-06-04

### Changed

- **Improved node picker descriptions.** The `Langfuse` and `Langfuse Trigger` nodes now
  show a clear, specific description in the n8n node picker instead of the previous
  generic placeholder text.
- **Updated README** to reflect all operations added since 1.5.0: `Get Session`,
  `List`/`Get Score Configs`, `List Annotation Queue Items`, and the five-lane demo workflow.

## [1.6.0] - 2026-06-04

### Added

- **`Get Session`** Public API operation (`GET /api/public/sessions/{sessionId}`).
- **`List Score Configs`** and **`Get Score Config`** Public API operations
  (`GET /api/public/score-configs` and `GET /api/public/score-configs/{configId}`).
  Score configs define the scoring schema (name, data type, categories) and their
  IDs can now be referenced from `Score Create`.
- **`List Annotation Queue Items`** Public API operation
  (`GET /api/public/annotation-queue/{id}/items`), completing the Annotation Queue
  resource alongside the existing List / Get queue operations.

## [1.5.1] - 2026-06-04

### Changed

- **Reworked the demo workflow into five readable lanes.** `docs/example-workflow.json`
  now fans out from `Manual → Setup → OpenAI` into five parallel, colored lanes —
  ingestion (writes + wait), Public API reads, datasets, prompts, and a dedicated
  **round-trip verification** lane (Get Trace / Observation / Score + Delete Score)
  that starts after the Wait node. Generated by `scripts/gen-example-workflow.mjs`.
- **Hardened the release process.** The publish workflow now publishes
  idempotently — it skips when `name@version` is already on npm, so re-runs and
  tag pushes never fail on "version already exists" — and, on a `v*` tag push,
  creates a GitHub Release whose notes are extracted from the matching
  `CHANGELOG.md` section (`scripts/changelog-section.mjs`, with tests). The
  tag-driven release flow is documented in `docs/development.md`.

### Fixed

- CHANGELOG version links now point to the npm version pages, which resolve for
  every published version.

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

[Unreleased]: https://github.com/FilipB97/n8n-langfuse/commits/main
[1.7.1]: https://www.npmjs.com/package/n8n-nodes-langfuse-studio/v/1.7.1
[1.7.0]: https://www.npmjs.com/package/n8n-nodes-langfuse-studio/v/1.7.0
[1.6.1]: https://www.npmjs.com/package/n8n-nodes-langfuse-studio/v/1.6.1
[1.6.0]: https://www.npmjs.com/package/n8n-nodes-langfuse-studio/v/1.6.0
[1.5.1]: https://www.npmjs.com/package/n8n-nodes-langfuse-studio/v/1.5.1
[1.5.0]: https://www.npmjs.com/package/n8n-nodes-langfuse-studio/v/1.5.0
[1.4.1]: https://www.npmjs.com/package/n8n-nodes-langfuse-studio/v/1.4.1
[1.4.0]: https://www.npmjs.com/package/n8n-nodes-langfuse-studio/v/1.4.0
[1.3.0]: https://www.npmjs.com/package/n8n-nodes-langfuse-studio/v/1.3.0
[1.2.0]: https://www.npmjs.com/package/n8n-nodes-langfuse-studio/v/1.2.0
[1.1.0]: https://www.npmjs.com/package/n8n-nodes-langfuse-studio/v/1.1.0
[1.0.5]: https://www.npmjs.com/package/n8n-nodes-langfuse-studio/v/1.0.5
