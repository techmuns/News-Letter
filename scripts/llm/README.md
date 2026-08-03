# LLM transport — Claude on Amazon Bedrock, with OpenAI fallback

Node-only transport layer. Nothing here is imported by `src/`, so no API key can
end up in the browser bundle.

> **This repo had no LLM calls before this change.** The app (`src/`) is still a
> UI shell on mock data — `turnIntoContent` in `src/store/useStore.ts` picks a
> pre-written template and does not call any model. This directory is the
> transport that a real generation step plugs into; no prompts, schemas, or
> business logic were written or changed.

## Where the key lives, and what that implies

`BEDROCK_API_KEY` is set in **Cloudflare** (Workers & Pages → project → Settings
→ Variables and Secrets). Cloudflare secrets are encrypted and readable **only**
from `context.env` inside a Pages Function at runtime — **GitHub Actions cannot
read them.**

So there are two surfaces, and only one of them can see the key:

| Surface | Sees the Cloudflare secret? | Use it for |
|---|---|---|
| `functions/api/llm-health.js` (deployed) | **yes** | the real live preflight |
| `npm run llm:health` (Node CLI) | only if you export the key locally | local dev |
| `.github/workflows/llm-preflight.yml` | **no** | offline transport tests |

The transport itself is shared by all three — it is fetch-based with no Node
built-ins, and `createLLMClient({ env })` takes an explicit env object, so the
same code runs in Node and in a Worker.

## Quick start

```bash
npm run llm:test        # offline transport tests — no key, no network, no spend
npm run pages:dev       # build + run the Function locally at :8788
```

Local Function dev reads `.dev.vars` (gitignored) — copy `.dev.vars.example`.
To drive it entirely offline, run the stub in one terminal and the Function in
another:

```bash
npm run llm:stub        # stub Bedrock + OpenAI on :8899
npm run pages:dev       # with BEDROCK_BASE_URL=http://127.0.0.1:8899/anthropic
```

### The deployed preflight

```bash
# free, no model call — answers "is my secret actually bound?"
curl https://<deployment>/api/llm-health

# one cheap real call — reports which provider and model answered
curl -H 'x-preflight-token: <PREFLIGHT_TOKEN>' \
     'https://<deployment>/api/llm-health?live=1'
```

The live mode is token-gated on purpose: a public URL that triggers model calls
is a billing hole. If `PREFLIGHT_TOKEN` is not bound, `?live=1` returns 503
rather than running unauthenticated.

The deploy workflow curls the free endpoint after every deploy and warns if
`BEDROCK_API_KEY` is not bound. It does not fail the deploy — a missing LLM
binding should never block a static site.

### Node CLI (local only)

```bash
export BEDROCK_API_KEY=...        # or cp .env.example .env.local
npm run llm:health
```

## Using it

```js
import { createLLMClient } from './scripts/llm/index.mjs'

const llm = createLLMClient()
const { data, provider, model, mode } = await llm.generateStructured({
  schema,                                   // your JSON Schema, passed through untouched
  system,                                   // your system prompt, passed through untouched
  messages: [{ role: 'user', content: '…' }],
  onText: (chunk) => process.stdout.write(chunk),   // optional streaming callback
})
```

Responses always stream, so long outputs cannot trip request timeouts.

## How the provider is chosen

| Condition | Primary | Fallback |
|---|---|---|
| `BEDROCK_API_KEY` set | Bedrock | OpenAI, if `OPENAI_API_KEY` is set |
| Only `OPENAI_API_KEY` set | OpenAI | none |
| `LLM_PROVIDER=openai` | OpenAI | none |
| `LLM_PROVIDER=bedrock` | Bedrock | OpenAI, if its key is set |

Fallback to OpenAI fires on credential, access, capacity, and transport
failures. It deliberately does **not** fire on a `400` — a malformed request
would just fail twice and hide the real bug.

## Wire details (verified against the "Claude in Amazon Bedrock" docs)

- Endpoint: `https://bedrock-mantle.{region}.api.aws/anthropic/v1/messages`.
- Auth: the Bedrock bearer token goes in the **`x-api-key`** header, not
  `Authorization`. No SigV4 and no AWS SDK — this is the documented
  standard-client-plus-`baseURL` path. (SigV4 is only needed for the dedicated
  `AnthropicBedrockMantle` client, which we are not using.)
- `anthropic-version: 2023-06-01` is sent on every request by the SDK.
- Model IDs carry the `anthropic.` prefix.
- `temperature` / `top_p` / `top_k` are **never** sent — they are rejected with a
  400 on Opus 5, Opus 4.8, Opus 4.7, and Sonnet 5. A test asserts this.

