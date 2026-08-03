/**
 * JSON Schema audit for Anthropic structured outputs.
 *
 * Anthropic's `json_schema` mode rejects a specific set of keywords. This
 * module *reports* them; it never rewrites a schema behind your back. Stripping
 * only happens if you explicitly ask for it (`LLM_SCHEMA_STRIP=1` or
 * `stripSchema()`), and it always returns exactly what it removed.
 *
 * Unsupported (documented): recursive schemas, numeric constraints
 * (minimum/maximum/exclusiveMinimum/exclusiveMaximum/multipleOf), string
 * constraints (minLength/maxLength), complex array constraints, and
 * `additionalProperties` set to anything other than `false`.
 */

/** Keywords the API rejects outright. */
const UNSUPPORTED_KEYWORDS = {
  minimum: 'numeric constraint',
  maximum: 'numeric constraint',
  exclusiveMinimum: 'numeric constraint',
  exclusiveMaximum: 'numeric constraint',
  multipleOf: 'numeric constraint',
  minLength: 'string constraint',
  maxLength: 'string constraint',
  minItems: 'array constraint',
  maxItems: 'array constraint',
  uniqueItems: 'array constraint',
  minProperties: 'object constraint',
  maxProperties: 'object constraint',
}

/** Keywords that are not documented either way — worth a human look. */
const REVIEW_KEYWORDS = {
  pattern: 'not listed as supported; prefer an enum or a format keyword',
  not: 'not listed as supported',
  if: 'conditional subschema, not listed as supported',
  then: 'conditional subschema, not listed as supported',
  else: 'conditional subschema, not listed as supported',
}

const SUBSCHEMA_ARRAY_KEYS = ['anyOf', 'allOf', 'oneOf', 'prefixItems']
const SUBSCHEMA_MAP_KEYS = ['properties', '$defs', 'definitions', 'patternProperties']
const SUBSCHEMA_SINGLE_KEYS = ['items', 'contains', 'additionalItems', 'not', 'if', 'then', 'else']

function isObject(value) {
  return value != null && typeof value === 'object' && !Array.isArray(value)
}

function joinPath(base, key) {
  return base ? `${base}.${key}` : String(key)
}

/**
 * Walk every subschema, calling `visit(node, path)`.
 * `$ref` targets are not followed here — cycles are detected separately.
 */
function walk(node, path, visit) {
  if (!isObject(node)) return
  visit(node, path)

  for (const key of SUBSCHEMA_MAP_KEYS) {
    if (isObject(node[key])) {
      for (const [name, child] of Object.entries(node[key])) {
        walk(child, joinPath(joinPath(path, key), name), visit)
      }
    }
  }
  for (const key of SUBSCHEMA_ARRAY_KEYS) {
    if (Array.isArray(node[key])) {
      node[key].forEach((child, i) => walk(child, `${joinPath(path, key)}[${i}]`, visit))
    }
  }
  for (const key of SUBSCHEMA_SINGLE_KEYS) {
    if (isObject(node[key])) walk(node[key], joinPath(path, key), visit)
  }
  // `additionalProperties` may itself be a schema object.
  if (isObject(node.additionalProperties)) {
    walk(node.additionalProperties, joinPath(path, 'additionalProperties'), visit)
  }
}

/** Resolve a local `#/a/b` pointer against the root schema. */
function resolvePointer(root, ref) {
  if (typeof ref !== 'string' || !ref.startsWith('#')) return undefined
  const parts = ref.slice(1).split('/').filter(Boolean)
  let node = root
  for (const raw of parts) {
    const part = raw.replace(/~1/g, '/').replace(/~0/g, '~')
    if (!isObject(node) && !Array.isArray(node)) return undefined
    node = node[part]
    if (node === undefined) return undefined
  }
  return node
}

/**
 * Detect `$ref` cycles (recursive schemas), which json_schema mode rejects.
 * Returns the list of refs that participate in a cycle.
 */
