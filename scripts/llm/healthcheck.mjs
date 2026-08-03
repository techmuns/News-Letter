#!/usr/bin/env node
/**
 * LLM preflight health check.
 *
 * Makes exactly one cheap structured call and prints which provider and model
 * answered. Run this before any expensive or metered work so a bad key costs
 * seconds instead of a whole job.
 *
 *   node scripts/llm/healthcheck.mjs          # human-readable
 *   node scripts/llm/healthcheck.mjs --json   # machine-readable
 *
 * Exit codes: 0 = a provider answered, 1 = nothing answered.
 */

import { createLLMClient, describeConfig, LLMError, ConfigError } from './index.mjs'
import { defaultEnv } from './config.mjs'
import { HEALTH_SCHEMA, HEALTH_MESSAGES, HEALTH_MAX_TOKENS } from './health-schema.mjs'

export async function runHealthCheck({ env = defaultEnv(), fetch: fetchImpl } = {}) {
  const startedAt = Date.now()
  const llm = createLLMClient({ env, fetch: fetchImpl })

  const result = await llm.generateStructured({
    schema: HEALTH_SCHEMA,
    messages: HEALTH_MESSAGES,
    maxTokens: HEALTH_MAX_TOKENS,
  })

  return {
    ok: true,
    provider: result.provider,
    model: result.model,
    mode: result.mode,
    region: result.provider === 'bedrock' ? llm.config.bedrock.region : null,
    fellBack: result.fellBack,
    fallbackReason: result.fallbackReason ?? null,
    durationMs: Date.now() - startedAt,
    payload: result.data,
    attempts: result.attempts,
    config: describeConfig(llm.config),
  }
}

function formatAttempts(attempts = []) {
  return attempts
    .filter((a) => !a.ok)
    .map((a) => `    skipped ${a.model}: ${a.status ? `${a.status} ` : ''}${a.kind ?? ''} ${a.error ?? ''}`.trimEnd())
}

function printHuman(report) {
  const modeNote =
    report.mode === 'tool'
      ? 'forced tool use (one tool, input_schema = your schema)'
      : 'output_config.format json_schema'

  console.log('LLM preflight OK')
  console.log(`  provider : ${report.provider}`)
  console.log(`  model    : ${report.model}`)
  console.log(`  mode     : ${report.mode} — ${modeNote}`)
  if (report.region) console.log(`  region   : ${report.region}`)
  console.log(`  latency  : ${report.durationMs}ms`)
  if (report.fellBack) {
    console.log(`  NOTE     : fell back from the primary provider — ${report.fallbackReason}`)
  }
  const skipped = formatAttempts(report.attempts)
  if (skipped.length) {
    console.log('  chain    :')
    skipped.forEach((line) => console.log(line))
  }
  console.log(
    `  hint     : pin with BEDROCK_MODELS=${report.model} BEDROCK_STRUCTURED_MODE=${report.mode} to skip probing`,
  )
}

async function main() {
  const asJson = process.argv.includes('--json')
  try {
    const report = await runHealthCheck()
    if (asJson) console.log(JSON.stringify(report, null, 2))
    else printHuman(report)
    process.exit(0)
  } catch (err) {
    const detail = {
      ok: false,
      kind: err instanceof LLMError ? err.kind : err instanceof ConfigError ? 'config' : 'unknown',
      message: err.message,
      attempts: err.attempts ?? [],
    }
    if (asJson) {
      console.log(JSON.stringify(detail, null, 2))
    } else {
      console.error('LLM preflight FAILED')
      console.error(`  kind   : ${detail.kind}`)
      console.error(`  detail : ${detail.message}`)
      for (const attempt of detail.attempts) {
        if (attempt.ok) continue
        console.error(
          `    tried ${attempt.model} (${attempt.mode}): ${attempt.status ?? ''} ${attempt.error ?? ''}`.trimEnd(),
        )
      }
      if (detail.kind === 'config') {
        console.error('  fix    : set BEDROCK_API_KEY (and pass it through the workflow env: block)')
      }
    }
    process.exit(1)
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await main()
}
