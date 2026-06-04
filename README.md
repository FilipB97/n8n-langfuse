# n8n Langfuse

A custom n8n community node for Langfuse. The node is **versioned**:

- **v2 (default)** groups actions by entity — `Trace`, `Span`, `Generation`, `Score`, `Prompt`, `Session`, `Observation`, `Annotation Queue`, `Dataset`, `Dataset Item`, `Dataset Run`, and `System` — so the operation list under each resource stays short and focused.
- **v1** keeps the original two-resource layout (`Ingestion` / `Public API`). Existing workflows built on v1 keep working unchanged.

Langfuse treats the Ingestion API as a legacy path and recommends OpenTelemetry for future telemetry integrations. This node is still useful when you want direct control over ingestion payloads or when you need to read Langfuse data from inside a workflow.

## What It Does

### Writes (ingestion events)

- `Trace Create`
- `Span Create` / `Span Update`
- `Generation Create` / `Generation Update`
- `Finalize Span` (generation-create + span-update in one batch)
- `Event Create`
- `Score Create`
- `SDK Log Create`
- `Batch Raw`

`Trace Create`, `Span Create`, `Generation Create`, and `Event Create` accept an optional `Environment` label.

### Reads (Public API)

- `Health`
- `List Prompts` / `Get Prompt` / `Create Prompt` (text or chat, with labels, tags, config, and commit message)
- `List Traces` / `Get Trace`
- `List Scores` / `Get Score` / `Delete Score`
- `List Observations` / `Get Observation`
- `List Sessions`
- `List Annotation Queues` / `Get Annotation Queue`
- `Custom Request`

### Datasets (Public API, v2 only)

For building and running LLM evaluation sets:

- `Dataset`: `Create` / `Get` / `List`
- `Dataset Item`: `Create` (upsert) / `Get` / `List` / `Delete`
- `Dataset Run`: `List` / `Get` / `Delete` / `Create Run Item`

A typical eval loop: create a dataset → add items → run your workflow per item → link each result with `Create Run Item` → read results via `Get Dataset Run`.

All requests retry automatically with exponential backoff on retryable responses (`429`, `500`, `502`, `503`, `504`).

## Trigger node

The package also ships a **Langfuse Trigger** node that starts a workflow when new records appear in Langfuse. It polls the Public API and emits new items per poll. Pick an event:

- `New Trace`
- `New Score`
- `New Observation`

The first poll establishes a baseline (it does not replay history); later polls emit only records created since the previous poll, de-duplicated by id. Use the editor's *Fetch Test Event* to pull one recent record without affecting the cursor.

## Installation

### From npm

1. Build the package:
   ```bash
   npm run compile
   ```
2. Publish `n8n-nodes-langfuse-studio` to npm.
3. In n8n, open Community Nodes and install `n8n-nodes-langfuse-studio`.

### Local development

1. Run:
   ```bash
   npm run compile
   ```
2. Copy or link the package into your local n8n custom nodes directory.
3. Restart n8n.

## Credentials

Create `Langfuse API` credentials with:

- `Base URL` - defaults to `https://cloud.langfuse.com`
- `Public Key`
- `Secret Key`
- `Timeout MS`

Langfuse uses Basic Auth:

- username = public key
- password = secret key

## Quick Start

1. Add the `Langfuse` node.
2. Pick a `Resource`, then choose an `Operation`.
3. Fill in the core fields required by that operation.
4. Turn on `Show Advanced Fields` if you need less common options. Hidden advanced fields are safe to leave blank and will not be read unless you enable them.
5. Select the `Langfuse API` credential.
6. Run the workflow.

## Examples

See:

- [Full demo workflow](docs/example-workflow.md) — importable n8n workflow that runs every operation end-to-end with a real OpenAI call ([`example-workflow.json`](docs/example-workflow.json))
- [Dataset evaluation workflow](docs/example-eval-workflow.md) — importable LLM evaluation loop using datasets, dataset runs, and scores ([`example-eval-workflow.json`](docs/example-eval-workflow.json))
- [Examples](docs/examples.md)
- [Quick test](docs/quick-test.md)
- [Ingestion coverage](docs/api-coverage.md)
- [Public API coverage](docs/public-api-coverage.md)
- [Development](docs/development.md)
- [Changelog](CHANGELOG.md)

## Supported Behavior

- JSON fields accept either JSON strings or already-parsed objects
- `Trace Create` auto-generates a trace id when `Trace ID` is left blank
- `Span Create`, `Generation Create`, `Event Create`, and `SDK Log Create` auto-generate observation ids when needed
- `Span Update`, `Generation Update`, and `Finalize Span` require an `Observation ID`
- `Score Create` requires a score value plus either a trace id or a session id
- `timestamp` is generated automatically when missing
- `207 Multi-Status` responses are treated as valid ingestion responses
- partial ingestion errors are returned in the output and can optionally fail the item

## Build and Test

```bash
npm run compile
npm test
```

## Notes

- This package is prepared as a public community node for npm.
- For brand-new telemetry integrations, Langfuse recommends OpenTelemetry, but direct ingestion and Public API access remain useful for explicit workflow control.
