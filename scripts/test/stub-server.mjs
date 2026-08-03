/**
 * Offline stub server emulating the Bedrock Messages endpoint and the OpenAI
 * chat-completions endpoint, including real SSE framing.
 *
 * It exists so the streaming, model-fallback, structured-mode-probe, and
 * provider-fallback logic can all be exercised without a network call, a valid
 * key, or a cent of spend.
 *
 * Routes:
 *   POST /anthropic/v1/messages   → Bedrock (Claude)
 *   POST /v1/chat/completions     → OpenAI
 *
 * Behaviour is driven by a `models` map keyed by model ID, e.g.
 *   { 'anthropic.claude-opus-5': { status: 403, errorType: 'permission_error' } }
 */

import http from 'node:http'

const DEFAULT_TOOL_PAYLOAD = { ok: true, echo: 'pong' }

function sse(res, event, data) {
  res.write(`event: ${event}\n`)
  res.write(`data: ${JSON.stringify(data)}\n\n`)
}

function startSSE(res) {
  res.writeHead(200, {
    'content-type': 'text/event-stream',
    'cache-control': 'no-cache',
    connection: 'keep-alive',
  })
}

/** Split a string into n roughly-equal chunks (to prove delta accumulation). */
function chunkString(str, n) {
  if (n <= 1) return [str]
  const size = Math.max(1, Math.ceil(str.length / n))
  const out = []
  for (let i = 0; i < str.length; i += size) out.push(str.slice(i, i + size))
  return out
}

/**
 * Anthropic tool_use response: the payload arrives as `input_json_delta`
 * chunks, never `text_delta`.
 */
function writeAnthropicToolStream(res, { model, toolName, payload, chunks = 4 }) {
  startSSE(res)
  sse(res, 'message_start', {
    type: 'message_start',
    message: {
      id: 'msg_stub_tool',
      type: 'message',
      role: 'assistant',
      model,
      content: [],
      stop_reason: null,
      stop_sequence: null,
      usage: { input_tokens: 12, output_tokens: 0 },
    },
  })
  sse(res, 'content_block_start', {
    type: 'content_block_start',
    index: 0,
    content_block: { type: 'tool_use', id: 'toolu_stub', name: toolName, input: {} },
  })
  for (const part of chunkString(JSON.stringify(payload), chunks)) {
    sse(res, 'content_block_delta', {
      type: 'content_block_delta',
      index: 0,
      delta: { type: 'input_json_delta', partial_json: part },
    })
  }
  sse(res, 'content_block_stop', { type: 'content_block_stop', index: 0 })
  sse(res, 'message_delta', {
    type: 'message_delta',
    delta: { stop_reason: 'tool_use', stop_sequence: null },
    usage: { output_tokens: 25 },
  })
  sse(res, 'message_stop', { type: 'message_stop' })
  res.end()
}

/** Anthropic json_schema response: the JSON arrives as `text_delta` chunks. */
function writeAnthropicTextStream(res, { model, payload, chunks = 4 }) {
  startSSE(res)
  sse(res, 'message_start', {
    type: 'message_start',
    message: {
      id: 'msg_stub_text',
      type: 'message',
      role: 'assistant',
      model,
      content: [],
      stop_reason: null,
      stop_sequence: null,
      usage: { input_tokens: 12, output_tokens: 0 },
    },
  })
  sse(res, 'content_block_start', {
    type: 'content_block_start',
    index: 0,
    content_block: { type: 'text', text: '' },
  })
  for (const part of chunkString(JSON.stringify(payload), chunks)) {
    sse(res, 'content_block_delta', {
      type: 'content_block_delta',
      index: 0,
      delta: { type: 'text_delta', text: part },
    })
  }
  sse(res, 'content_block_stop', { type: 'content_block_stop', index: 0 })
  sse(res, 'message_delta', {
    type: 'message_delta',
    delta: { stop_reason: 'end_turn', stop_sequence: null },
    usage: { output_tokens: 20 },
  })
  sse(res, 'message_stop', { type: 'message_stop' })
  res.end()
}

function writeAnthropicError(res, status, type, message) {
  res.writeHead(status, { 'content-type': 'application/json' })
  res.end(JSON.stringify({ type: 'error', error: { type, message } }))
}

function writeOpenAIStream(res, { model, payload, chunks = 4 }) {
  startSSE(res)
  const text = JSON.stringify(payload)
  for (const part of chunkString(text, chunks)) {
    res.write(
      `data: ${JSON.stringify({
        id: 'chatcmpl_stub',
        object: 'chat.completion.chunk',
        model,
        choices: [{ index: 0, delta: { content: part }, finish_reason: null }],
      })}\n\n`,
    )
  }
  res.write(
    `data: ${JSON.stringify({
      id: 'chatcmpl_stub',
      object: 'chat.completion.chunk',
      model,
      choices: [{ index: 0, delta: {}, finish_reason: 'stop' }],
    })}\n\n`,
  )
  res.write('data: [DONE]\n\n')
  res.end()
}

