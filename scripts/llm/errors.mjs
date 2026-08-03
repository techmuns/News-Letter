/**
 * Error classification shared by both providers.
 *
 * The distinction that matters: which failures should move on to the next
 * model, which should fall back to the other provider, and which are our own
 * bug and must surface immediately.
 */

export class LLMError extends Error {
  constructor(message, { kind = 'unknown', status = null, cause = null, attempts = [] } = {}) {
    super(message)
    this.name = 'LLMError'
    this.kind = kind
    this.status = status
    this.attempts = attempts
    if (cause) this.cause = cause
  }
}

/**
 * @returns {{status: number|null, kind: string, message: string,
 *            tryNextModel: boolean, tryNextProvider: boolean}}
 */
export function classifyError(err) {
  const status = typeof err?.status === 'number' ? err.status : null
  const apiMessage =
    err?.error?.error?.message ?? err?.error?.message ?? err?.message ?? String(err)
  const message = String(apiMessage)

  let kind
  switch (status) {
    case 400:
      kind = 'bad_request'
      break
    case 401:
      kind = 'auth'
      break
    case 403:
      kind = 'access'
      break
    case 404:
      kind = 'not_found'
      break
    case 413:
      kind = 'too_large'
      break
    case 429:
      kind = 'rate_limit'
      break
    default:
      if (status && status >= 500) kind = 'server'
      else if (status) kind = 'http'
      else kind = isNetworkError(err) ? 'network' : 'unknown'
  }

  return {
    status,
    kind,
    message,
    // 403/404 mean "this account can't use this model" — the next model may work.
    tryNextModel: kind === 'access' || kind === 'not_found',
    // Credential, capacity, and transport failures are worth retrying elsewhere.
    // A 400 is our own malformed request; falling back would just fail twice.
    tryNextProvider: ['auth', 'access', 'not_found', 'rate_limit', 'server', 'network'].includes(
      kind,
    ),
  }
}

function isNetworkError(err) {
  if (err?.name === 'APIConnectionError' || err?.name === 'APIConnectionTimeoutError') return true
  const code = err?.code ?? err?.cause?.code
  return (
    typeof code === 'string' &&
    ['ECONNREFUSED', 'ENOTFOUND', 'ECONNRESET', 'ETIMEDOUT', 'EAI_AGAIN', 'UND_ERR_CONNECT_TIMEOUT'].includes(
      code,
    )
  )
}

/**
 * True when a 400 means "this deployment does not accept output_config".
 * Observed message: `output_config.format: Extra inputs are not permitted`.
 */
export function isOutputConfigRejection(info) {
  if (info.status !== 400) return false
  return (
    /output_config/i.test(info.message) ||
    /extra inputs are not permitted/i.test(info.message) ||
    /unexpected keyword argument.*output_config/i.test(info.message)
  )
}

/**
 * True when a 400 means "forced tool_choice needs thinking disabled".
 * Bedrock requires `thinking: {type: "disabled"}` alongside a forced
 * `tool_choice` on Claude Sonnet 5.
 */
export function isThinkingWithForcedToolRejection(info) {
  if (info.status !== 400) return false
  return /thinking/i.test(info.message) && /tool_choice|tool choice|tool use/i.test(info.message)
}
