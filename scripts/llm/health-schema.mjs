/**
 * The probe used by every preflight surface (CLI and Pages Function).
 *
 * Deliberately tiny: two scalar fields, no keywords Anthropic rejects, so the
 * call costs almost nothing while still exercising the real structured-output
 * path end to end.
 *
 * Kept in its own module so the Worker never has to import the Node CLI.
 */

export const HEALTH_SCHEMA = {
  type: 'object',
  properties: {
    ok: { type: 'boolean', description: 'Always true.' },
    echo: { type: 'string', description: 'The literal string "pong".' },
  },
  required: ['ok', 'echo'],
  additionalProperties: false,
}

export const HEALTH_MESSAGES = [
  { role: 'user', content: 'Health check. Respond with ok=true and echo="pong". Nothing else.' },
]

/**
 * Small but with room for thinking tokens, which are on by default on Opus 5
 * in json_schema mode and count against max_tokens.
 */
export const HEALTH_MAX_TOKENS = 2048
