/**
 * Claude via Amazon Bedrock (Messages API endpoint).
 *
 * Transport notes, all verified against the "Claude in Amazon Bedrock" docs:
 *
 *  - Endpoint is `https://bedrock-mantle.{region}.api.aws/anthropic/v1/messages`.
 *    The SDK appends `/v1/messages` to the baseURL we pass.
 *  - A Bedrock bearer token authenticates via the `x-api-key` header — which is
 *    exactly what the standard `Anthropic` client sends for `apiKey`. The docs
 *    call this out explicitly: standard client + baseURL + bearer token as
 *    apiKey. No SigV4, no AWS SDK. (SigV4 is only needed for the dedicated
 *    AnthropicBedrockMantle client, which we are not using.)
 *  - `anthropic-version: 2023-06-01` is sent by the SDK on every request.
 *  - Model IDs carry an `anthropic.` prefix.
 *  - Sampling params (temperature/top_p/top_k) are REMOVED on Opus 5/4.8/4.7 and
 *    Sonnet 5 — sending any of them is a 400. We never send them.
 *  - We always stream, so long outputs cannot trip request timeouts.
 */

import Anthropic from '@anthropic-ai/sdk'
import {
  classifyError,
  isOutputConfigRejection,
  isThinkingWithForcedToolRejection,
  LLMError,
} from './errors.mjs'

/** Name of the single tool used for the forced-tool structured-output path. */
export const RESULT_TOOL_NAME = 'emit_result'

export function createBedrockClient(bedrockCfg, { fetch: fetchImpl } = {}) {
  return new Anthropic({
    apiKey: bedrockCfg.apiKey,
    baseURL: bedrockCfg.baseURL,
    maxRetries: 2,
    ...(fetchImpl ? { fetch: fetchImpl } : {}),
  })
}

/**
 * Forced tool_choice on Bedrock requires thinking to be disabled on Sonnet 5.
 * We scope it to the models that need it rather than blanket-disabling
 * thinking, which has its own failure modes on Opus 5.
 */
function needsThinkingDisabled(model) {
  return /sonnet-5/.test(model)
}

function buildParams({ model, schema, system, messages, maxTokens, mode, disableThinking }) {
  const base = {
    model,
    max_tokens: maxTokens,
    messages,
    ...(system ? { system } : {}),
    // No temperature / top_p / top_k — rejected with a 400 on these models.
  }

  if (mode === 'json_schema') {
    return {
      ...base,
      output_config: { format: { type: 'json_schema', schema } },
    }
  }

  // Forced tool use: one tool, input_schema = the caller's schema.
  return {
    ...base,
    tools: [
      {
        name: RESULT_TOOL_NAME,
        description: 'Return the result as structured data matching the input schema.',
        input_schema: schema,
      },
    ],
    tool_choice: { type: 'tool', name: RESULT_TOOL_NAME },
    ...(disableThinking ? { thinking: { type: 'disabled' } } : {}),
  }
}

/**
 * Pull the structured payload out of a completed message.
 *
 * In tool mode the payload arrives as `input_json_delta` chunks that the SDK
 * accumulates into `block.input`. The text fallback guards the known
 * disabled-thinking failure mode where a tool call is written as plain text.
 */
function extractPayload(message, mode) {
  const blocks = message?.content ?? []

  if (mode === 'tool') {
    const toolBlock = blocks.find((b) => b.type === 'tool_use' && b.name === RESULT_TOOL_NAME)
    if (toolBlock) {
      if (typeof toolBlock.input === 'string') return JSON.parse(toolBlock.input)
      return toolBlock.input
    }
    const salvaged = salvageJSONFromText(blocks)
    if (salvaged) return salvaged
    throw new LLMError('Bedrock returned no tool_use block for the forced tool call.', {
      kind: 'protocol',
    })
  }

  const text = blocks
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('')
  if (!text.trim()) {
    throw new LLMError('Bedrock returned an empty structured response.', { kind: 'protocol' })
  }
  return JSON.parse(text)
}

