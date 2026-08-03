/**
 * Provider/model/region resolution for the LLM transport.
 *
 * Everything here is read from the environment so the same code runs locally,
 * in CI, and against the offline stub server. Nothing in this directory is
 * bundled into the browser app — these are Node-only scripts and the API keys
 * must never reach `src/`.
 */

/** Bedrock model IDs carry an `anthropic.` provider prefix. */
export const DEFAULT_BEDROCK_MODELS = [
  'anthropic.claude-opus-5',
  'anthropic.claude-opus-4-8',
  'anthropic.claude-sonnet-5',
]

export const DEFAULT_BEDROCK_REGION = 'us-east-1'
export const DEFAULT_OPENAI_MODEL = 'gpt-4o-mini'
export const DEFAULT_MAX_TOKENS = 8192

/** Messages-API Bedrock endpoint. The SDK appends `/v1/messages`. */
export function bedrockBaseURL(region) {
  return `https://bedrock-mantle.${region}.api.aws/anthropic`
}

function splitList(value) {
  if (!value) return null
  const items = value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  return items.length ? items : null
}

function truthy(value) {
  if (value == null) return false
  return /^(1|true|yes|on)$/i.test(String(value).trim())
}

export class ConfigError extends Error {
  constructor(message) {
    super(message)
    this.name = 'ConfigError'
  }
}

/**
 * Decide which provider to use and with what settings.
 *
 * Selection order:
 *   1. `LLM_PROVIDER` if set to `bedrock` or `openai` (explicit wins).
 *   2. Otherwise whichever key is present, Bedrock first.
 *
 * OpenAI stays wired up as an automatic fallback whenever its key is present
 * and it is not already the primary.
 */
export function resolveConfig(env = process.env) {
  const bedrockKey = env.BEDROCK_API_KEY?.trim() || ''
  const openaiKey = env.OPENAI_API_KEY?.trim() || ''

  const requested = (env.LLM_PROVIDER || '').trim().toLowerCase()
  if (requested && !['bedrock', 'openai', 'auto'].includes(requested)) {
    throw new ConfigError(
      `LLM_PROVIDER must be "bedrock", "openai", or unset — got "${requested}".`,
    )
  }

  let provider
  let reason
  if (requested === 'bedrock') {
    if (!bedrockKey) {
      throw new ConfigError('LLM_PROVIDER=bedrock but BEDROCK_API_KEY is not set.')
    }
    provider = 'bedrock'
    reason = 'LLM_PROVIDER=bedrock'
  } else if (requested === 'openai') {
    if (!openaiKey) {
      throw new ConfigError('LLM_PROVIDER=openai but OPENAI_API_KEY is not set.')
    }
    provider = 'openai'
    reason = 'LLM_PROVIDER=openai'
  } else if (bedrockKey) {
    provider = 'bedrock'
    reason = 'BEDROCK_API_KEY present'
  } else if (openaiKey) {
    provider = 'openai'
    reason = 'only OPENAI_API_KEY present'
  } else {
    throw new ConfigError(
      'No LLM credentials found. Set BEDROCK_API_KEY (preferred) or OPENAI_API_KEY.',
    )
  }

  // OpenAI is the automatic fallback whenever it is available and not primary.
  const fallbackProvider = provider !== 'openai' && openaiKey ? 'openai' : null

  const region = env.BEDROCK_REGION?.trim() || DEFAULT_BEDROCK_REGION
  const structuredMode = (env.BEDROCK_STRUCTURED_MODE || '').trim().toLowerCase() || null
  if (structuredMode && !['json_schema', 'tool'].includes(structuredMode)) {
    throw new ConfigError(
      `BEDROCK_STRUCTURED_MODE must be "json_schema" or "tool" — got "${structuredMode}".`,
    )
  }

  const maxTokens = Number(env.LLM_MAX_TOKENS) || DEFAULT_MAX_TOKENS

  return {
    provider,
    reason,
    fallbackProvider,
    maxTokens,
    /** When true, unsupported JSON Schema keywords are stripped instead of rejected. */
    allowSchemaStrip: truthy(env.LLM_SCHEMA_STRIP),
    bedrock: {
      apiKey: bedrockKey,
      region,
      // BEDROCK_BASE_URL exists so the offline stub can stand in for AWS.
      baseURL: env.BEDROCK_BASE_URL?.trim() || bedrockBaseURL(region),
      models: splitList(env.BEDROCK_MODELS) || [...DEFAULT_BEDROCK_MODELS],
      structuredMode,
    },
    openai: {
      apiKey: openaiKey,
      model: env.OPENAI_MODEL?.trim() || DEFAULT_OPENAI_MODEL,
      baseURL: env.OPENAI_BASE_URL?.trim() || null,
    },
  }
}

/** Redacted view of the resolved config, safe to print in CI logs. */
export function describeConfig(cfg) {
  return {
    provider: cfg.provider,
    reason: cfg.reason,
    fallback: cfg.fallbackProvider ?? 'none',
    bedrock: {
      region: cfg.bedrock.region,
      baseURL: cfg.bedrock.baseURL,
      models: cfg.bedrock.models,
      structuredMode: cfg.bedrock.structuredMode ?? 'probe',
      keyPresent: Boolean(cfg.bedrock.apiKey),
    },
    openai: {
      model: cfg.openai.model,
      keyPresent: Boolean(cfg.openai.apiKey),
    },
  }
}
