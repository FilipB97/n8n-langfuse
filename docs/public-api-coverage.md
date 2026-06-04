# Public API coverage

This coverage map applies to the `Langfuse` node Public API operations. In **v1** they live under `Resource = Public API`; in **v2** they are grouped by entity (`Trace`, `Score`, `Prompt`, `Session`, `Observation`, `Annotation Queue`, `Dataset`, `Dataset Item`, `Dataset Run`, `System`).

> Dataset operations are available in node **v2** only.

| Operation | Endpoint | Notes |
| --- | --- | --- |
| `Health` | `GET /api/public/health` | Quick availability and auth check |
| `List Prompts` | `GET /api/public/v2/prompts` | Uses `queryJson` as query params |
| `Get Prompt` | `GET /api/public/v2/prompts/{promptName}` | Supports `promptLabel` and `promptVersion` as query params |
| `Create Prompt` | `POST /api/public/v2/prompts` | Creates a prompt or a new version. Body: `name` + `type` (`text`/`chat`) + `prompt`, plus optional `labels`, `tags`, `config`, `commitMessage` |
| `List Traces` | `GET /api/public/traces` | Uses `queryJson` for filtering |
| `Get Trace` | `GET /api/public/traces/{traceId}` | Fetches a single trace |
| `List Scores` | `GET /api/public/v2/scores` | Uses `queryJson` for filtering |
| `Get Score` | `GET /api/public/v2/scores/{scoreId}` | Fetches a single score |
| `Delete Score` | `DELETE /api/public/v2/scores/{scoreId}` | Deletes a single score by id |
| `List Score Configs` | `GET /api/public/score-configs` | Lists all score configuration definitions |
| `Get Score Config` | `GET /api/public/score-configs/{configId}` | Fetches a single score config by ID |
| `List Observations` | `GET /api/public/v2/observations` | Lists observations |
| `Get Observation` | `GET /api/public/v2/observations/{observationId}` | Fetches a single observation |
| `List Sessions` | `GET /api/public/sessions` | Uses `queryJson` for filtering |
| `Get Session` | `GET /api/public/sessions/{sessionId}` | Fetches a single session by ID |
| `List Annotation Queues` | `GET /api/public/annotation-queues` | Lists annotation queues |
| `Get Annotation Queue` | `GET /api/public/annotation-queues/{queueId}` | Fetches a single queue |
| `List Annotation Queue Items` | `GET /api/public/annotation-queues/{queueId}/items` | Lists items in a specific annotation queue |
| `List Datasets` | `GET /api/public/v2/datasets` | Uses `queryJson` for pagination |
| `Get Dataset` | `GET /api/public/v2/datasets/{datasetName}` | Fetches a single dataset by name |
| `Create Dataset` | `POST /api/public/v2/datasets` | Body: `name` (required), `description`, `metadata` |
| `List Dataset Items` | `GET /api/public/dataset-items` | Uses `queryJson` (e.g. `datasetName`, `page`, `limit`) |
| `Get Dataset Item` | `GET /api/public/dataset-items/{id}` | Fetches a single dataset item |
| `Create Dataset Item` | `POST /api/public/dataset-items` | Upserts when `id` is supplied. Body: `datasetName` (required), `input`, `expectedOutput`, `metadata`, `sourceTraceId`, `sourceObservationId`, `id`, `status` |
| `Delete Dataset Item` | `DELETE /api/public/dataset-items/{id}` | Deletes a dataset item by id |
| `List Dataset Runs` | `GET /api/public/datasets/{datasetName}/runs` | Note: runs live under `/datasets`, **not** `/v2/datasets` |
| `Get Dataset Run` | `GET /api/public/datasets/{datasetName}/runs/{runName}` | Fetches a single run |
| `Delete Dataset Run` | `DELETE /api/public/datasets/{datasetName}/runs/{runName}` | Deletes a run by name |
| `Create Dataset Run Item` | `POST /api/public/dataset-run-items` | Body: `runName` (required), `datasetItemId` (required), `traceId` or `observationId`, `runDescription`, `metadata` |
| `Custom Request` | Any endpoint under `/api/public` | Escape hatch for newer or unlisted endpoints |

## Shared behavior

- Basic Auth uses `publicKey` as username and `secretKey` as password
- `baseUrl` can be `https://cloud.langfuse.com` or `https://cloud.langfuse.com/api/public`
- the node returns `status`, `ok`, `data`, `raw`, and `requestUrl`
- retryable responses (`429`, `500`, `502`, `503`, `504`) are retried automatically with exponential backoff
