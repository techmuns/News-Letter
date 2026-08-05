/* "Discover" — find public LinkedIn finance posts via Serper (Google Search API).

   Why this is fine: Google indexes PUBLIC LinkedIn posts, and we only read
   public search results — no LinkedIn API, no feed scraping, ToS-safe, free tier.
   The trade-off: partial coverage and NO engagement metrics (likes/comments),
   so we rank by recency + finance-keyword match + curated creators, not by
   engagement. Perfect for surfacing ideas to riff on. */
import type { Env } from './env'
import { ApiError } from './http'

/* Curated finance / fintech LinkedIn handles (creators + companies).
   These are the public handles that appear in linkedin.com/posts/<handle>_… URLs.
   Edit freely — in "creators" mode each handle costs one Serper query. */
export const CURATED_HANDLES: string[] = [
  'nithin-kamath', // Nithin Kamath (Zerodha)
  'nikhilkamathcio', // Nikhil Kamath (Zerodha / True Beacon)
  'zerodha',
  'groww',
  'cred',
  'razorpay',
  'ashneer-grover',
  'sajith-pai', // Sajith Pai (Blume Ventures)
  'ankurwarikoo', // Ankur Warikoo
  'sharanhegde', // Sharan Hegde (Finance With Sharan)
  'paytm',
  'phonepe',
]

/** Bound the number of per-creator queries so a Discover click can't burn credits. */
const MAX_CREATOR_QUERIES = 10

export interface SearchInput {
  topic?: string
  mode?: 'topic' | 'creators'
}

export interface DiscoveredPost {
  author: string
  snippet: string
  url: string
  date: string
}

async function serper(apiKey: string, q: string, num: number): Promise<any[]> {
  const res = await fetch('https://google.serper.dev/search', {
    method: 'POST',
    headers: { 'X-API-KEY': apiKey, 'content-type': 'application/json' },
    body: JSON.stringify({ q, num, gl: 'in', tbs: 'qdr:m' }), // qdr:m = past month
  })
  if (!res.ok) {
    const t = await res.text().catch(() => '')
    throw new ApiError(`Serper error ${res.status}: ${t.slice(0, 200)}`, res.status === 401 ? 401 : 502)
  }
  const data: any = await res.json().catch(() => ({}))
  return Array.isArray(data?.organic) ? data.organic : []
}

function prettifyHandle(h: string): string {
  return (
    h
      .replace(/-[0-9a-f]{6,}$/i, '') // drop a trailing id-ish chunk
      .split('-')
      .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
      .join(' ')
      .trim() || h
  )
}

function authorFromResult(r: any): string {
  const title: string = r?.title || ''
  const idx = title.toLowerCase().indexOf(' on linkedin')
  if (idx > 0) return title.slice(0, idx).trim()
  const url = String(r?.link || '')
  const posts = url.match(/linkedin\.com\/posts\/([^_/?#]+)/i)
  if (posts) return prettifyHandle(posts[1])
  const profile = url.match(/linkedin\.com\/in\/([^/?#]+)/i)
  if (profile) return prettifyHandle(profile[1])
  return 'LinkedIn author'
}

function toPost(r: any): DiscoveredPost | null {
  const url = String(r?.link || '')
  if (!/linkedin\.com\/(posts|pulse)\//i.test(url)) return null
  const snippet = String(r?.snippet || '').trim()
  if (!snippet) return null
  return { author: authorFromResult(r), snippet, url, date: String(r?.date || '') }
}

function dedupeByUrl(posts: DiscoveredPost[]): DiscoveredPost[] {
  const seen = new Set<string>()
  const out: DiscoveredPost[] = []
  for (const p of posts) {
    const key = p.url.split(/[?#]/)[0].replace(/\/+$/, '').toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(p)
  }
  return out
}

const FINANCE_KW = [
  'finance', 'cash flow', 'profit', 'margin', 'fundrais', 'revenue', 'valuation',
  'unit economics', 'ebitda', 'burn', 'runway', 'ipo', 'funding', 'equity',
  'investor', 'startup', 'capital',
]

function keywordScore(p: DiscoveredPost): number {
  const hay = `${p.author} ${p.snippet}`.toLowerCase()
  return FINANCE_KW.reduce((n, k) => n + (hay.includes(k) ? 1 : 0), 0)
}

/** Best-effort recency: parses "5 days ago" / "Jan 10, 2026"; unknown → 0 (sinks). */
function recencyScore(date: string): number {
  if (!date) return 0
  const rel = date.toLowerCase().match(/(\d+)\s*(hour|day|week|month)s?\s*ago/)
  if (rel) {
    const n = parseInt(rel[1], 10)
    const unit = rel[2]
    const ms =
      unit === 'hour' ? 3.6e6 : unit === 'day' ? 8.64e7 : unit === 'week' ? 6.048e8 : 2.628e9
    return Date.now() - n * ms
  }
  const t = Date.parse(date)
  return isNaN(t) ? 0 : t
}

export async function searchPosts(env: Env, input: SearchInput): Promise<DiscoveredPost[]> {
  if (!env.SERPER_API_KEY) throw new ApiError('SERPER_API_KEY is not set (see SETUP.md).', 400)
  const key = env.SERPER_API_KEY
  const mode = input.mode === 'creators' ? 'creators' : 'topic'
  const raw: any[] = []

  if (mode === 'creators') {
    const handles = CURATED_HANDLES.slice(0, MAX_CREATOR_QUERIES)
    // First call is un-caught so a bad key / outage surfaces a clear error;
    // the rest are best-effort so one dud handle can't fail the whole search.
    if (handles.length) {
      raw.push(...(await serper(key, `site:linkedin.com/posts/${handles[0]}`, 10)))
      const rest = await Promise.all(
        handles.slice(1).map((h) => serper(key, `site:linkedin.com/posts/${h}`, 10).catch(() => [])),
      )
      for (const b of rest) raw.push(...b)
    }
  } else {
    const t = (input.topic || '').trim()
    const topicPart = t ? `${t} OR ` : ''
    const q1 = `site:linkedin.com/posts (${topicPart}finance OR "cash flow" OR profitability OR margins OR fundraising OR "unit economics")`
    const q2 = `site:linkedin.com/pulse ${t || 'finance'}`
    raw.push(...(await serper(key, q1, 20)))
    raw.push(...(await serper(key, q2, 20).catch(() => [])))
  }

  const posts = dedupeByUrl(raw.map(toPost).filter((p): p is DiscoveredPost => p !== null))
  posts.sort((a, b) => {
    const rd = recencyScore(b.date) - recencyScore(a.date)
    if (rd !== 0) return rd
    return keywordScore(b) - keywordScore(a)
  })
  return posts.slice(0, 15)
}
