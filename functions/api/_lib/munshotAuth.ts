/* Identifies "the authenticated user" for the Buffer OAuth feature from the
   Munshot host JWT (the same token the frontend receives from the Munshot
   Dashboard SDK — see src/lib/sdk.ts) forwarded as `Authorization: Bearer`.

   This identity is what every per-user Buffer connection is keyed on, so it
   is the boundary between one client's LinkedIn account and another's.

   THREE MODES, chosen by configuration (see jwtVerify.ts):

   1. VERIFIED + ENFORCED — a key source is configured AND
      MUNSHOT_REQUIRE_VERIFIED_SESSION=true. Every request must carry a
      Munshot JWT with a valid signature; nothing else gets in. This is the
      only mode safe for multiple real clients, and the one to run in
      production.

   2. VERIFIED + PERMISSIVE — a key source is configured but enforcement is
      off. A valid token gives that user their own isolated connection; a
      request with no token at all still falls back to the shared guest
      identity. Useful while rolling out, not a place to stay.

   3. UNVERIFIED (current default) — no key source configured, so the email
      claim is read WITHOUT checking the signature. Anyone who can reach
      these endpoints can claim to be any email and reach that email's Buffer
      connection. There is no real per-client isolation in this mode.

   To reach mode 1, set one of MUNSHOT_JWKS_URL / MUNSHOT_JWT_PUBLIC_KEY /
   MUNSHOT_JWT_HMAC_SECRET (whichever Munshot's auth team provides), then set
   MUNSHOT_REQUIRE_VERIFIED_SESSION=true. No code change is needed. */
import type { Env } from './env'
import { ApiError } from './http'
import { jwtVerificationConfigured, requiresVerifiedSession, verifyMunshotJwt } from './jwtVerify'

/** Fallback identity used only in modes 2/3 when no Authorization header is
    present at all — i.e. the app opened standalone rather than embedded in
    Munshot. Everyone in this bucket SHARES one Buffer connection. */
export const GUEST_IDENTITY_EMAIL = 'guest@standalone.local'

function base64UrlDecodeToString(segment: string): string {
  const padded = segment.replace(/-/g, '+').replace(/_/g, '/')
  const withPadding = padded + '='.repeat((4 - (padded.length % 4)) % 4)
  return atob(withPadding)
}

function bearerToken(request: Request): string | null {
  const header = request.headers.get('authorization') || ''
  const match = header.match(/^Bearer\s+(.+)$/i)
  return match ? match[1].trim() : null
}

/** Reads the `email` claim out of a JWT's payload WITHOUT checking its
    signature. Only used in mode 3 — see the file header. */
export function decodeMunshotEmail(request: Request): string | null {
  const token = bearerToken(request)
  if (!token) return null
  const parts = token.split('.')
  if (parts.length < 2) return null
  try {
    const claims = JSON.parse(base64UrlDecodeToString(parts[1]))
    const email = typeof claims?.email === 'string' ? claims.email.trim().toLowerCase() : null
    return email && email.includes('@') ? email : null
  } catch {
    return null
  }
}

/**
 * Resolves the caller's identity for every Buffer route. Throws ApiError so
 * routes can surface it through `guard` like any other failure.
 */
export async function requireMunshotUser(request: Request, env: Env): Promise<string> {
  const token = bearerToken(request)
  const verificationOn = jwtVerificationConfigured(env)
  const enforce = requiresVerifiedSession(env)

  if (verificationOn) {
    if (token) return (await verifyMunshotJwt(env, token)).email
    if (enforce) {
      throw new ApiError(
        'This dashboard must be opened from inside Munshot — a verified Munshot session is required.',
        401,
      )
    }
    return GUEST_IDENTITY_EMAIL
  }

  // Mode 3 — no key configured. Enforcement without a way to verify would
  // lock everyone out, so it's refused loudly as a misconfiguration rather
  // than silently ignored.
  if (enforce) {
    throw new ApiError(
      'MUNSHOT_REQUIRE_VERIFIED_SESSION is on but no verification key is configured (see SETUP.md).',
      500,
    )
  }
  if (!token) return GUEST_IDENTITY_EMAIL
  const email = decodeMunshotEmail(request)
  if (!email) {
    throw new ApiError(
      'Missing or invalid Munshot session — open this from inside the Munshot dashboard and try again.',
      401,
    )
  }
  return email
}
