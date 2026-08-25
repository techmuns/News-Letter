/* Per-user Buffer OAuth connection state, stored in D1 (see migrations/).
   Tokens are encrypted at rest (crypto.ts) and never returned to the caller —
   only getValidAccessToken() decrypts one, and only for server-side use in
   the same request. Never log a value returned from this module. */
import type { Env } from './env'
import { ApiError } from './http'
import { decryptSecret, encryptSecret } from './crypto'
import { refreshBufferAccessToken } from './bufferOAuth'

export interface BufferConnectionSummary {
  status: 'connected' | 'disconnected'
  organizationId: string | null
  channelId: string | null
  channelName: string | null
  channelService: string | null
  /** True when a refresh token is stored, i.e. the connection can renew
      itself and will survive past the access token's ~1h lifetime. When
      false, the connection dies at token_expires_at and the user has to
      reconnect by hand — worth warning about rather than letting it
      surprise them mid-post. */
  longLived: boolean
}

function requireDb(env: Env) {
  if (!env.DB) throw new ApiError('D1 database is not bound (see SETUP.md — Buffer OAuth setup).', 500)
  return env.DB
}

const now = () => Math.floor(Date.now() / 1000)

export async function getConnectionSummary(env: Env, email: string): Promise<BufferConnectionSummary | null> {
  const db = requireDb(env)
  const row = await db
    .prepare(
      `SELECT status, organization_id, channel_id, channel_name, channel_service,
              token_expires_at, refresh_token_enc
       FROM buffer_connections WHERE user_email = ?`,
    )
    .bind(email)
    .first<any>()
  if (!row) return null

  // A stored status of 'connected' isn't enough on its own: the access token
  // may have expired since, and without a refresh token there is no way back
  // (Buffer has been observed not issuing one — see SETUP.md §3b). Report
  // that as disconnected so the UI offers "Connect Buffer" straight away,
  // instead of showing a connected card that dead-ends on the first click.
  const unrecoverable =
    row.status === 'connected' &&
    Number(row.token_expires_at) <= now() &&
    !row.refresh_token_enc

  return {
    status: unrecoverable ? 'disconnected' : row.status,
    organizationId: row.organization_id,
    channelId: row.channel_id,
    channelName: row.channel_name,
    channelService: row.channel_service,
    longLived: Boolean(row.refresh_token_enc),
  }
}

/** Upserts the access/refresh token pair from a fresh OAuth exchange or
    refresh. Preserves any existing channel selection and, on a refresh
    response that omits a rotated refresh_token, the previous one. */
export async function saveTokens(
  env: Env,
  email: string,
  tokens: { accessToken: string; refreshToken?: string; expiresIn: number; scope?: string },
): Promise<void> {
  const db = requireDb(env)
  const accessEnc = await encryptSecret(env, tokens.accessToken)
  const refreshEnc = tokens.refreshToken ? await encryptSecret(env, tokens.refreshToken) : null
  const expiresAt = now() + tokens.expiresIn
  const ts = now()

  await db
    .prepare(
      `INSERT INTO buffer_connections (user_email, access_token_enc, refresh_token_enc, token_expires_at, scope, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'connected', ?, ?)
       ON CONFLICT(user_email) DO UPDATE SET
         access_token_enc = excluded.access_token_enc,
         refresh_token_enc = COALESCE(excluded.refresh_token_enc, buffer_connections.refresh_token_enc),
         token_expires_at = excluded.token_expires_at,
         scope = excluded.scope,
         status = 'connected',
         updated_at = excluded.updated_at`,
    )
    .bind(email, accessEnc, refreshEnc, expiresAt, tokens.scope || null, ts, ts)
    .run()
}

/** Persists the user's chosen LinkedIn channel. Caller is responsible for
    having already verified channelId actually belongs to organizationId in
    *this* user's Buffer account (see worker/index.ts select-channel route) —
    this function just stores whatever it's given. */
export async function saveSelectedChannel(
  env: Env,
  email: string,
  channel: { organizationId: string; channelId: string; channelName: string | null; channelService: string | null },
): Promise<void> {
  const db = requireDb(env)
  const res: any = await db
    .prepare(
      `UPDATE buffer_connections
       SET organization_id = ?, channel_id = ?, channel_name = ?, channel_service = ?, updated_at = ?
       WHERE user_email = ? AND status = 'connected'`,
    )
    .bind(channel.organizationId, channel.channelId, channel.channelName, channel.channelService, now(), email)
    .run()
  const changed = res?.meta?.changes ?? res?.changes ?? 0
  if (!changed) throw new ApiError('Connect your Buffer account first.', 409)
}

/** Marks the connection disconnected and wipes the stored tokens/selection.
    The row itself is kept (rather than deleted) so history/audit stays put
    and a future re-OAuth just upserts over it. */
export async function disconnect(env: Env, email: string): Promise<void> {
  const db = requireDb(env)
  await db
    .prepare(
      `UPDATE buffer_connections
       SET status = 'disconnected', access_token_enc = '', refresh_token_enc = NULL,
           organization_id = NULL, channel_id = NULL, channel_name = NULL, channel_service = NULL,
           updated_at = ?
       WHERE user_email = ?`,
    )
    .bind(now(), email)
    .run()
}

const REFRESH_SKEW_SECONDS = 60

/** Returns a live Buffer access token for this user, transparently
    refreshing it first if it's within REFRESH_SKEW_SECONDS of expiry (Buffer
    refresh tokens are single-use, so a successful refresh always persists
    the newly-rotated refresh_token). If refreshing fails — or there's no
    refresh token to use — the connection is marked disconnected and the
    caller gets a 401 telling the user to reconnect, instead of a confusing
    downstream Buffer API error. */
export async function getValidAccessToken(env: Env, email: string): Promise<string> {
  const db = requireDb(env)
  const row = await db
    .prepare(
      `SELECT access_token_enc, refresh_token_enc, token_expires_at, status
       FROM buffer_connections WHERE user_email = ?`,
    )
    .bind(email)
    .first<{ access_token_enc: string; refresh_token_enc: string | null; token_expires_at: number; status: string }>()

  if (!row || row.status !== 'connected' || !row.access_token_enc) {
    throw new ApiError('Buffer is not connected — connect your Buffer account first.', 409)
  }

  if (row.token_expires_at - now() > REFRESH_SKEW_SECONDS) {
    return decryptSecret(env, row.access_token_enc)
  }

  if (!row.refresh_token_enc) {
    await disconnect(env, email)
    throw new ApiError('Your Buffer session expired — reconnect your Buffer account.', 401)
  }

  try {
    const refreshToken = await decryptSecret(env, row.refresh_token_enc)
    const fresh = await refreshBufferAccessToken(env, refreshToken)
    await saveTokens(env, email, {
      accessToken: fresh.access_token,
      refreshToken: fresh.refresh_token,
      expiresIn: fresh.expires_in,
      scope: fresh.scope,
    })
    return fresh.access_token
  } catch {
    await disconnect(env, email)
    throw new ApiError('Your Buffer session expired — reconnect your Buffer account.', 401)
  }
}
