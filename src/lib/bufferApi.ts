/* Buffer OAuth ("Connect Buffer") — isolated frontend service module.
   Every call takes the live Munshot host token explicitly (from
   useHostSession()) rather than reading a module-level global, so there's
   no risk of a stale token surviving a session refresh or logout. The token
   is nullable: when the app isn't embedded in Munshot (guest mode), calls go
   out with no Authorization header at all, and the backend falls back to a
   single shared guest identity (see functions/api/_lib/munshotAuth.ts) —
   that's why every call here still sends the app secret, the same gate the
   rest of the app already uses to keep write endpoints from being fully open. */
import { getAppSecret } from './api'

const BASE = (import.meta.env.VITE_API_BASE as string) || '/api'

export interface BufferOrganization {
  id: string
  name: string
  ownerEmail?: string
}

export interface BufferChannel {
  id: string
  name?: string
  displayName?: string
  service: string
  isLinkedIn: boolean
}

export interface BufferConnection {
  status: 'connected' | 'disconnected'
  organizationId: string | null
  channelId: string | null
  channelName: string | null
  channelService: string | null
}

class BufferApiError extends Error {}

async function request<T>(
  munshotToken: string | null,
  path: string,
  init?: RequestInit,
): Promise<T> {
  const secret = getAppSecret()
  let res: Response
  try {
    res = await fetch(`${BASE}${path}`, {
      ...init,
      headers: {
        'content-type': 'application/json',
        ...(munshotToken ? { authorization: `Bearer ${munshotToken}` } : {}),
        ...(secret ? { 'x-app-secret': secret } : {}),
        ...(init?.headers || {}),
      },
    })
  } catch {
    throw new BufferApiError('Could not reach the backend.')
  }
  const data = await res.json().catch(() => ({}) as any)
  if (!res.ok) throw new BufferApiError((data as any)?.error || `Request failed (${res.status})`)
  return data as T
}

export const bufferApi = {
  /** Starts the OAuth handshake: asks the backend for a Buffer authorize URL
      (it generates and stores the PKCE verifier + state), then the caller is
      expected to navigate the browser there — see connectBuffer() below. */
  getAuthorizeUrl: (munshotToken: string | null) =>
    request<{ ok: true; authorizeUrl: string }>(munshotToken, '/auth/buffer'),

  /** Fetches the authorize URL then redirects the whole page to Buffer. */
  connectBuffer: async (munshotToken: string | null) => {
    const { authorizeUrl } = await bufferApi.getAuthorizeUrl(munshotToken)
    window.location.href = authorizeUrl
  },

  connection: (munshotToken: string | null) =>
    request<{ ok: true; connection: BufferConnection }>(munshotToken, '/buffer/connection'),

  organizations: (munshotToken: string | null) =>
    request<{ ok: true; organizations: BufferOrganization[] }>(munshotToken, '/buffer/organizations'),

  channels: (munshotToken: string | null, organizationId: string) =>
    request<{ ok: true; organizationId: string; channels: BufferChannel[] }>(
      munshotToken,
      `/buffer/channels?organizationId=${encodeURIComponent(organizationId)}`,
    ),

  selectChannel: (munshotToken: string | null, input: { organizationId: string; channelId: string }) =>
    request<{ ok: true; channel: BufferChannel }>(munshotToken, '/buffer/select-channel', {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  post: (munshotToken: string | null, input: { text: string; imageUrl?: string; scheduledAt?: string }) =>
    request<{ ok: true; postId: string | null; status: string; dueAt: string | null; scheduled: boolean }>(
      munshotToken,
      '/buffer/posts',
      { method: 'POST', body: JSON.stringify(input) },
    ),

  disconnect: (munshotToken: string | null) =>
    request<{ ok: true }>(munshotToken, '/buffer/disconnect', { method: 'DELETE' }),
}
