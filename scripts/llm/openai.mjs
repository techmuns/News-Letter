/**
 * OpenAI provider — kept intact as the automatic fallback.
 *
 * This path is unchanged in behaviour from a normal OpenAI structured-output
 * call: streaming chat completions with a `json_schema` response format.
 */

import OpenAI from 'openai'
import { classifyError, LLMError } from './errors.mjs'

export const RESULT_SCHEMA_NAME = 'result'

export function createOpenAIClient(openaiCfg, { fetch: fetchImpl } = {}) {
  return new OpenAI({
    apiKey: openaiCfg.apiKey,
    ...(openaiCfg.baseURL ? { baseURL: openaiCfg.baseURL } : {}),
    ...(fetchImpl ? { fetch: fetchImpl } : {}),
    maxRetries: 2,
  })
}

export async function generateStructuredOpenAI({
  client,
  model,
  schema,
  system,
  messages,
  maxTokens,
  onText,
}) {
  const attempts = []
  const chatMessages = [
    ...(system ? [{ role: 'system', content: system }] : []),
    ...messages.map((m) => ({ role: m.role, content: m.content })),
  ]

  try {
    const stream = await client.chat.completions.create({
      model,
      stream: true,
      max_completion_tokens: maxTokens,
      messages: chatMessages,
      response_format: {
        type: 'json_schema',
        json_schema: { name: RESULT_SCHEMA_NAME, schema, strict: true },
      },
    })

    let text = ''
    let usage = null
    for await (const chunk of stream) {
      const delta = chunk?.choices?.[0]?.delta?.content
      if (delta) {
        text += delta
        if (onText) onText(delta)
      }
      if (chunk?.usage) usage = chunk.usage
    }

    if (!text.trim()) {
      throw new LLMError('OpenAI returned an empty structured response.', { kind: 'protocol' })
    }

    attempts.push({ model, mode: 'json_schema', ok: true })
    return { data: JSON.parse(text), model, mode: 'json_schema', attempts, usage }
  } catch (err) {
    if (err instanceof LLMError) {
      attempts.push({ model, mode: 'json_schema', ok: false, error: err.message })
      err.attempts = attempts
      throw err
    }
    const info = classifyError(err)
    attempts.push({
      model,
      mode: 'json_schema',
      ok: false,
      status: info.status,
      kind: info.kind,
      error: info.message,
    })
    throw new LLMError(`OpenAI request failed: ${info.message}`, {
      kind: info.kind,
      status: info.status,
      cause: err,
      attempts,
    })
  }
}
