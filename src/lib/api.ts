/* Client for the live /api backend (Cloudflare Pages Functions).
   Same-origin in production; override with VITE_API_BASE for split local dev. */
import type { ArticleContent as ArticleType } from '../types'

/** A bold-lead key finding for the Top Story ("Lead" bolded, then the detail). */
export interface KeyPoint {
  lead: string
  detail: string
}

/** The "Spotlight" section — a deeper read split into the two views the
    reference newsletter uses (what the Street thinks vs. what the press says). */
export interface EmailSpotlight {
  headline: string
  story: string
  wallStreetView: string
  pressView: string
  /** a verbatim quote lifted from a provided source; empty when none is grounded */
  pressQuote: string
}

/** The full newsletter-digest section produced alongside every post. */
export interface EmailSection {
  subject: string
  preheader: string
  idea: string
  story: string
  takeaway: string
  ctaLabel: string
  /** Top-Story key findings (bold lead + detail). */
  keyPoints?: KeyPoint[]
  /** the Spotlight deep-dive (headline → Wall Street / Press views). */
  spotlight?: EmailSpotlight
}

export interface GeneratedContent {
  topic: string
  linkedin: { headline: string; body: string; hashtags: string[] }
  email: EmailSection
}

/** A sourced news result backing a Topic-mode post. */
export interface NewsItem {
  title: string
  snippet: string
  source: string
  link: string
  date: string
}

/** Daily Pulse post — style #1 caption (hook → emoji bullets → hashtags) + email. */
export interface PulsePost {
  focus: string
  linkedin: {
    hook: string
    bullets: string[]
    /** closing line — an open question rather than a summary; may be absent
        on posts generated before this field existed. */
    close?: string
    hashtags: string[]
  }
  email: EmailSection
}

export interface HealthFlags {
  ok: boolean
  dailyPulse: boolean
  images: boolean
  ai: boolean
  /** which AI provider is wired: 'bedrock' | 'anthropic' | 'none' */
  aiProvider: string
  /** Topic mode (recent-news lookup) is wired — NewsAPI key set */
  topicNews: boolean
  /** Live stock/company search is wired — Munshot token set */
  stockSearch: boolean
  linkedin: boolean
  /** per-user "Connect Buffer" OAuth is wired (client id/secret/redirect + D1 + encryption key) */
  bufferOAuth: boolean
  email: boolean
  emailProvider: string
  authRequired: boolean
  model: string
  hasDefaultRecipients: boolean
}

export type PulseGroup = 'index' | 'currency' | 'commodity' | 'holding'

export interface PulseItem {
  id: string
  group: PulseGroup
  name: string
  ticker: string
  current: number
  unit?: string
  sector?: string
  /** percent change: 1-day, 5-day, 1-month */
  d1: number
  d5: number
  m1: number
  spark: number[]
}

export interface PulseFeed {
  fetchedAt: string
  items: PulseItem[]
}

/** A company/instrument from the live stock search. */
export interface StockResult {
  symbol: string
  name: string
  country: string
  sector: string
}

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
  /** Latest Daily Market Pulse snapshot — pickable market moves for Studio. */
  dailyPulse: () => request<{ ok: true } & PulseFeed>('/daily-pulse'),
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
  generate: (input: {
    sourceText: string
    dashboardSnippet?: string
    tone?: string
    /** Attached screenshots/charts (base64, no data: prefix) for vision. */
    images?: { mediaType: string; data: string }[]
  }) =>
    request<{ ok: true; content: GeneratedContent }>('/generate', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  /** Generate today's Daily Pulse post from the live feed (optional focus + tone). */
  pulseGenerate: (input: { focusId?: string; tone?: string }) =>
    request<{ ok: true; post: PulsePost; fetchedAt: string }>('/pulse-generate', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  /** Live company/stock search (proxied to the Munshot backend). */
  stockSearch: (query: string) =>
    request<{ ok: true; total: number; results: StockResult[] }>('/stock-search', {
      method: 'POST',
      body: JSON.stringify({ query }),
    }),
  /** Generate a post from recent news on a keyword/topic (grounded in sources).
      `market` carries today's live index/price numbers from the feed — when
      present, the caption uses THOSE figures (not stale ones from the news), so
      the words match the market card. */
  topicGenerate: (input: {
    topic: string
    tone?: string
    market?: { name: string; value: number; changePct: number }[]
  }) =>
    request<{ ok: true; post: PulsePost; sources: NewsItem[]; topic: string }>('/topic-generate', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  /** Expand a recorded post + email into a full long-form article. */
  generateArticle: (input: {
    title?: string
    topic?: string
    linkedin?: string
    email?: { subject?: string; idea?: string; story?: string; takeaway?: string }
    tone?: string
  }) =>
    request<{ ok: true; article: ArticleType }>('/generate-article', {
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
