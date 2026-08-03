#!/usr/bin/env node
/**
 * Offline tests for the LLM transport.
 *
 * Runs the real client against a local stub server: no network, no keys, no
 * spend. Covers SSE streaming (both text_delta and input_json_delta), the model
 * fallback chain, the structured-output mode probe, model/mode pinning,
 * provider fallback to OpenAI, and the JSON Schema audit.
 *
 *   npm run llm:test
 */

import { startStub } from './stub-server.mjs'
import { createLLMClient, LLMError, ConfigError } from '../llm/index.mjs'
import { runHealthCheck } from '../llm/healthcheck.mjs'
import { auditSchema } from '../llm/schema.mjs'

const SCHEMA = {
  type: 'object',
  properties: {
    ok: { type: 'boolean' },
    echo: { type: 'string' },
  },
  required: ['ok', 'echo'],
  additionalProperties: false,
}

const MESSAGES = [{ role: 'user', content: 'health check' }]

const BASE_ENV = {
  BEDROCK_API_KEY: 'stub-bedrock-key',
  BEDROCK_REGION: 'us-east-1',
}

// ---------------------------------------------------------------- test harness

const tests = []
const test = (name, fn) => tests.push({ name, fn })

function assert(cond, message) {
  if (!cond) throw new Error(`assertion failed: ${message}`)
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message}\n    expected: ${expected}\n    actual:   ${actual}`)
  }
}

async function assertRejects(fn, predicate, message) {
  try {
    await fn()
  } catch (err) {
    if (predicate(err)) return err
    throw new Error(`${message}\n    got unexpected error: ${err.message}`)
  }
  throw new Error(`${message}\n    (call unexpectedly succeeded)`)
}

// ---------------------------------------------------------------------- tests

test('streams a tool payload from input_json_delta chunks', async () => {
  const stub = await startStub({
    models: { 'anthropic.claude-opus-5': { rejectOutputConfig: true } },
  })
  try {
    const llm = createLLMClient({
      env: { ...BASE_ENV, BEDROCK_BASE_URL: stub.bedrockBaseURL, BEDROCK_MODELS: 'anthropic.claude-opus-5' },
    })
    const result = await llm.generateStructured({ schema: SCHEMA, messages: MESSAGES })

    assertEqual(result.mode, 'tool', 'should have fallen back to forced tool use')
    assertEqual(result.data.ok, true, 'payload.ok should survive delta accumulation')
    assertEqual(result.data.echo, 'pong', 'payload.echo should survive delta accumulation')

    const toolReq = stub.bedrockRequests().find((r) => r.body.tool_choice)
    assertEqual(toolReq.body.tool_choice.type, 'tool', 'tool_choice must force the tool')
    assertEqual(toolReq.body.tools.length, 1, 'exactly one tool should be declared')
    assert(
      JSON.stringify(toolReq.body.tools[0].input_schema) === JSON.stringify(SCHEMA),
      'input_schema must be the caller schema, unmodified',
    )
  } finally {
    await stub.close()
  }
})

test('streams a json_schema payload from text_delta chunks', async () => {
  const stub = await startStub({ models: { 'anthropic.claude-opus-5': {} } })
  try {
    const llm = createLLMClient({
      env: { ...BASE_ENV, BEDROCK_BASE_URL: stub.bedrockBaseURL, BEDROCK_MODELS: 'anthropic.claude-opus-5' },
    })
    const result = await llm.generateStructured({ schema: SCHEMA, messages: MESSAGES })

    assertEqual(result.mode, 'json_schema', 'should have stayed on output_config.format')
    assertEqual(result.data.echo, 'pong', 'payload should parse')

    const req = stub.bedrockRequests()[0]
    assertEqual(req.body.output_config.format.type, 'json_schema', 'output_config shape')
    assert(!req.body.tools, 'json_schema mode must not declare tools')
  } finally {
    await stub.close()
  }
})

test('walks the model chain past a 403 (per-account Opus 5 access)', async () => {
  const stub = await startStub({
    models: {
      'anthropic.claude-opus-5': {
        status: 403,
        errorType: 'permission_error',
        errorMessage: "You don't have access to the model with the specified model ID.",
      },
      'anthropic.claude-opus-4-8': {},
    },
  })
  try {
    const llm = createLLMClient({
      env: { ...BASE_ENV, BEDROCK_BASE_URL: stub.bedrockBaseURL },
    })
    const result = await llm.generateStructured({ schema: SCHEMA, messages: MESSAGES })

    assertEqual(result.model, 'anthropic.claude-opus-4-8', 'should pin the first model that answers')
    const skipped = result.attempts.find((a) => a.model === 'anthropic.claude-opus-5')
    assertEqual(skipped.status, 403, 'the 403 should be recorded in attempts')
    assertEqual(skipped.ok, false, 'the 403 attempt should be marked failed')
  } finally {
    await stub.close()
  }
})

test('pins model + mode so later calls skip the probe', async () => {
  const stub = await startStub({
    models: {
      'anthropic.claude-opus-5': { status: 403, errorType: 'permission_error' },
      'anthropic.claude-opus-4-8': { rejectOutputConfig: true },
    },
  })
  try {
    const llm = createLLMClient({ env: { ...BASE_ENV, BEDROCK_BASE_URL: stub.bedrockBaseURL } })

    await llm.generateStructured({ schema: SCHEMA, messages: MESSAGES })
    const pin = llm.getPin()
    assertEqual(pin.model, 'anthropic.claude-opus-4-8', 'pinned model')
    assertEqual(pin.mode, 'tool', 'pinned mode')

    const afterFirst = stub.bedrockRequests().length
    await llm.generateStructured({ schema: SCHEMA, messages: MESSAGES })
    const secondCallRequests = stub.bedrockRequests().length - afterFirst

    assertEqual(secondCallRequests, 1, 'second call should cost exactly one request')
  } finally {
    await stub.close()
  }
})

test('never sends temperature / top_p / top_k', async () => {
  const stub = await startStub({
    models: {
      'anthropic.claude-opus-5': { status: 403 },
      'anthropic.claude-opus-4-8': { rejectOutputConfig: true },
    },
  })
  try {
    const llm = createLLMClient({ env: { ...BASE_ENV, BEDROCK_BASE_URL: stub.bedrockBaseURL } })
    await llm.generateStructured({ schema: SCHEMA, messages: MESSAGES })

    for (const req of stub.bedrockRequests()) {
      for (const banned of ['temperature', 'top_p', 'top_k']) {
        assert(
          !Object.hasOwn(req.body, banned),
          `${banned} must never be sent (400 on Opus 5/4.8/4.7 and Sonnet 5)`,
        )
      }
    }
  } finally {
    await stub.close()
  }
})

test('disables thinking for forced tool use on Sonnet 5', async () => {
  const stub = await startStub({
    models: {
      'anthropic.claude-sonnet-5': { rejectOutputConfig: true, requireThinkingDisabledWithTool: true },
    },
  })
  try {
    const llm = createLLMClient({
      env: {
        ...BASE_ENV,
        BEDROCK_BASE_URL: stub.bedrockBaseURL,
        BEDROCK_MODELS: 'anthropic.claude-sonnet-5',
      },
    })
    const result = await llm.generateStructured({ schema: SCHEMA, messages: MESSAGES })
    assertEqual(result.data.echo, 'pong', 'sonnet-5 forced tool call should succeed')

    const toolReq = stub.bedrockRequests().find((r) => r.body.tool_choice)
    assertEqual(toolReq.body.thinking?.type, 'disabled', 'thinking must be disabled with forced tool_choice')
  } finally {
    await stub.close()
  }
})

test('recovers when a model unexpectedly demands thinking disabled', async () => {
  // opus-4-8 is not in the "disable thinking" list, so this exercises the
  // adaptive retry rather than the model-name heuristic.
  const stub = await startStub({
    models: {
      'anthropic.claude-opus-4-8': { rejectOutputConfig: true, requireThinkingDisabledWithTool: true },
    },
  })
  try {
    const llm = createLLMClient({
      env: {
        ...BASE_ENV,
        BEDROCK_BASE_URL: stub.bedrockBaseURL,
        BEDROCK_MODELS: 'anthropic.claude-opus-4-8',
      },
    })
    const result = await llm.generateStructured({ schema: SCHEMA, messages: MESSAGES })
    assertEqual(result.data.echo, 'pong', 'should recover after the thinking 400')
  } finally {
    await stub.close()
  }
})

test('falls back to OpenAI when every Bedrock model rejects the key', async () => {
  const stub = await startStub({
    models: {
      'anthropic.claude-opus-5': { status: 401, errorType: 'authentication_error' },
      'anthropic.claude-opus-4-8': { status: 401, errorType: 'authentication_error' },
      'anthropic.claude-sonnet-5': { status: 401, errorType: 'authentication_error' },
    },
    openai: { payload: { ok: true, echo: 'pong' } },
  })
  try {
    const llm = createLLMClient({
      env: {
        ...BASE_ENV,
        BEDROCK_BASE_URL: stub.bedrockBaseURL,
        OPENAI_API_KEY: 'stub-openai-key',
        OPENAI_BASE_URL: stub.openaiBaseURL,
        OPENAI_MODEL: 'gpt-4o-mini',
      },
    })
    const result = await llm.generateStructured({ schema: SCHEMA, messages: MESSAGES })

    assertEqual(result.provider, 'openai', 'should have fallen back to OpenAI')
    assertEqual(result.fellBack, true, 'fellBack flag should be set')
    assertEqual(result.data.echo, 'pong', 'OpenAI payload should stream and parse')
    assertEqual(stub.openaiRequests().length, 1, 'OpenAI should be called exactly once')
    assert(stub.openaiRequests()[0].body.stream === true, 'OpenAI call should stream')
  } finally {
    await stub.close()
  }
})

test('does NOT fall back to OpenAI on a malformed-request 400', async () => {
  const stub = await startStub({
    models: {
      'anthropic.claude-opus-5': {
        status: 400,
        errorType: 'invalid_request_error',
        errorMessage: 'messages: at least one message is required',
      },
    },
    openai: {},
  })
  try {
    const llm = createLLMClient({
      env: {
        ...BASE_ENV,
        BEDROCK_BASE_URL: stub.bedrockBaseURL,
        BEDROCK_MODELS: 'anthropic.claude-opus-5',
        OPENAI_API_KEY: 'stub-openai-key',
        OPENAI_BASE_URL: stub.openaiBaseURL,
      },
    })
    await assertRejects(
      () => llm.generateStructured({ schema: SCHEMA, messages: MESSAGES }),
      (err) => err instanceof LLMError,
      'a 400 should surface, not silently retry on the other provider',
    )
    assertEqual(stub.openaiRequests().length, 0, 'OpenAI must not be called for a 400')
  } finally {
    await stub.close()
  }
})

test('LLM_PROVIDER=openai routes straight to OpenAI', async () => {
  const stub = await startStub({ models: {}, openai: {} })
  try {
    const llm = createLLMClient({
      env: {
        ...BASE_ENV,
        LLM_PROVIDER: 'openai',
        BEDROCK_BASE_URL: stub.bedrockBaseURL,
        OPENAI_API_KEY: 'stub-openai-key',
        OPENAI_BASE_URL: stub.openaiBaseURL,
      },
    })
    const result = await llm.generateStructured({ schema: SCHEMA, messages: MESSAGES })

    assertEqual(result.provider, 'openai', 'explicit provider should win')
    assertEqual(stub.bedrockRequests().length, 0, 'Bedrock must not be touched')
  } finally {
    await stub.close()
  }
})

test('prefers Bedrock when both keys are present', async () => {
  const stub = await startStub({ models: { 'anthropic.claude-opus-5': {} }, openai: {} })
  try {
    const llm = createLLMClient({
      env: {
        ...BASE_ENV,
        BEDROCK_BASE_URL: stub.bedrockBaseURL,
        BEDROCK_MODELS: 'anthropic.claude-opus-5',
        OPENAI_API_KEY: 'stub-openai-key',
        OPENAI_BASE_URL: stub.openaiBaseURL,
      },
    })
    assertEqual(llm.config.provider, 'bedrock', 'Bedrock should be primary')
    assertEqual(llm.config.fallbackProvider, 'openai', 'OpenAI should be armed as fallback')
    const result = await llm.generateStructured({ schema: SCHEMA, messages: MESSAGES })
    assertEqual(result.provider, 'bedrock', 'Bedrock should serve the request')
  } finally {
    await stub.close()
  }
})

test('sends the bearer token as x-api-key against /anthropic/v1/messages', async () => {
  const stub = await startStub({ models: { 'anthropic.claude-opus-5': {} } })
  try {
    const llm = createLLMClient({
      env: { ...BASE_ENV, BEDROCK_BASE_URL: stub.bedrockBaseURL, BEDROCK_MODELS: 'anthropic.claude-opus-5' },
    })
    await llm.generateStructured({ schema: SCHEMA, messages: MESSAGES })

    const req = stub.bedrockRequests()[0]
    assertEqual(req.url, '/anthropic/v1/messages', 'endpoint path')
    assertEqual(req.headers['x-api-key'], 'stub-bedrock-key', 'bearer token goes in x-api-key')
    assertEqual(req.headers['anthropic-version'], '2023-06-01', 'anthropic-version header')
    assert(!req.headers.authorization, 'must not use the Authorization header')
    assert(req.body.model.startsWith('anthropic.'), 'model id carries the anthropic. prefix')
  } finally {
    await stub.close()
  }
})

test('health check reports the provider and model that answered', async () => {
  const stub = await startStub({
    models: {
      'anthropic.claude-opus-5': { status: 403, errorType: 'permission_error' },
      'anthropic.claude-opus-4-8': { rejectOutputConfig: true },
    },
  })
  try {
    const report = await runHealthCheck({
      env: { ...BASE_ENV, BEDROCK_BASE_URL: stub.bedrockBaseURL },
    })
    assertEqual(report.ok, true, 'health check should pass')
    assertEqual(report.provider, 'bedrock', 'reported provider')
    assertEqual(report.model, 'anthropic.claude-opus-4-8', 'reported model')
    assertEqual(report.mode, 'tool', 'reported structured mode')
    assertEqual(report.region, 'us-east-1', 'reported region')
  } finally {
    await stub.close()
  }
})

test('health check fails fast on a bad key', async () => {
  const stub = await startStub({
    models: {
      'anthropic.claude-opus-5': { status: 401, errorType: 'authentication_error' },
      'anthropic.claude-opus-4-8': { status: 401, errorType: 'authentication_error' },
      'anthropic.claude-sonnet-5': { status: 401, errorType: 'authentication_error' },
    },
  })
  try {
    await assertRejects(
      () => runHealthCheck({ env: { ...BASE_ENV, BEDROCK_BASE_URL: stub.bedrockBaseURL } }),
      (err) => err instanceof LLMError,
      'a bad key should raise, not hang',
    )
  } finally {
    await stub.close()
  }
})

test('missing credentials produce a clear config error', async () => {
  await assertRejects(
    async () => createLLMClient({ env: {} }),
    (err) => err instanceof ConfigError && /BEDROCK_API_KEY/.test(err.message),
    'no keys should raise ConfigError naming BEDROCK_API_KEY',
  )
  await assertRejects(
    async () => createLLMClient({ env: { LLM_PROVIDER: 'openai', BEDROCK_API_KEY: 'x' } }),
    (err) => err instanceof ConfigError && /OPENAI_API_KEY/.test(err.message),
    'explicit openai without its key should raise',
  )
})

test('schema audit flags every unsupported keyword', async () => {
  const bad = {
    type: 'object',
    properties: {
      score: { type: 'integer', minimum: 0, maximum: 10 },
      title: { type: 'string', minLength: 1, maxLength: 80 },
      tags: { type: 'array', items: { type: 'string' }, minItems: 1 },
      node: { $ref: '#/$defs/node' },
    },
    $defs: {
      node: {
        type: 'object',
        properties: { child: { $ref: '#/$defs/node' } },
        additionalProperties: false,
      },
    },
    required: ['score'],
    additionalProperties: false,
  }

  const { ok, findings } = auditSchema(bad)
  assertEqual(ok, false, 'audit should reject this schema')

  const keywords = new Set(findings.map((f) => f.keyword))
  for (const expected of ['minimum', 'maximum', 'minLength', 'maxLength', 'minItems', '$ref']) {
    assert(keywords.has(expected), `audit should flag "${expected}"`)
  }

  const clean = auditSchema(SCHEMA)
  assertEqual(clean.ok, true, 'the health-check schema should pass cleanly')
})

test('a bad schema is rejected without silently rewriting it', async () => {
  const stub = await startStub({ models: { 'anthropic.claude-opus-5': {} } })
  try {
    const badSchema = {
      type: 'object',
      properties: { score: { type: 'integer', minimum: 0 } },
      required: ['score'],
      additionalProperties: false,
    }
    const env = { ...BASE_ENV, BEDROCK_BASE_URL: stub.bedrockBaseURL, BEDROCK_MODELS: 'anthropic.claude-opus-5' }

    const llm = createLLMClient({ env })
    const err = await assertRejects(
      () => llm.generateStructured({ schema: badSchema, messages: MESSAGES }),
      (e) => e instanceof LLMError && e.kind === 'schema',
      'unsupported keywords should block the call',
    )
    assert(/minimum/.test(err.message), 'the error should name the offending keyword')
    assertEqual(stub.bedrockRequests().length, 0, 'nothing should have been sent')

    // Opt in explicitly, and the strip is reported back.
    const stripping = createLLMClient({ env: { ...env, LLM_SCHEMA_STRIP: '1' } })
    const result = await stripping.generateStructured({ schema: badSchema, messages: MESSAGES })
    assertEqual(result.schemaStripped.length, 1, 'exactly one keyword should be stripped')
    assertEqual(result.schemaStripped[0].keyword, 'minimum', 'and it should be reported')
  } finally {
    await stub.close()
  }
})

// ----------------------------------------------------------------------- run

let passed = 0
const failures = []

for (const { name, fn } of tests) {
  try {
    await fn()
    passed += 1
    console.log(`  ok    ${name}`)
  } catch (err) {
    failures.push({ name, err })
    console.log(`  FAIL  ${name}`)
    console.log(`        ${err.message.split('\n').join('\n        ')}`)
  }
}

console.log(`\n${passed}/${tests.length} passed`)
if (failures.length) {
  console.error(`\n${failures.length} failing test(s).`)
  process.exit(1)
}
