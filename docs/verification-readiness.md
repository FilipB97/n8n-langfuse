# n8n verified community node — readiness

Status snapshot of `n8n-nodes-langfuse-studio` against the requirements for n8n's
[verified community node](https://docs.n8n.io/integrations/community-nodes/build-community-nodes/)
program. Review criteria are maintained by n8n and evolve; treat this as a working
checklist, not a guarantee of acceptance.

Legend: ✅ met · ⚠️ decision needed · ❌ gap to close

## Packaging & metadata

| Requirement | Status | Notes |
|---|---|---|
| Package name `n8n-nodes-*` | ✅ | `n8n-nodes-langfuse-studio` |
| `n8n-community-node-package` keyword | ✅ | present |
| MIT (or compatible) license | ✅ | `MIT` |
| **Zero runtime `dependencies`** | ✅ | none declared; pure `fetch`-based core |
| `n8n` block points at compiled classes | ✅ | `dist/.../*.node.js`, `dist/credentials/*.credentials.js` |
| Repository / author / keywords set | ✅ | |
| `engines.node` declared | ✅ | `>=20.19` (added) |
| Tarball ships only `dist/` + docs (no `.ts` source leak) | ✅ | verified via `npm pack --dry-run` in CI |

## Node & credential conventions

| Requirement | Status | Notes |
|---|---|---|
| Passes `eslint-plugin-n8n-nodes-base` (`/nodes` + `/credentials`) | ✅ | 0 errors, 0 warnings; CI now fails on any warning (`--max-warnings 0`) |
| Credential has a working `test` request | ✅ | `GET /api/public/v2/prompts?limit=1`, base-URL normalized |
| SVG icons on every node + credential | ✅ | |
| Programmatic node structure (`description` + `execute`/`poll`) | ✅ | |
| Continue-on-fail honored | ✅ | per-item, surfaces status/body on API errors |

## CI / release hygiene

| Item | Status | Notes |
|---|---|---|
| Type-check + lint + tests on PRs | ✅ | |
| Node version matrix | ✅ | 20.x and 22.x (added) |
| Build + packaged-content verification in CI | ✅ | `npm run compile` + `npm pack --dry-run` + dist asserts (added) |
| Tests (pure layers) | ✅ | 113 tests, `node:test` via `tsx` |
| npm publish with provenance | ✅ | `npm publish --provenance` |
| Changelog-driven GitHub releases | ✅ | `scripts/changelog-section.mjs` |

## Open decisions / gaps

### ⚠️ 1. `n8n-lite` vs real `n8n-workflow` types

The package deliberately hand-declares the slice of n8n's interfaces it uses
(`src/n8n-lite.ts`) instead of importing `n8n-workflow`, which keeps builds and
tests dependency-free. Runtime works via structural typing.

Consequence for verification: the node layer throws plain `Error` rather than
`NodeOperationError` / `NodeApiError`, so the lint rule
`node-execute-block-wrong-error-thrown` is currently **disabled**. Verified nodes
are expected to use n8n's error classes for correct UI behavior (clickable item
context, "pin", retry semantics).

**Recommended path:** add `n8n-workflow` as a **devDependency** (not a runtime
`dependency`, so the zero-deps property is preserved — n8n provides it at runtime
as a peer), import `NodeOperationError`/`NodeApiError` only in the node layer
(`nodes/**`), keep the pure logic in `src/**` untouched, then re-enable the lint
rule. This is the single highest-value step toward verification.

### ⚠️ 2. `LangfuseAi` scope and core-credential references

`LangfuseAi` calls OpenAI/Anthropic and references n8n's built-in `openAiApi` /
`anthropicApi` credentials. Two things to confirm before submitting:

- Verified nodes are usually scoped to **one** external service. A node that also
  calls OpenAI/Anthropic may be considered out of scope for a "Langfuse"
  verification. Option: submit only `Langfuse` + `LangfuseTrigger` for
  verification and keep `LangfuseAi` as an unverified convenience node.
- Referencing core credential types defined by other packages
  (`anthropicApi` lives in the LangChain nodes package) can fail to resolve on
  instances without that package. Option: define the node's own minimal API-key
  credentials instead of borrowing core ones.

### ❌ 3. README for verification

Verification expects clear install/usage docs with at least one example. The
README is good; before submitting, add per-node usage sections and a screenshot
or two.

## Suggested order

1. Add `n8n-workflow` devDependency + `NodeOperationError`/`NodeApiError` in the
   node layer; re-enable the disabled lint rule. *(closes the main gap)*
2. Decide `LangfuseAi` scope / credentials (see ⚠️ 2).
3. README polish + screenshots.
4. Submit `Langfuse` (+ `LangfuseTrigger`) for verification.