function writeOpenAIError(res, status, type, message) {
  res.writeHead(status, { 'content-type': 'application/json' })
  res.end(JSON.stringify({ error: { type, message, code: null } }))
}

/**
 * @param {object} [options]
 * @param {Record<string, object>} [options.models]  per-model Bedrock behaviour
 * @param {object} [options.openai]                  OpenAI behaviour
 * @param {object} [options.payload]                 structured payload to return
 * @param {number} [options.port]                    fixed port (0 = ephemeral)
 */
export async function startStub({
  models = {},
  openai = {},
  payload = DEFAULT_TOOL_PAYLOAD,
  port: fixedPort = 0,
} = {}) {
  /** Every request the stub saw — the tests assert against these. */
  const requests = []

  const server = http.createServer((req, res) => {
    let raw = ''
    req.on('data', (c) => (raw += c))
    req.on('end', () => {
      let body = {}
      try {
        body = raw ? JSON.parse(raw) : {}
      } catch {
        /* leave body empty */
      }
      requests.push({
        url: req.url,
        method: req.method,
        headers: req.headers,
        body,
      })

      if (req.url === '/anthropic/v1/messages') {
        return handleBedrock(req, res, body)
      }
      if (req.url === '/v1/chat/completions') {
        return handleOpenAI(req, res, body)
      }
      res.writeHead(404, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ error: 'not found', url: req.url }))
    })
  })

  function handleBedrock(req, res, body) {
    const model = body.model
    const behaviour = models[model]

    if (!behaviour) {
      return writeAnthropicError(
        res,
        404,
        'not_found_error',
        `stub: no behaviour configured for model "${model}"`,
      )
    }
    if (behaviour.status && behaviour.status >= 400) {
      return writeAnthropicError(
        res,
        behaviour.status,
        behaviour.errorType ?? 'api_error',
        behaviour.errorMessage ?? `stub: ${behaviour.status} for ${model}`,
      )
    }
    // Deployment that rejects output_config.format, as seen in the wild.
    if (behaviour.rejectOutputConfig && body.output_config) {
      return writeAnthropicError(
        res,
        400,
        'invalid_request_error',
        'output_config.format: Extra inputs are not permitted',
      )
    }
    // Bedrock requires thinking disabled alongside a forced tool_choice on Sonnet 5.
    if (
      behaviour.requireThinkingDisabledWithTool &&
      body.tool_choice &&
      body.thinking?.type !== 'disabled'
    ) {
      return writeAnthropicError(
        res,
        400,
        'invalid_request_error',
        'thinking must be disabled when tool_choice forces a specific tool',
      )
    }

    if (body.output_config) {
      return writeAnthropicTextStream(res, { model, payload: behaviour.payload ?? payload })
    }
    if (body.tool_choice) {
      return writeAnthropicToolStream(res, {
        model,
        toolName: body.tool_choice.name ?? 'emit_result',
        payload: behaviour.payload ?? payload,
      })
    }
    return writeAnthropicTextStream(res, { model, payload: behaviour.payload ?? payload })
  }

  function handleOpenAI(req, res, body) {
    if (openai.status && openai.status >= 400) {
      return writeOpenAIError(
        res,
        openai.status,
        openai.errorType ?? 'invalid_request_error',
        openai.errorMessage ?? `stub: ${openai.status}`,
      )
    }
    return writeOpenAIStream(res, { model: body.model, payload: openai.payload ?? payload })
  }

  await new Promise((resolve) => server.listen(fixedPort, '127.0.0.1', resolve))
  const { port } = server.address()

  return {
    port,
    bedrockBaseURL: `http://127.0.0.1:${port}/anthropic`,
    openaiBaseURL: `http://127.0.0.1:${port}/v1`,
    requests,
    bedrockRequests: () => requests.filter((r) => r.url === '/anthropic/v1/messages'),
    openaiRequests: () => requests.filter((r) => r.url === '/v1/chat/completions'),
    close: () => new Promise((resolve) => server.close(resolve)),
  }
}

// Standalone mode, handy for poking at it with curl.
if (import.meta.url === `file://${process.argv[1]}`) {
  const stub = await startStub({
    port: Number(process.env.STUB_PORT) || 0,
    models: {
      'anthropic.claude-opus-5': { status: 403, errorType: 'permission_error' },
      'anthropic.claude-opus-4-8': { rejectOutputConfig: true },
      'anthropic.claude-sonnet-5': { requireThinkingDisabledWithTool: true },
    },
  })
  console.log(`stub listening
  BEDROCK_BASE_URL=${stub.bedrockBaseURL}
  OPENAI_BASE_URL=${stub.openaiBaseURL}`)
}
