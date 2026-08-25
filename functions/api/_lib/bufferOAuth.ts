/* Buffer OAuth 2.0 (Authorization Code + PKCE) — protocol layer only.
   Verified against developers.buffer.com/guides/authentication.html:
   - Authorize: GET https://auth.buffer.com/auth (code_challenge/code_challenge_method
     are REQUIRED — PKCE is mandatory for every Buffer OAuth client, confidential or not).
   - Token:     POST https://auth.buffer.com/token (form-encoded).
   - Refresh tokens are single-use: every refresh returns a new refresh_token
     and invalidates the one that was sent.
   `offline_access` is requested so Buffer actually issues a refresh_token —
   without it there is nothing to refresh with once the access token expires. */
import type { Env } from './env'
import { ApiError } from './http'

const AUTHORIZE_URL = 'https://auth.buffer.com/auth'
const TOKEN_URL = 'https://auth.buffer.com/token'
const SCOPES = 'posts:read posts:write account:read offline_access'
/** Single-use OAuth state is only valid for this long — guards against a
    stale/replayed `state` value being redeemed long after the user bailed. */
const STATE_TTL_SECONDS = 600

function requireDb(env: Env) {
  if (!env.DB) throw new ApiError('D1 database is not bound (see SETUP.md — Buffer OAuth setup).', 500)
  return env.DB
}

export function buildAuthorizeUrl(env: Env, opts: { state: string; codeChallenge: string }): string {
  if (!env.BUFFER_CLIENT_ID) throw new ApiError('BUFFER_CLIENT_ID is not set (see SETUP.md).', 500)
  if (!env.BUFFER_REDIRECT_URI) throw new ApiError('BUFFER_REDIRECT_URI is not set (see SETUP.md).', 500)
  const params = new URLSearchParams({
    client_id: env.BUFFER_CLIENT_ID,
    redirect_uri: env.BUFFER_REDIRECT_URI,
    response_type: 'code',
    code_challenge: opts.codeChallenge,
    code_challenge_method: 'S256',
    scope: SCOPES,
    state: opts.state,
    // Present in Buffer's own documented authorize example. Forces a fresh
    // consent screen rather than silently reusing a prior grant — without
    // it Buffer was observed dropping `offline_access` from the granted
    // scope and returning no refresh_token, which capped every connection
    // at the access token's 1-hour lifetime.
    prompt: 'consent',
  })
  return `${AUTHORIZE_URL}?${params.toString()}`
}

export interface BufferTokenResponse {
  access_token: string
  refresh_token?: string
  token_type: string
  expires_in: number
  scope?: string
}

async function postToken(env: Env, body: Record<string, string>): Promise<BufferTokenResponse> {
  if (!env.BUFFER_CLIENT_ID) throw new ApiError('BUFFER_CLIENT_ID is not set (see SETUP.md).', 500)
  const params = new URLSearchParams({ client_id: env.BUFFER_CLIENT_ID, ...body })
  // Confidential clients send client_secret; omitted entirely for public clients.
  if (env.BUFFER_CLIENT_SECRET) params.set('client_secret', env.BUFFER_CLIENT_SECRET)

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  })
  const data: any = await res.json().catch(() => null)
  if (!res.ok || !data?.access_token) {
    // Deliberately surface only status + error_description/error — never the
    // request body, which carries the code/verifier/refresh_token/secret.
    const reason = data?.error_description || data?.error || `HTTP ${res.status}`
    throw new ApiError(`Buffer token request failed: ${reason}`, 502)
  }
  return data as BufferTokenResponse
}

export function exchangeCodeForToken(
  env: Env,
  opts: { code: string; codeVerifier: string },
): Promise<BufferTokenResponse> {
  if (!env.BUFFER_REDIRECT_URI) throw new ApiError('BUFFER_REDIRECT_URI is not set (see SETUP.md).', 500)
  return postToken(env, {
    grant_type: 'authorization_code',
    code: opts.code,
    redirect_uri: env.BUFFER_REDIRECT_URI,
    code_verifier: opts.codeVerifier,
  })
}

export function refreshBufferAccessToken(env: Env, refreshToken: string): Promise<BufferTokenResponse> {
  return postToken(env, { grant_type: 'refresh_token', refresh_token: refreshToken })
}

/* ---- PKCE `state` ↔ `code_verifier` handshake, persisted in D1 ----
   OAuth's authorize→callback round trip is two separate HTTP requests (the
   callback is a real browser navigation from Buffer, not something we can
   attach headers to), so the verifier has to survive between them somewhere
   server-side. Keyed by `state`, single-use, short TTL. */

export async function saveOAuthState(
  env: Env,
  opts: { state: string; email: string; codeVerifier: string },
): Promise<void> {
  const db = requireDb(env)
  const now = Math.floor(Date.now() / 1000)
  await db
    .prepare(`INSERT INTO buffer_oauth_state (state, user_email, code_verifier, created_at) VALUES (?, ?, ?, ?)`)
    .bind(opts.state, opts.email, opts.codeVerifier, now)
    .run()
}

/** Redeems (and always deletes) a `state` value. Returns null if it was
    never issued, already used, or has expired — all three look identical to
    the caller, which is the point (no information leak either way). */
export async function consumeOAuthState(
  env: Env,
  state: string,
): Promise<{ email: string; codeVerifier: string } | null> {
  const db = requireDb(env)
  const row = await db
    .prepare(`SELECT user_email, code_verifier, created_at FROM buffer_oauth_state WHERE state = ?`)
    .bind(state)
    .first<{ user_email: string; code_verifier: string; created_at: number }>()
  await db.prepare(`DELETE FROM buffer_oauth_state WHERE state = ?`).bind(state).run()
  if (!row) return null
  const now = Math.floor(Date.now() / 1000)
  if (now - row.created_at > STATE_TTL_SECONDS) return null
  return { email: row.user_email, codeVerifier: row.code_verifier }
}
