/* Defense-in-depth checks applied on top of the vendor SDK's own origin
   check. Kept as pure, DOM-free functions so they're cheap to unit test. */
import type { SessionContext } from './sdk'

export function isTrustedOrigin(origin: string, allowedOrigins: readonly string[]): boolean {
  if (!origin || allowedOrigins.length === 0) return false // empty list => trust nothing
  return allowedOrigins.includes(origin) // exact scheme+host match only
}

const MAX_EMAIL_LENGTH = 320 // RFC 5321 upper bound

/**
 * Structural check on the session payload a host message claims to carry.
 * This is not email validation for its own sake — it stops a malformed or
 * hostile payload smuggling something unexpected into the fields the app
 * acts on (identity display, headers, rendering).
 */
export function isValidSessionPayload(session: unknown): session is SessionContext {
  if (!session || typeof session !== 'object') return false
  const s = session as Record<string, unknown>

  if (s.email !== null && s.email !== undefined) {
    if (typeof s.email !== 'string') return false
    if (s.email.length === 0 || s.email.length > MAX_EMAIL_LENGTH) return false
    if (!s.email.includes('@')) return false
  }
  for (const key of ['token', 'userName', 'orgId', 'orgName'] as const) {
    if (s[key] !== null && s[key] !== undefined && typeof s[key] !== 'string') return false
  }
  return true
}