function findRecursiveRefs(root) {
  const cyclic = new Set()
  const visiting = new Set()

  function visitRef(ref, chain) {
    if (chain.includes(ref)) {
      cyclic.add(ref)
      return
    }
    if (visiting.has(ref)) return
    visiting.add(ref)
    const target = resolvePointer(root, ref)
    if (!isObject(target)) return
    walk(target, '', (node) => {
      if (typeof node.$ref === 'string') visitRef(node.$ref, [...chain, ref])
    })
  }

  walk(root, '', (node) => {
    if (typeof node.$ref === 'string') visitRef(node.$ref, [])
  })
  return [...cyclic]
}

/**
 * Audit a schema against Anthropic structured-output rules.
 *
 * @returns {{ok: boolean, findings: Array<{path: string, keyword: string, severity: 'error'|'warn', message: string}>}}
 */
export function auditSchema(schema) {
  const findings = []
  if (!isObject(schema)) {
    return {
      ok: false,
      findings: [
        { path: '', keyword: '', severity: 'error', message: 'Schema must be a JSON object.' },
      ],
    }
  }

  walk(schema, '', (node, path) => {
    for (const [keyword, why] of Object.entries(UNSUPPORTED_KEYWORDS)) {
      if (Object.hasOwn(node, keyword)) {
        findings.push({
          path: joinPath(path, keyword),
          keyword,
          severity: 'error',
          message: `"${keyword}" (${why}) is not supported by Anthropic json_schema mode.`,
        })
      }
    }
    for (const [keyword, why] of Object.entries(REVIEW_KEYWORDS)) {
      if (Object.hasOwn(node, keyword)) {
        findings.push({
          path: joinPath(path, keyword),
          keyword,
          severity: 'warn',
          message: `"${keyword}" — ${why}. Verify against your deployment.`,
        })
      }
    }

    const declaresObject =
      node.type === 'object' || (Array.isArray(node.type) && node.type.includes('object'))
    const looksLikeObject = declaresObject || isObject(node.properties)

    if (looksLikeObject) {
      if (!Object.hasOwn(node, 'additionalProperties')) {
        findings.push({
          path: joinPath(path, 'additionalProperties'),
          keyword: 'additionalProperties',
          severity: 'error',
          message: 'Objects must set "additionalProperties": false.',
        })
      } else if (node.additionalProperties !== false) {
        findings.push({
          path: joinPath(path, 'additionalProperties'),
          keyword: 'additionalProperties',
          severity: 'error',
          message: '"additionalProperties" must be exactly false.',
        })
      }
    }
  })

  for (const ref of findRecursiveRefs(schema)) {
    findings.push({
      path: ref,
      keyword: '$ref',
      severity: 'error',
      message: `Recursive $ref "${ref}" — recursive schemas are not supported.`,
    })
  }

  return { ok: !findings.some((f) => f.severity === 'error'), findings }
}

/**
 * Return a copy of `schema` with unsupported keywords removed.
 * Opt-in only. `removed` lists every deletion so you can review the diff.
 */
export function stripSchema(schema) {
  const removed = []
  const clone = structuredClone(schema)

  walk(clone, '', (node, path) => {
    for (const keyword of Object.keys(UNSUPPORTED_KEYWORDS)) {
      if (Object.hasOwn(node, keyword)) {
        removed.push({ path: joinPath(path, keyword), keyword, value: node[keyword] })
        delete node[keyword]
      }
    }
    const looksLikeObject =
      node.type === 'object' ||
      (Array.isArray(node.type) && node.type.includes('object')) ||
      isObject(node.properties)
    if (looksLikeObject && node.additionalProperties !== false) {
      removed.push({
        path: joinPath(path, 'additionalProperties'),
        keyword: 'additionalProperties',
        value: node.additionalProperties,
      })
      node.additionalProperties = false
    }
  })

  return { schema: clone, removed }
}

/** Human-readable audit report, for CLI output. */
export function formatFindings(findings) {
  if (!findings.length) return '  (no findings)'
  return findings
    .map((f) => `  [${f.severity === 'error' ? 'BLOCK' : ' warn'}] ${f.path || '<root>'}: ${f.message}`)
    .join('\n')
}
