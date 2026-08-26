/* Server-side verification of Munshot-issued JWTs.

   The email claim in a Munshot JWT is the identity every per-user Buffer
   connection is keyed on (see bufferAccounts.ts), so it is only as
   trustworthy as this file. Decoding a JWT proves nothing — anyone can mint
   a payload — so the signature must be checked against a key the issuer
   controls before the email is used to look up or write anyone's data.

   Configuration is deliberately open about HOW the key is supplied, because
   different issuers expose different things. Exactly one of these is needed:

     MUNSHOT_JWKS_URL        a JWKS endpoint (RS256/ES256, supports key
                             rotation via `kid`) — preferred
     MUNSHOT_JWT_PUBLIC_KEY  a single public key as a JWK JSON object
                             (RS256/ES256), for issuers with a static key
     MUNSHOT_JWT_HMAC_SECRET a shared symmetric secret (HS256)

   Optional, checked only when set:
     MUNSHOT_JWT_ISSUER      expected `iss`
     MUNSHOT_JWT_AUDIENCE    expected `aud`

   `exp` (and `nbf`, when present) are always enforced once a token is
   verified. */
import type { Env } from './env'
import { ApiError } from './http'

export interface MunshotClaims {
  email: string
  [key: string]: unknown
}

function base64UrlToBytes(segment: string): Uint8Array {
  const padded = segment.replace(/-/g, '+').replace(/_/g, '/')
  const withPadding = padded + '='.repeat((4 - (padded.length % 4)) % 4)
  const binary = atob(withPadding)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

function base64UrlToJson(segment: string): any {
  return JSON.parse(new TextDecoder().decode(base64UrlToBytes(segment)))
}

/** True when at least one verification key source is configured. Until one
    is, verified sessions are impossible and the caller must decide whether
    to fail closed (see MUNSHOT_REQUIRE_VERIFIED_SESSION). */
export function jwtVerificationConfigured(env: Env): boolean {
  return Boolean(env.MUNSHOT_JWKS_URL || env.MUNSHOT_JWT_PUBLIC_KEY || env.MUNSHOT_JWT_HMAC_SECRET)
}

/** Whether unverified/missing sessions must be rejected outright. Off by
    default so enabling verification can't silently lock out an existing
    deployment; turn it on once a key source is configured and tested. */
export function requiresVerifiedSession(env: Env): boolean {
  return String(env.MUNSHOT_REQUIRE_VERIFIED_SESSION || '').toLowerCase() === 'true'
}

/* ---- JWKS fetching, cached per isolate ---- */

interface CachedJwks {
  keys: any[]
  fetchedAt: number
}
const JWKS_TTL_MS = 10 * 60 * 1000
let jwksCache: { url: string; value: CachedJwks } | null = null

async function fetchJwks(url: string, forceRefresh = false): Promise<any[]> {
  const now = Date.now()
  if (
    !forceRefresh &&
    jwksCache &&
    jwksCache.url === url &&
    now - jwksCache.value.fetchedAt < JWKS_TTL_MS
  ) {
    return jwksCache.value.keys
  }
  let res: Response
  try {
    res = await fetch(url, { headers: { accept: 'application/json' } })
  } catch {
    throw new ApiError('Could not reach the Munshot key endpoint to verify your session.', 502)
  }
  if (!res.ok) throw new ApiError(`Munshot key endpoint returned ${res.status}.`, 502)
  const data: any = await res.json().catch(() => null)
  const keys = Array.isArray(data?.keys) ? data.keys : []
  if (!keys.length) throw new ApiError('Munshot key endpoint returned no keys.', 502)
  jwksCache = { url, value: { keys, fetchedAt: now } }
  return keys
}

const ALG_IMPORT: Record<string, { algorithm: any; verify: any }> = {
  RS256: {
    algorithm: { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    verify: { name: 'RSASSA-PKCS1-v1_5' },
  },
  ES256: {
    algorithm: { name: 'ECDSA', namedCurve: 'P-256' },
    verify: { name: 'ECDSA', hash: 'SHA-256' },
  },
}

async function verifyWithJwk(jwk: any, alg: string, signed: string, signature: Uint8Array): Promise<boolean> {
  const spec = ALG_IMPORT[alg]
  if (!spec) throw new ApiError(`Unsupported JWT algorithm: ${alg}`, 400)
  let key: CryptoKey
  try {
    key = await crypto.subtle.importKey('jwk', jwk, spec.algorithm, false, ['verify'])
  } catch {
    throw new ApiError('Munshot verification key could not be imported.', 500)
  }
  return crypto.subtle.verify(spec.verify, key, signature, new TextEncoder().encode(signed))
}

async function verifyWithHmac(secret: string, signed: string, signature: Uint8Array): Promise<boolean> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify'],
  )
  return crypto.subtle.verify('HMAC', key, signature, new TextEncoder().encode(signed))
}

