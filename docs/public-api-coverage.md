# Public API coverage

This coverage map applies to the unified `Langfuse` node when you choose `Resource = Public API`.

| Operation | Endpoint | Notes |
| --- | --- | --- |
| `Health` | `GET /api/public/health` | Quick availability and auth check |
| `List Prompts` | `GET /api/public/v2/prompts` | Uses `queryJson` as query params |
| `Get Prompt` | `GET /api/public/v2/prompts/{promptName}` | Supports `promptLabel` and `promptVersion` as query params |
| `List Traces` | `GET /api/public/traces` | Uses `queryJson` for filtering |
| `Get Trace` | `GET /api/public/traces/{traceId}` | Fetches a single trace |
| `List Scores` | `GET /api/public/v2/scores` | Uses `queryJson` for filtering |
| `Get Score` | `GET /api/public/v2/scores/{scoreId}` | Fetches a single score |
| `List Observations` | `GET /api/public/v2/observations` | Lists observations |
| `List Annotation Queues` | `GET /api/public/annotation-queues` | Lists annotation queues |
| `Get Annotation Queue` | `GET /api/public/annotation-queues/{queueId}` | Fetches a single queue |
| `Custom Request` | Any endpoint under `/api/public` | Escape hatch for newer endpoints |

## Shared behavior

- Basic Auth uses `publicKey` as username and `secretKey` as password
- `baseUrl` can be `https://cloud.langfuse.com` or `https://cloud.langfuse.com/api/public`
- the node returns `status`, `ok`, `data`, `raw`, and `requestUrl`
