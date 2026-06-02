# Examples

## Public API resource

### Health

```json
{
  "resource": "publicApi",
  "operation": "health"
}
```

### Get Prompt

```json
{
  "resource": "publicApi",
  "operation": "getPrompt",
  "promptName": "answer-query",
  "promptLabel": "production",
  "promptVersion": "2"
}
```

### List Traces

```json
{
  "resource": "publicApi",
  "operation": "listTraces",
  "queryJson": "{\"page\":1,\"limit\":10}"
}
```

### Custom Request

```json
{
  "resource": "publicApi",
  "operation": "customRequest",
  "method": "GET",
  "path": "/v2/scores",
  "queryJson": "{\"page\":1,\"limit\":10}"
}
```

This resource is useful when you want to read Langfuse data or iterate on endpoints that are not yet mapped as dedicated operations.

## Ingestion resource

### Trace Create

```json
{
  "resource": "ingestion",
  "operation": "traceCreate",
  "traceId": "1234567890abcdef1234567890abcdef",
  "name": "checkout",
  "userId": "user-42",
  "sessionId": "session-1",
  "public": true,
  "tags": "prod,checkout",
  "inputJson": "{\"cartId\":\"cart-1\"}",
  "metadataJson": "{\"source\":\"n8n\"}"
}
```

The resulting event is `trace-create` with a body containing `id`, `name`, `userId`, `sessionId`, `public`, `tags`, `input`, and `metadata`.

### Span Create

```json
{
  "resource": "ingestion",
  "operation": "spanCreate",
  "traceId": "1234567890abcdef1234567890abcdef",
  "observationId": "abcdef1234567890",
  "name": "tool-call",
  "startTime": "2026-06-02T10:00:00.000Z",
  "inputJson": "{\"question\":\"hello\"}"
}
```

### Generation Create

```json
{
  "resource": "ingestion",
  "operation": "generationCreate",
  "traceId": "1234567890abcdef1234567890abcdef",
  "observationId": "abcdef1234567890",
  "parentObservationId": "1111111111111111",
  "name": "openai",
  "model": "gpt-4.1-mini",
  "modelParametersJson": "{\"temperature\":0.2}",
  "usageDetailsJson": "{\"prompt_tokens\":1,\"completion_tokens\":2}",
  "costDetailsJson": "{\"total_cost\":0.01}",
  "outputJson": "{\"ok\":true}"
}
```

### Finalize Span

```json
{
  "resource": "ingestion",
  "operation": "finalizeSpan",
  "traceId": "1234567890abcdef1234567890abcdef",
  "observationId": "abcdef1234567890",
  "generationObservationId": "abcdef1234567890_gen",
  "name": "llm-response",
  "model": "gpt-4.1-mini",
  "inputJson": "{\"prompt\":\"Tell me a joke\"}",
  "outputJson": "{\"response\":\"Why did the...\"}",
  "usageDetailsJson": "{\"prompt_tokens\":10,\"completion_tokens\":20}",
  "costDetailsJson": "{\"total_cost\":0.01}",
  "promptName": "answer-query",
  "promptVersion": "2",
  "promptLabelsJson": "[\"production\"]",
  "startTime": "2026-06-02T10:00:00.000Z",
  "endTime": "2026-06-02T10:00:02.000Z"
}
```

This sends a batch containing `generation-create` and `span-update`.

### Score Create

```json
{
  "resource": "ingestion",
  "operation": "scoreCreate",
  "scoreId": "score-1",
  "scoreName": "relevance",
  "scoreValue": "0.95",
  "scoreDataType": "NUMERIC",
  "scoreComment": "Looks good",
  "scoreEnvironment": "prod",
  "scoreTraceId": "1234567890abcdef1234567890abcdef"
}
```

`scoreValue` can be a string, number, or boolean. The node parses it from JSON when needed.

### Batch Raw

```json
{
  "resource": "ingestion",
  "operation": "batchRaw",
  "batchJson": "{\"batch\":[{\"id\":\"evt-1\",\"type\":\"event-create\",\"timestamp\":\"2026-06-02T10:00:00.000Z\",\"body\":{\"id\":\"abc\"}}]}"
}
```

This sends your `batch` payload as-is, which is useful when another system already built the Langfuse payload.

### Span Update

```json
{
  "resource": "ingestion",
  "operation": "spanUpdate",
  "traceId": "1234567890abcdef1234567890abcdef",
  "observationId": "abcdef1234567890",
  "name": "tool-call",
  "statusMessage": "done",
  "level": "info",
  "outputJson": "{\"result\":\"ok\"}"
}
```

### SDK Log

```json
{
  "resource": "ingestion",
  "operation": "sdkLogCreate",
  "traceId": "1234567890abcdef1234567890abcdef",
  "sdkMessage": "Langfuse SDK log example",
  "sdkLevel": "info",
  "metadataJson": "{\"component\":\"n8n\"}"
}
```

