# Quick Test in n8n

This flow mirrors the example you pasted:

- `create trace` -> `Langfuse` / `Resource = Ingestion` / `Trace Create`
- `create span` -> `Langfuse` / `Resource = Ingestion` / `Span Create`
- `finalize span` -> `Langfuse` / `Resource = Ingestion` / `Finalize Span`
- `get prompt` -> `Langfuse` / `Resource = Public API` / `Get Prompt`

## 1. Prepare credentials

- `Base URL`: `https://langfuse.smartsoft.biz.pl/api/public` or just `https://langfuse.smartsoft.biz.pl`
- `Public Key`
- `Secret Key`

The node will build Basic Auth and avoid a duplicated `/api/public` if you already include it in the URL.

## 2. Trace Create

Set:

- `Resource`: `Ingestion`
- `Operation`: `Trace Create`
- `Trace ID`: for example `trace-001`, or leave empty
- `Name`: `test-flow`
- `Session ID`: `trace-001`
- `Input JSON`: `{"source":"n8n"}`

After running, the output should show a `trace-create` event.

## 3. Span Create

Set:

- `Resource`: `Ingestion`
- `Operation`: `Span Create`
- `Trace ID`: same as above
- `Observation ID`: `span-001`
- `Name`: `tool-call`
- `Start Time`: current ISO timestamp, for example `2026-06-02T10:00:00.000Z`
- `Input JSON`: `{"question":"hello"}`

## 4. Finalize Span

Set:

- `Resource`: `Ingestion`
- `Operation`: `Finalize Span`
- `Trace ID`: same as above
- `Observation ID`: `span-001`
- `Generation Observation ID`: `span-001_gen`
- `Name`: `llm-response`
- `Model`: `gpt-4.1-mini`
- `Input JSON`: `{"prompt":"Tell me a joke"}`
- `Output JSON`: `{"response":"Why did the ..."}`
- `Usage Details JSON`: `{"prompt_tokens":10,"completion_tokens":20}`
- `Cost Details JSON`: `{"total_cost":0.01}`
- `Prompt Name`: `answer-query`
- `Prompt Version`: `2`
- `Prompt Labels JSON`: `["production"]`
- `Start Time`: `2026-06-02T10:00:00.000Z`
- `End Time`: `2026-06-02T10:00:02.000Z`

This sends one batch with `generation-create` and `span-update`.

## 5. Get Prompt

Use the same `Langfuse` node.

Set:

- `Resource`: `Public API`
- `Operation`: `Get Prompt`
- `Prompt Name`: for example `answer-query`
- `Prompt Label`: `production` or `latest`
- `Prompt Version`: optional, if you want a specific version

After running, the output should contain `prompt`, `raw`, `status`, and `ok`.

## How to inspect the result

- for ingestion operations, the node output should show `status`, `ok`, `batchSize`, `successes`, and `errors`
- for `Get Prompt`, the node output should show `status`, `ok`, `data`, `raw`, and `requestUrl`
- for `Health` and list endpoints, the node will return the JSON payload in `data`
- in Langfuse UI, you should see the trace and linked observation or generation
- if Langfuse returns partial errors, the node will surface them in the output
