/* Client for the live /api backend (Cloudflare Pages Functions).
   Same-origin in production; override with VITE_API_BASE for split local dev. */

export interface GeneratedContent {
  topic: string
  linkedin: { headline: string; body: string; hashtags: string[] }
  email: {
    subject: string
    preheader: string
    idea: string
    story: string
    takeaway: string
    ctaLabel: string
  }
}

export interface HealthFlags {
  ok: boolean
  discover: boolean
  discoverProvider?: string
  creators: boolean
  images: boolean
  ai: boolean
  linkedin: boolean
  email: boolean
  emailProvider: string
  authRequired: boolean
  model: string
  hasDefaultRecipients: boolean
}

export interface DiscoveredPost {
  author: string
  snippet: string
  url: string
  date: string
  comments?: number
}

export interface Creator {
  handle: string
  name: string
  appearances: number
  totalComments: number
}

export type Freshness = 'day' | 'week' | 'month'

const BASE = (import.meta.env.VITE_API_BASE as string) || '/api'

const SECRET_KEY = 'munshot-app-secret'
export function getAppSecret(): string {
  try {
    return localStorage.getItem(SECRET_KEY) || ''
  } catch {
    return ''
  }
}
export function setAppSecret(v: string) {
  try {
    if (v) localStorage.setItem(SECRET_KEY, v)
    else localStorage.removeItem(SECRET_KEY)
  } catch {
    /* ignore */
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const secret = getAppSecret()
  let res: Response
  try {
    res = await fetch(`${BASE}${path}`, {
      ...init,
      headers: {
        'content-type': 'application/json',
        ...(secret ? { 'x-app-secret': secret } : {}),
        ...(init?.headers || {}),
      },
    })
  } catch {
    throw new Error(
      'Could not reach the backend. Run it with the API attached (see SETUP.md), or deploy to Cloudflare.',
    )
  }
  const data = await res.json().catch(() => ({}) as any)
  if (!res.ok) throw new Error((data as any)?.error || `Request failed (${res.status})`)
  return data as T
}

export const api = {
  health: () => request<HealthFlags>('/health'),
  searchPosts: (input: {
    topic?: string
    mode?: 'topic' | 'creators'
    handles?: string[]
    freshness?: Freshness
  }) =>
    request<{ ok: true; posts: DiscoveredPost[] }>('/search-posts', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  discoverCreators: (input: { freshness?: Freshness }) =>
    request<{ ok: true; creators: Creator[] }>('/discover-creators', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  /** Upload the rendered branded PNG; returns an absolute public URL for Buffer. */
  uploadImage: async (blob: Blob): Promise<{ url: string; path: string }> => {
    const secret = getAppSecret()
    let res: Response
    try {
      res = await fetch(`${BASE}/upload-image`, {
        method: 'POST',
        headers: {
          'content-type': blob.type || 'image/png',
          ...(secret ? { 'x-app-secret': secret } : {}),
        },
        body: blob,
      })
    } catch {
      throw new Error('Could not reach the backend to upload the image.')
    }
    const data = await res.json().catch(() => ({}) as any)
    if (!res.ok) throw new Error((data as any)?.error || `Upload failed (${res.status})`)
    return data as { url: string; path: string }
  },
  generate: (input: { sourceText: string; dashboardSnippet?: string; tone?: string }) =>
    request<{ ok: true; content: GeneratedContent }>('/generate', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  publishLinkedIn: (input: { text: string; imageUrl?: string; scheduledAt?: string }) =>
    request<{ ok: true; postId: string | null; status: string; dueAt: string | null; scheduled: boolean }>(
      '/publish-linkedin',
      { method: 'POST', body: JSON.stringify(input) },
    ),
  sendEmail: (input: { subject: string; html: string; recipients?: string[] }) =>
    request<{ ok: true; provider: string; sent: number }>('/send-email', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
}