/**
 * Verifies a Munshot JWT and returns its claims. Throws ApiError(401) when
 * the token is malformed, unsigned by a key we trust, expired, or fails an
 * configured iss/aud check. Throws ApiError(500) when no key source is
 * configured — callers should check jwtVerificationConfigured() first if
 * they intend to degrade rather than fail.
 */
export async function verifyMunshotJwt(env: Env, token: string): Promise<MunshotClaims> {
  if (!jwtVerificationConfigured(env)) {
    throw new ApiError('Munshot session verification is not configured on this deployment.', 500)
  }

  const parts = token.split('.')
  if (parts.length !== 3) throw new ApiError('Malformed Munshot session token.', 401)
  const [headerSeg, payloadSeg, signatureSeg] = parts

  let header: any
  let claims: any
  try {
    header = base64UrlToJson(headerSeg)
    claims = base64UrlToJson(payloadSeg)
  } catch {
    throw new ApiError('Malformed Munshot session token.', 401)
  }

  const alg = String(header?.alg || '')
  if (alg === 'none') throw new ApiError('Unsigned Munshot session tokens are not accepted.', 401)

  const signed = `${headerSeg}.${payloadSeg}`
  const signature = base64UrlToBytes(signatureSeg)

  let valid = false
  if (env.MUNSHOT_JWT_HMAC_SECRET && alg === 'HS256') {
    valid = await verifyWithHmac(env.MUNSHOT_JWT_HMAC_SECRET, signed, signature)
  } else if (env.MUNSHOT_JWKS_URL) {
    const tryKeys = async (forceRefresh: boolean) => {
      const keys = await fetchJwks(env.MUNSHOT_JWKS_URL!, forceRefresh)
      const candidates = header?.kid ? keys.filter((k) => k.kid === header.kid) : keys
      for (const jwk of candidates.length ? candidates : keys) {
        if (await verifyWithJwk(jwk, String(jwk.alg || alg), signed, signature)) return true
      }
      return false
    }
    valid = await tryKeys(false)
    // A brand-new signing key won't be in the cached set — refetch once
    // before rejecting, so key rotation doesn't cause a spurious outage.
    if (!valid) valid = await tryKeys(true)
  } else if (env.MUNSHOT_JWT_PUBLIC_KEY) {
    let jwk: any
    try {
      jwk = JSON.parse(env.MUNSHOT_JWT_PUBLIC_KEY)
    } catch {
      throw new ApiError('MUNSHOT_JWT_PUBLIC_KEY must be a JWK JSON object.', 500)
    }
    valid = await verifyWithJwk(jwk, String(jwk.alg || alg), signed, signature)
  } else {
    throw new ApiError(`No configured key can verify a ${alg || 'unknown'} token.`, 500)
  }

  if (!valid) throw new ApiError('Your Munshot session could not be verified.', 401)

  const now = Math.floor(Date.now() / 1000)
  if (typeof claims?.exp === 'number' && now >= claims.exp) {
    throw new ApiError('Your Munshot session has expired — reload the dashboard.', 401)
  }
  if (typeof claims?.nbf === 'number' && now < claims.nbf) {
    throw new ApiError('Your Munshot session is not valid yet.', 401)
  }
  if (env.MUNSHOT_JWT_ISSUER && claims?.iss !== env.MUNSHOT_JWT_ISSUER) {
    throw new ApiError('Your Munshot session came from an unexpected issuer.', 401)
  }
  if (env.MUNSHOT_JWT_AUDIENCE) {
    const aud = claims?.aud
    const ok = Array.isArray(aud) ? aud.includes(env.MUNSHOT_JWT_AUDIENCE) : aud === env.MUNSHOT_JWT_AUDIENCE
    if (!ok) throw new ApiError('Your Munshot session was issued for a different audience.', 401)
  }

  const email = typeof claims?.email === 'string' ? claims.email.trim().toLowerCase() : ''
  if (!email || !email.includes('@')) {
    throw new ApiError('Your Munshot session has no usable email claim.', 401)
  }
  return { ...claims, email }
}
