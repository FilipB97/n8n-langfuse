# Example workflow — full end-to-end demo

[`example-workflow.json`](example-workflow.json) is an importable n8n workflow that exercises **every** operation of the Langfuse node (v2) in a single run, driven by a real OpenAI call.

## What it does

```
Manual Trigger
  → Setup IDs (generates trace/span/generation/score ids + prompt)
  → OpenAI Chat (@n8n/n8n-nodes-langchain.openAi)
  → Trace Create
  → Span Create → Span Update
  → Generation Create → Generation Update → Finalize Span
  → Score Create → Event Create → SDK Log → Batch Raw
  → Wait 5s (let async ingestion flush)
  → Health
  → List Prompts → Get Prompt
  → List Traces → Get Trace
  → List Observations → Get Observation
  → List Scores → Get Score → Delete Score
  → List Sessions
  → List Annotation Queues → Get Annotation Queue
  → Custom Request
```

The OpenAI node makes a genuine LLM call; its prompt and full response are attached to the trace, the generation, and the finalized span — the same shape you would log in a real instrumentation workflow.

## Operations covered

| Group | Operations |
| --- | --- |
| Trace | Create, Get, List |
| Span | Create, Update |
| Generation | Create, Update, Finalize |
| Score | Create, Get, List, Delete |
| Prompt | List, Get |
| Session | List |
| Observation | List, Get |
| Annotation Queue | List, Get |
| System | Health, Event Create, SDK Log, Batch Raw, Custom Request |

All 24 node operations run in one execution.

## How to import

1. Install the community node `n8n-nodes-langfuse-studio` (Settings → Community Nodes).
2. In n8n: **Workflows → Import from File** and select `example-workflow.json`.
3. Open each **Langfuse** node and select your **Langfuse API** credential (the import leaves a `REPLACE_LANGFUSE_CRED` placeholder).
4. Open the **OpenAI Chat** node and select your **OpenAI** credential (placeholder `REPLACE_OPENAI_CRED`); adjust the model if you do not have `gpt-4o-mini`.
5. Click **Test workflow**.

## Design notes

- **No single point of failure.** Every Langfuse node has *Continue On Error* enabled (`onError: continueRegularOutput`), so a failed read (for example a `404` on freshly-created data) never stops the chain — the run always reaches `Custom Request`.
- **Async-safe.** Langfuse ingestion is asynchronous. The 5-second Wait gives the platform time to process the writes before the read operations query them. On very fast projects a few reads may still return `404`; that is expected, not a bug.
- **Non-destructive.** `Delete Score` only deletes the demo score this run created (`scoreId` from *Setup IDs*), never an arbitrary existing score.
- **Drill-down reads.** `Get Prompt` and `Get Annotation Queue` pull the first id from the preceding `List` node, so they work against whatever already exists in your project.
- **v2 layout.** Nodes use `typeVersion: 2` (entity-based resources). Existing workflows on v1 keep working unchanged.
