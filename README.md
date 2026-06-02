# n8n Langfuse

A custom n8n community node for Langfuse, built as a single node with grouped actions:

- `Resource = Ingestion` for trace, span, generation, event, score, SDK log, and raw batch writes
- `Resource = Public API` for health, prompts, traces, scores, observations, annotation queues, and custom requests

Langfuse treats the Ingestion API as a legacy path and recommends OpenTelemetry for future telemetry integrations. This node is still useful when you want direct control over ingestion payloads or when you need to read Langfuse data from inside a workflow.

## What It Does

### Ingestion

- `Trace Create`
- `Span Create`
- `Span Update`
- `Generation Create`
- `Generation Update`
- `Finalize Span`
- `Event Create`
- `Score Create`
- `SDK Log Create`
- `Batch Raw`

### Public API

- `Health`
- `List Prompts`
- `Get Prompt`
- `List Traces`
- `Get Trace`
- `List Scores`
- `Get Score`
- `List Observations`
- `List Annotation Queues`
- `Get Annotation Queue`
- `Custom Request`

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

- [Examples](docs/examples.md)
- [Quick test](docs/quick-test.md)
- [Ingestion coverage](docs/api-coverage.md)
- [Public API coverage](docs/public-api-coverage.md)
- [Development](docs/development.md)

## Supported Behavior

- JSON fields accept either JSON strings or already-parsed objects
- `Trace Create` auto-generates a trace id when `Trace ID` is left blank
- `Span Create`, `Generation Create`, `Event Create`, and `SDK Log Create` auto-generate observation ids when needed
- `Span Update`, `Generation Update`, and `Finalize Span` require an `Observation ID`
- `Score Create` requires a trace id and score value
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
