# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

`n8n-nodes-langfuse-studio` ships three n8n nodes plus one credential:

- **`Langfuse`** (`nodes/Langfuse`) — the main action node, talking to Langfuse two ways via its `Resource` dropdown:
  - **Ingestion** (`resource: 'ingestion'`) — writes the legacy ingestion batch API: trace/span/generation/event/score/sdk-log creates and updates, plus a raw batch escape hatch.
  - **Public API** (`resource: 'publicApi'`) — reads health, prompts, traces, scores, observations, sessions, datasets, annotation queues, plus a custom-request escape hatch.
  - It is versioned: V1 keeps the legacy `ingestion | publicApi` resource layout, V2 exposes an entity-based resource layout (trace/span/generation/score/…). Both share one `execute`.
- **`LangfuseAi`** (`nodes/LangfuseAi`) — convenience node that fetches a Langfuse prompt (optional), calls an LLM, and logs the trace + generation to Langfuse automatically. Supports an OpenAI or Anthropic `Provider` (selecting which credential is required) and a free-text `Model` field. Logging is awaited but non-fatal: the AI call still succeeds if ingestion fails, and the outcome is reported on the output (`logged` / `loggingError`). Failed model calls are also logged to Langfuse as an `ERROR` generation.
- **`LangfuseTrigger`** (`nodes/LangfuseTrigger`) — a polling trigger that emits new traces/scores/observations.

The `Langfuse`/`LangfuseTrigger` nodes authenticate with the `langfuseApi` credential (HTTP Basic Auth: username = Langfuse public key, password = secret key). `LangfuseAi` additionally uses n8n's built-in `openAiApi` or `anthropicApi` credential depending on the selected provider.

## Commands

The build/test scripts deliberately resolve their tooling from the **parent** directory's `node_modules` (`node ../node_modules/typescript/bin/tsc`, `node ../node_modules/tsx/dist/cli.mjs`). This package has no `dependencies`/`devDependencies` of its own — it expects to live inside a workspace that provides `typescript` and `tsx`. Run npm scripts rather than bare `tsc`/`tsx`, or invoke the binaries with the same `../node_modules/...` paths if a script doesn't fit.

```bash
npm run compile   # clean dist/, tsc -p ., then copy .svg assets into dist/
npm test          # node --test over tests/**/*.test.ts via tsx
npm run lint      # tsc -p . --noEmit (type-check only; there is no ESLint)
npm run package   # alias for compile; follow with `npm pack --dry-run` to inspect the tarball
```

Run a single test file:

```bash
node ../node_modules/tsx/dist/cli.mjs --test tests/nodeLogic.test.ts
```

Publishing is automated by `.github/workflows/publish.yml`: pushing a `v*` tag (or manual dispatch) checks out, builds with a pinned `typescript`, copies assets, runs the tests, then `npm publish`. There is no `prepublishOnly`, so the workflow's build step is what produces the published `dist/`.

## Architecture

The code is layered so the Langfuse logic stays unit-testable without an n8n runtime. From the bottom up:

1. **`src/langfuse.ts`** — pure ingestion core. URL builders (`buildIngestionUrl`, `buildPromptUrl`), auth header, ID/timestamp generators, the `create*Event` payload builders that turn typed `*EventInput` into `IngestionEvent`s, and the `fetch`-based transports (`sendLangfuseIngestion`, `fetchLangfusePrompt`). No n8n imports.
2. **`src/langfusePublicApi.ts`** — pure Public API core. `resolveLangfusePublicApiEndpoint` maps an operation enum to `{ path, method, query, body }`; `requestLangfusePublicApi` executes it. Also n8n-free.
3. **`src/nodeLogic.ts`** — the ingestion mapping layer. `buildEventsForOperation` switches on `LangfuseOperation` and converts the flat, string-heavy `LangfuseOperationParameters` (what the UI produces) into typed event inputs, then calls the `src/langfuse.ts` builders. `finalizeSpan` is the one operation that emits **two** events (a generation-create + a span-update).
4. **`nodes/Langfuse/Langfuse.node.ts`** — the only n8n surface. Holds the full `description` (all properties/displayOptions), reads parameters off the execute context, dispatches to layers 2–3, and shapes the output items. `credentials/LangfuseApi.credentials.ts` defines the `langfuseApi` credential.

