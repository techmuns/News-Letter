/**
 * Unified LLM transport: Claude on Amazon Bedrock primary, OpenAI fallback.
 *
 * This is a transport layer only. It takes your prompt, your messages, and your
 * JSON Schema and puts them on the wire — it does not rewrite any of them.
 *
 * Usage:
 *   import { createLLMClient } from './scripts/llm/index.mjs'
 *   const llm = createLLMClient()
 *   const { data, provider, model } = await llm.generateStructured({
 *     schema, system, messages,
 *   })
 */

import { resolveConfig, describeConfig, ConfigError } from './config.mjs'
import { auditSchema, stripSchema, formatFindings } from './schema.mjs'
import { createBedrockClient, generateStructuredBedrock } from './bedrock.mjs'
import { createOpenAIClient, generateStructuredOpenAI } from './openai.mjs'
import { LLMError } from './errors.mjs'

export { ConfigError, LLMError, describeConfig, auditSchema, stripSchema, formatFindings }

/**
 * @param {object} [options]
 * @param {NodeJS.ProcessEnv} [options.env]     environment to read config from
 * @param {typeof fetch} [options.fetch]        injectable fetch (used by the offline stub tests)
 */
export function createLLMClient({ env = process.env, fetch: fetchImpl } = {}) {
  const config = resolveConfig(env)

  // Clients are created lazily so a missing fallback key never throws up front.
  let bedrockClient = null
  let openaiClient = null
  const getBedrock = () =>
    (bedrockClient ??= createBedrockClient(config.bedrock, { fetch: fetchImpl }))
  const getOpenAI = () => (openaiClient ??= createOpenAIClient(config.openai, { fetch: fetchImpl }))

  // Pinned across calls: the first model that answered and the structured-output
  // mode that this deployment actually accepts.
  let pin = config.bedrock.structuredMode ? { model: null, mode: config.bedrock.structuredMode } : null

  function prepareSchema(schema) {
    const audit = auditSchema(schema)
    if (audit.ok) return { schema, audit, stripped: null }

    if (!config.allowSchemaStrip) {
      const blocking = audit.findings.filter((f) => f.severity === 'error')
      throw new LLMError(
        'Schema is not compatible with Anthropic structured outputs:\n' +
          formatFindings(blocking) +
          '\n\nNo schema was modified. Fix the schema, or set LLM_SCHEMA_STRIP=1 to strip ' +
          'these keywords at request time (the stripped keys are reported back to you).',
        { kind: 'schema' },
      )
    }
    const { schema: cleaned, removed } = stripSchema(schema)
    return { schema: cleaned, audit, stripped: removed }
  }

  async function runProvider(provider, { schema, system, messages, maxTokens, onText }) {
    if (provider === 'bedrock') {
      const result = await generateStructuredBedrock({
        client: getBedrock(),
        models: config.bedrock.models,
        schema,
        system,
        messages,
        maxTokens,
        mode: config.bedrock.structuredMode,
        onText,
        pin,
      })
      pin = { model: result.model, mode: result.mode }
      return { ...result, provider: 'bedrock' }
    }

    const result = await generateStructuredOpenAI({
      client: getOpenAI(),
      model: config.openai.model,
      schema,
      system,
      messages,
      maxTokens,
      onText,
    })
    return { ...result, provider: 'openai' }
  }

  /**
   * Generate a structured object.
   *
   * @param {object} req
   * @param {object} req.schema         JSON Schema for the response (passed through untouched)
   * @param {string} [req.system]       system prompt (passed through untouched)
   * @param {Array<{role: string, content: string}>} req.messages
   * @param {number} [req.maxTokens]
   * @param {(text: string) => void} [req.onText]  streamed text callback
   */
  async function generateStructured({ schema, system, messages, maxTokens, onText }) {
    if (!Array.isArray(messages) || messages.length === 0) {
      throw new LLMError('generateStructured requires a non-empty messages array.', {
        kind: 'usage',
      })
    }
    const prepared = prepareSchema(schema)
    const tokens = maxTokens ?? config.maxTokens
    const started = Date.now()
    const allAttempts = []

    try {
      const result = await runProvider(config.provider, {
        schema: prepared.schema,
        system,
        messages,
        maxTokens: tokens,
        onText,
      })
      return {
        ...result,
        durationMs: Date.now() - started,
        fellBack: false,
        schemaStripped: prepared.stripped,
        attempts: [...allAttempts, ...result.attempts],
      }
    } catch (err) {
      allAttempts.push(...(err.attempts ?? []))
      const canFallBack =
        config.fallbackProvider &&
        err instanceof LLMError &&
        !['schema', 'usage'].includes(err.kind) &&
        isFallbackable(err)

      if (!canFallBack) {
        err.attempts = allAttempts
        throw err
      }

      try {
        const result = await runProvider(config.fallbackProvider, {
          schema: prepared.schema,
          system,
          messages,
          maxTokens: tokens,
          onText,
        })
        return {
          ...result,
          durationMs: Date.now() - started,
          fellBack: true,
          fallbackReason: err.message,
          schemaStripped: prepared.stripped,
          attempts: [...allAttempts, ...result.attempts],
        }
      } catch (fallbackErr) {
        allAttempts.push(...(fallbackErr.attempts ?? []))
        throw new LLMError(
          `Both providers failed.\n  ${config.provider}: ${err.message}\n` +
            `  ${config.fallbackProvider}: ${fallbackErr.message}`,
          { kind: 'all_providers_failed', attempts: allAttempts, cause: fallbackErr },
        )
      }
    }
  }

  return {
    config,
    generateStructured,
    /** The model + structured-output mode pinned so far (null until the first call). */
    getPin: () => (pin ? { ...pin } : null),
    resetPin: () => {
      pin = config.bedrock.structuredMode ? { model: null, mode: config.bedrock.structuredMode } : null
    },
  }
}

/**
 * A failure is worth retrying on the other provider when it is about
 * credentials, access, capacity, or transport — not when we sent a bad request.
 */
function isFallbackable(err) {
  return [
    'auth',
    'access',
    'not_found',
    'rate_limit',
    'server',
    'network',
    'protocol',
    'unknown',
  ].includes(err.kind)
}