### Model fallback chain

`anthropic.claude-opus-5` → `anthropic.claude-opus-4-8` → `anthropic.claude-sonnet-5`

Bedrock grants Opus 5 access per-account, so a `403` on the first entry is
expected; 4.8 and Sonnet 5 are open to all Bedrock customers. A `403`/`404`
moves to the next model. The first model that answers is pinned for the rest of
the process. Override with `BEDROCK_MODELS`.

### Structured output

Two modes, probed once and then pinned:

1. **`json_schema`** — `output_config: { format: { type: 'json_schema', schema } }`.
2. **`tool`** — one tool whose `input_schema` is your schema, plus
   `tool_choice: { type: 'tool', name }`.

Some deployments reject mode 1 with
`output_config.format: Extra inputs are not permitted`. That exact 400 is
detected and the client switches to mode 2 and pins it. Tool payloads arrive as
`input_json_delta` (never `text_delta`) — covered by a test.

On the forced-tool path, `thinking: { type: 'disabled' }` is sent for Sonnet 5,
which Bedrock requires alongside a forced `tool_choice`. It is scoped to the
models that need it rather than applied blanket, because disabling thinking on
Opus 5 has its own failure modes. If any other model returns that same 400, the
client retries once with thinking disabled.

Skip all probing once you know the answer:

```bash
BEDROCK_MODELS=anthropic.claude-opus-4-8 BEDROCK_STRUCTURED_MODE=tool
```

## Schema compatibility

Anthropic's `json_schema` mode rejects `minimum`, `maximum`, `exclusiveMinimum`,
`exclusiveMaximum`, `multipleOf`, `minLength`, `maxLength`, array constraints,
recursive `$ref`, and any `additionalProperties` other than `false` (which every
object must set).

`generateStructured` audits the schema **before** sending and throws with the
offending paths rather than quietly rewriting it. Nothing is stripped unless you
opt in with `LLM_SCHEMA_STRIP=1`, and the stripped keys come back on
`result.schemaStripped`.

Audit a schema file directly:

```bash
npm run llm:audit-schema -- path/to/schema.json
```

## Running inside a Worker

Two things make this work, and both are load-bearing:

1. **`wrangler.toml` sets `compatibility_flags = ["nodejs_compat"]`.** The
   Anthropic SDK's credential-chain module statically imports `node:fs` and
   `node:path` (for the `~/.config/anthropic` OAuth profile path we never use).
   Without the flag those imports throw at module load and every `/api/*`
   request 500s before any of our code runs. Verified by running the Function in
   the real `workerd` runtime, not just by bundling it.
2. **Nothing touches `process` at import time.** `config.mjs` exports
   `defaultEnv()`, which reads `globalThis.process?.env ?? {}`. Pages Functions
   pass bindings in explicitly as `context.env`.

Bundle size is ~172 KB gzipped, comfortably under Cloudflare's 1 MB limit.
Check it with `npm run pages:build-functions`.

## Adding a generation endpoint

The transport is ready; what does not exist yet is a prompt or an output schema,
and neither was invented here. When you have them, a new endpoint is one file:

```js
// functions/api/generate.js
import { createLLMClient } from '../../scripts/llm/index.mjs'

export async function onRequestPost(context) {
  const llm = createLLMClient({ env: context.env })
  const { data } = await llm.generateStructured({
    schema: YOUR_SCHEMA,      // run it through npm run llm:audit-schema first
    system: YOUR_SYSTEM_PROMPT,
    messages: [...],
  })
  return Response.json(data)
}
```

Gate it — an unauthenticated generation endpoint is a billing hole in the same
way `?live=1` would be.

## Files

| File | Purpose |
|---|---|
| `config.mjs` | Env → provider/model/region resolution |
| `errors.mjs` | Error classification: next model? next provider? |
| `bedrock.mjs` | Bedrock transport, model chain, mode probe |
| `openai.mjs` | OpenAI transport (fallback), unchanged behaviour |
| `index.mjs` | `createLLMClient()` — provider selection + pinning |
| `health-schema.mjs` | The probe schema, shared by CLI and Function |
| `healthcheck.mjs` | Node CLI preflight: one cheap call, prints provider + model |
| `audit-schemas.mjs` | Standalone schema audit CLI |
| `../test/stub-server.mjs` | Local SSE stub for Bedrock + OpenAI |
| `../test/run-offline-tests.mjs` | The offline suite |
| `../../functions/api/llm-health.js` | Deployed preflight endpoint (sees the Cloudflare secret) |
| `../../wrangler.toml` | `nodejs_compat` flag — the Function will not load without it |
