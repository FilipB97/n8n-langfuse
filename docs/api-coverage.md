# Ingestion coverage

This coverage map applies to the unified `Langfuse` node when you choose `Resource = Ingestion`.

| Operation | Langfuse event type | Required input | Optional input | Notes |
| --- | --- | --- | --- | --- |
| `Trace Create` | `trace-create` | `traceId` or auto-generated | `name`, `userId`, `sessionId`, `public`, `tags`, `inputJson`, `outputJson`, `metadataJson`, `version`, `timestamp`, `eventId` | `traceId` becomes `body.id`; leave it blank to auto-generate a new trace |
| `Span Create` | `span-create` | `observationId` or auto-generated | `traceId`, `parentObservationId`, `name`, `inputJson`, `outputJson`, `metadataJson`, `version`, `level`, `statusMessage`, `timestamp`, `eventId` | Supports child spans |
| `Span Update` | `span-update` | `observationId` | Same as create | Uses the same body shape as create, but with a different event type |
| `Generation Create` | `generation-create` | `observationId` or auto-generated | `traceId`, `parentObservationId`, `name`, `inputJson`, `outputJson`, `metadataJson`, `version`, `level`, `statusMessage`, `model`, `modelParametersJson`, `promptTokens`, `completionTokens`, `totalTokens`, `usageDetailsJson`, `costDetailsJson`, `completionStartTime`, `timestamp`, `eventId` | Useful for model calls and cost tracking |
| `Generation Update` | `generation-update` | `observationId` | Same as create | Updates an existing generation |
| `Finalize Span` | `generation-create` + `span-update` | `observationId`, optional `generationObservationId` | `traceId`, `name`, `model`, `inputJson`, `outputJson`, `promptTokens`, `completionTokens`, `totalTokens`, `usageDetailsJson`, `costDetailsJson`, `promptName`, `promptVersion`, `promptLabelsJson`, `startTime`, `endTime`, `timestamp` | Sends one batch with two items, both pointing at the same `traceId`, and requires the span `observationId` |
| `Event Create` | `event-create` | `observationId` or auto-generated | `traceId`, `parentObservationId`, `name`, `inputJson`, `outputJson`, `metadataJson`, `version`, `level`, `statusMessage`, `timestamp`, `eventId` | For custom events |
| `Score Create` | `score-create` | `scoreName`, `scoreValue`, `traceId` or `scoreTraceId` | `scoreId`, `scoreObservationId`, `scoreSessionId`, `scoreDatasetRunId`, `scoreDataType`, `scoreComment`, `scoreConfigId`, `scoreEnvironment`, `metadataJson`, `timestamp`, `eventId` | `scoreValue` is parsed from JSON, so `0.95`, `true`, and `"text"` are supported |
| `SDK Log Create` | `sdk-log` | `sdkMessage` | `traceId`, `observationId`, `parentObservationId`, `sdkLevel`, `name`, `metadataJson`, `timestamp`, `eventId` | Lightweight diagnostic event |
| `Batch Raw` | raw batch payload | `batchJson` | none - payload is sent as-is | Useful when another system already built the Langfuse batch |

All ingestion create operations (`Trace Create`, `Span Create`, `Generation Create`, `Event Create`) also accept an optional `environment` label.

## Shared behavior

- `Base URL` from the credential is normalized by removing a trailing slash
- requests always go to `/api/public/ingestion`
- authentication uses Basic Auth with `publicKey` and `secretKey`
- `207 Multi-Status` is accepted
- `errors` are included in the node output, alongside an `errorCount` — a `207` means only *some* events were stored, so check it (or enable `Fail On Batch Errors`) when data is missing in Langfuse
- missing `timestamp` generates an ISO timestamp in the node; a supplied one also becomes the observation's `startTime`/`endTime` when those are left blank
- timestamps are normalized to ISO 8601 with milliseconds, so `Date` values, epoch seconds/milliseconds, and loose strings like `2026-06-02 10:00:00` are all accepted
- missing `traceId` or `observationId` generates a stable hex id where applicable. Observation *creates* always pin a `traceId` (minting one if needed) and report it back on the output, so a `Span Create → Finalize Span → Score Create` chain stays inside a single trace; *updates* never invent one, since that would re-point an existing observation
- usage and cost details are keyed by usage type (`input`, `output`, `total`); the common LLM spellings (`prompt_tokens`, `completionTokens`, `total_cost`, …) are mapped onto those buckets and string values are coerced to numbers, because Langfuse rejects non-numeric usage values
- retryable responses (`429`, `500`, `502`, `503`, `504`) are retried automatically with exponential backoff
