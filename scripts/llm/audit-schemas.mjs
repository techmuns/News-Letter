#!/usr/bin/env node
/**
 * Audit JSON Schemas against Anthropic structured-output rules.
 *
 *   node scripts/llm/audit-schemas.mjs path/to/schema.json [...]
 *
 * Reports unsupported keywords (minimum/maximum/minLength/maxLength/recursive
 * $ref/...) and never modifies anything. Exit 1 if any blocking finding exists.
 */

import { readFile } from 'node:fs/promises'
import { auditSchema, formatFindings } from './schema.mjs'

const files = process.argv.slice(2)

if (!files.length) {
  console.error('usage: node scripts/llm/audit-schemas.mjs <schema.json> [...]')
  process.exit(2)
}

let failed = false

for (const file of files) {
  let schema
  try {
    schema = JSON.parse(await readFile(file, 'utf8'))
  } catch (err) {
    console.error(`${file}: could not read/parse — ${err.message}`)
    failed = true
    continue
  }

  const { ok, findings } = auditSchema(schema)
  console.log(`${file}: ${ok ? 'OK' : 'NEEDS CHANGES'}`)
  if (findings.length) console.log(formatFindings(findings))
  if (!ok) failed = true
}

process.exit(failed ? 1 : 0)