/** Last-ditch: find a JSON object inside assistant text. */
function salvageJSONFromText(blocks) {
  const text = blocks
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('')
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start === -1 || end <= start) return null
  try {
    return JSON.parse(text.slice(start, end + 1))
  } catch {
    return null
  }
}

async function streamOnce(client, params, onText) {
  const stream = client.messages.stream(params)
  if (onText) stream.on('text', onText)
  return stream.finalMessage()
}

/**
 * Run a structured generation against the Bedrock model chain.
 *
 * Walks `models` in order. A 403/404 means this account has no access to that
 * model (Bedrock grants Opus 5 per-account) so we move to the next one. The
 * first model that answers is pinned, along with the structured-output mode
 * that worked, so later calls skip the probing entirely.
 *
 * @returns {{data: any, model: string, mode: string, attempts: Array}}
 */
export async function generateStructuredBedrock({
  client,
  models,
  schema,
  system,
  messages,
  maxTokens,
  mode: initialMode,
  onText,
  pin,
}) {
  const attempts = []
  // Start from whatever we already pinned; otherwise try json_schema first.
  const startModel = pin?.model
  const orderedModels = startModel
    ? [startModel, ...models.filter((m) => m !== startModel)]
    : [...models]
  let mode = pin?.mode ?? initialMode ?? 'json_schema'

  let lastInfo = null

  for (const model of orderedModels) {
    // Per model, we may need up to three shapes: json_schema, tool,
    // and tool-with-thinking-disabled.
    let disableThinking = needsThinkingDisabled(model)
    let triedToolFallback = mode === 'tool'
    let triedThinkingFix = false

    for (;;) {
      const params = buildParams({
        model,
        schema,
        system,
        messages,
        maxTokens,
        mode,
        disableThinking,
      })

      try {
        const message = await streamOnce(client, params, onText)
        const data = extractPayload(message, mode)
        attempts.push({ model, mode, ok: true })
        return { data, model, mode, attempts, usage: message?.usage ?? null }
      } catch (err) {
        if (err instanceof LLMError && err.kind === 'protocol' && mode === 'json_schema') {
          // Deployment accepted output_config but did not return usable JSON.
          attempts.push({ model, mode, ok: false, error: err.message })
          if (!triedToolFallback) {
            triedToolFallback = true
            mode = 'tool'
            disableThinking = needsThinkingDisabled(model)
            continue
          }
          lastInfo = { status: null, kind: 'protocol', message: err.message, tryNextModel: true, tryNextProvider: false }
          break
        }

        const info = classifyError(err)
        lastInfo = info
        attempts.push({
          model,
          mode,
          ok: false,
          status: info.status,
          kind: info.kind,
          error: info.message,
        })

        // The deployment rejects output_config.format — pin to forced tool use.
        if (!triedToolFallback && isOutputConfigRejection(info)) {
          triedToolFallback = true
          mode = 'tool'
          disableThinking = needsThinkingDisabled(model)
          continue
        }

        // Forced tool_choice needs thinking disabled on this model.
        if (!triedThinkingFix && mode === 'tool' && !disableThinking && isThinkingWithForcedToolRejection(info)) {
          triedThinkingFix = true
          disableThinking = true
          continue
        }

        if (info.tryNextModel) break // next model in the chain
        throw new LLMError(`Bedrock request failed: ${info.message}`, {
          kind: info.kind,
          status: info.status,
          cause: err,
          attempts,
        })
      }
    }
  }

  throw new LLMError(
    `No Bedrock model in the chain answered (${orderedModels.join(', ')}). ` +
      `Last error: ${lastInfo?.message ?? 'unknown'}`,
    {
      kind: lastInfo?.kind ?? 'unknown',
      status: lastInfo?.status ?? null,
      attempts,
    },
  )
}