**`src/n8n-lite.ts` is intentional, not a stopgap.** It hand-declares the slice of n8n's node/credential interfaces this package uses (`NodeDescription`, `LangfuseExecuteContext`, etc.) so the **pure layer (`src/**`) never imports `n8n-workflow`**, keeping the core unit-testable and free of runtime deps. If you need an n8n capability that isn't typed here, add it to `n8n-lite.ts` rather than pulling the real package into `src/`.

The **node layer (`nodes/**`) may import `n8n-workflow`** — it uses `NodeOperationError` / `NodeApiError` so `execute` surfaces failures the way the editor expects (clickable item context, retry semantics). `n8n-workflow` is a **devDependency only**: it is present for build/lint/tests but is *not* a runtime `dependency` (n8n provides it as a peer at runtime), so the package keeps its zero-runtime-deps property. `LangfuseExecuteContext.getNode()` is optional on the lite type; the node layer casts its result to n8n-workflow's `INode` and falls back to a minimal node descriptor when absent (e.g. in tests).

`index.ts` → `src/index.ts` re-export everything, including the `Langfuse` node class and `LangfuseApi` credential class. `package.json`'s `n8n` block points n8n at the compiled `dist/` versions of those two classes.

## Conventions that will bite you if ignored

- **ESM + `NodeNext`.** Every relative import must carry a `.js` extension even though the source is `.ts` (e.g. `import { ... } from './langfuse.js'`). Tests import `../src/nodeLogic.js`, not `.ts`.
- **`exactOptionalPropertyTypes` is on.** Don't assign `undefined` to an optional field. The established pattern (everywhere in `nodeLogic.ts` and the `create*Event` builders) is to compute a value, then conditionally assign only when it's defined: `if (x !== undefined) obj.x = x;`. Spreading is done the same way: `...(query !== undefined ? { query } : {})`.
- **JSON fields accept a string or an already-parsed value.** `parseJsonMaybe` (in `langfuse.ts`) leaves non-strings untouched and only `JSON.parse`s strings that look like JSON, falling back to the raw string on failure. Route any new "...JSON" parameter through it.
- **Adding an ingestion operation** means touching three places in lockstep: the `LangfuseOperation` union and a `to*Input`/`case` in `src/nodeLogic.ts`, an event builder in `src/langfuse.ts` if the shape is new, and the property/displayOptions entries in `Langfuse.node.ts`. Adding a Public API operation means a `case` in `resolveLangfusePublicApiEndpoint`, a branch in `buildPublicApiParameters`, and node properties.
- **Advanced-field gating.** Properties shown only when `Show Advanced Fields` is on use the `showIngestionAdvanced`/`showPublicApiAdvanced` helpers (note `showIngestion`/`showPublicApi` are aliases for the *advanced* variants). Because hidden params may not exist on an item, the node reads them through `getOptionalNodeParameter`, which swallows n8n's "Could not get parameter" error and returns `undefined`. Use it for any non-guaranteed parameter.
- **`207 Multi-Status` is success.** `sendLangfuseIngestion` treats 207 as `ok` and surfaces partial failures in `response.errors`. The node only throws on them when the user enables `Fail On Batch Errors`. Per-item failures otherwise honor n8n's `continueOnFail`.
- **Base-URL normalization.** All URL builders strip a trailing slash and tolerate a base URL that already ends in `/api/public`, so credentials can be configured either way.

## Tests

Plain `node:test` + `assert/strict`, run through `tsx`. They cover the pure layers directly — payload building, tag parsing, URL/auth helpers, JSON normalization, 207 handling, and Public API endpoint resolution — by importing from `../src/*.js`. Add tests at that layer (against `nodeLogic.ts` / `langfuse.ts` / `langfusePublicApi.ts`) rather than trying to stand up the node. Transports take an injectable `fetchImpl` for stubbing in tests.

Reference docs live in `docs/` (`api-coverage.md`, `public-api-coverage.md`, `examples.md`, `quick-test.md`, `development.md`).
