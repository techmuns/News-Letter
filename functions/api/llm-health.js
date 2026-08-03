/**
 * GET /api/llm-health — LLM preflight, running where the secret actually lives.
 *
 * Cloudflare dashboard secrets are encrypted and readable only from
 * `context.env` inside a Pages Function at runtime. They are NOT visible to
 * GitHub Actions, so this endpoint — not the CI workflow — is the preflight
 * that can see BEDROCK_API_KEY.
 *
 * Two modes:
 *
 *   GET /api/llm-health
 *       Free. Reports whether the bindings are present and how the transport
 *       would resolve them. Makes no model call, so it is safe to leave public
 *       and safe to poll.
 *
 *   GET /api/llm-health?live=1     (header: x-preflight-token: <PREFLIGHT_TOKEN>)
 *       Makes one cheap structured call and reports which provider and model
 *       answered. Token-gated so a public URL cannot bill your account.
 *
 * Bind these in Cloudflare → Workers & Pages → your project → Settings →
 * Variables and Secrets (set them for Production and Preview separately):
 *   BEDROCK_API_KEY   (secret, required)
 *   PREFLIGHT_TOKEN   (secret, required only for ?live=1)
 *   BEDROCK_REGION    (plain text, optional — defaults to us-east-1)
 *   OPENAI_API_KEY    (secret, optional — automatic fallback)
 *   LLM_PROVIDER      (plain text, optional — set to "openai" to flip back)
 */

import { createLLMClient, describeConfig, LLMError, ConfigError } from '../../scripts/llm/index.mjs'
import {
  HEALTH_SCHEMA,
  HEALTH_MESSAGES,
  HEALTH_MAX_TOKENS,
} from '../../scripts/llm/health-schema.mjs'

const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  // A preflight result is never worth caching.
  'cache-control': 'no-store',
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body, null, 2), { status, headers: JSON_HEADERS })
}

/**
 * Constant-time-ish comparison so the token check does not leak length or
 * prefix information through timing.
 */
function tokensMatch(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

export async function onRequestGet(context) {
  const { env, request } = context
  const url = new URL(request.url)
  const wantsLive = url.searchParams.get('live') === '1'

  // --- Binding readiness (free, no model call) -------------------------------
  const bindings = {
    BEDROCK_API_KEY: Boolean(env.BEDROCK_API_KEY),
    OPENAI_API_KEY: Boolean(env.OPENAI_API_KEY),
    PREFLIGHT_TOKEN: Boolean(env.PREFLIGHT_TOKEN),
    BEDROCK_REGION: env.BEDROCK_REGION || 'us-east-1 (default)',
    LLM_PROVIDER: env.LLM_PROVIDER || 'auto',
  }

  let config = null
  let configError = null
  try {
    config = describeConfig(createLLMClient({ env }).config)
  } catch (err) {
    configError = err instanceof ConfigError ? err.message : String(err?.message ?? err)
  }

  if (!wantsLive) {
    return json({
      ok: !configError,
      mode: 'bindings-only',
      hint: 'add ?live=1 with the x-preflight-token header to make one real call',
      bindings,
      config,
      error: configError,
    })
  }

  // --- Live call (token-gated, costs money) ----------------------------------
  if (!env.PREFLIGHT_TOKEN) {
    return json(
      {
        ok: false,
        mode: 'live',
        error:
          'PREFLIGHT_TOKEN is not bound. Set it as a secret before enabling ?live=1, ' +
          'otherwise this endpoint would let anyone bill your account.',
        bindings,
      },
      503,
    )
  }

  const presented = request.headers.get('x-preflight-token') ?? ''
  if (!tokensMatch(presented, env.PREFLIGHT_TOKEN)) {
    return json({ ok: false, mode: 'live', error: 'bad or missing x-preflight-token' }, 401)
  }

  if (configError) {
    return json({ ok: false, mode: 'live', error: configError, bindings }, 503)
  }

  const startedAt = Date.now()
  try {
    const llm = createLLMClient({ env })
    const result = await llm.generateStructured({
      schema: HEALTH_SCHEMA,
      messages: HEALTH_MESSAGES,
      maxTokens: HEALTH_MAX_TOKENS,
    })

    return json({
      ok: true,
      mode: 'live',
      provider: result.provider,
      model: result.model,
      structuredMode: result.mode,
      region: result.provider === 'bedrock' ? llm.config.bedrock.region : null,
      fellBack: result.fellBack,
      fallbackReason: result.fallbackReason ?? null,
      durationMs: Date.now() - startedAt,
      payload: result.data,
      // Non-ok entries show which models were skipped and why.
      attempts: result.attempts,
      bindings,
    })
  } catch (err) {
    const kind = err instanceof LLMError ? err.kind : 'unknown'
    return json(
      {
        ok: false,
        mode: 'live',
        kind,
        error: err?.message ?? String(err),
        attempts: err?.attempts ?? [],
        durationMs: Date.now() - startedAt,
        bindings,
      },
      // 502: we reached the Function fine, the upstream provider is the problem.
      kind === 'config' ? 503 : 502,
    )
  }
}
