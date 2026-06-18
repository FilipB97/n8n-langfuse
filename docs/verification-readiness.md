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
| Passes `eslint-plugin-n8n-nodes-base` (`/nodes` + `/credentials`) | ✅ | 0 errors, 0 warnings; CI now fails on any warning (`--max-warnings 0`); no rules disabled |
| Credential has a working `test` request | ✅ | `GET /api/public/v2/prompts?limit=1`, base-URL normalized |
| SVG icons on every node + credential | ✅ | |
| Programmatic node structure (`description` + `execute`/`poll`) | ✅ | |
| Throws `NodeOperationError` / `NodeApiError` from `execute` | ⚠️ | deferred — see gap #1 (the `n8n-workflow` dep drags in a native build that breaks CI) |
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

### ⚠️ 1. n8n error classes (deferred — native-build blocker)

Verified nodes are expected to throw `NodeOperationError` / `NodeApiError` so the
editor gets clickable item context and retry semantics. Those classes live in
`n8n-workflow`.

Attempted and reverted: adding `n8n-workflow` (even as a devDependency) pulls in
`@n8n/expression-runtime` → **`isolated-vm`**, a native V8 sandbox. `isolated-vm`
fails to compile on the GitHub Actions runner (`npm ci` errors out) and is heavy
to install; the Socket scanner also flags the resulting tree. Importing
`n8n-workflow` loads `isolated-vm` at module init, so it can't be made
build-optional. The cost (broken CI, native dep, supply-chain noise) outweighs
the benefit for this package, so the node intentionally throws plain `Error` and
the `node-execute-block-wrong-error-thrown` lint rule stays disabled.

**Revisit when** there's a way to get the error classes without the native dep —
e.g. n8n publishing a types-only or errors-only entrypoint, or
`@n8n/expression-runtime` making `isolated-vm` optional. Until then this is a
known, documented deviation to raise with n8n during verification.

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

### ⚠️ 3. README for verification

Verification expects clear install/usage docs with at least one example. The
README now has per-node usage sections (main node, trigger, AI node), install,
credentials, and two example workflows. Remaining nice-to-have before
submitting: a screenshot or two.

## Suggested order

1. n8n error classes — blocked on the `isolated-vm` native build (see gap #1);
   raise as a documented deviation with n8n rather than taking the native dep.
2. Decide `LangfuseAi` scope / credentials (see ⚠️ 2).
3. ~~README per-node usage~~ — done; add screenshots before submitting.
4. Submit `Langfuse` (+ `LangfuseTrigger`) for verification.
