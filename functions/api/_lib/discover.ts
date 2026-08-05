/* "Discover" — find public LinkedIn finance posts to riff on.

   Provider-agnostic: uses Tavily (recommended — easy signup, free tier) when
   TAVILY_API_KEY is set, else Serper/Google when SERPER_API_KEY is set.

   Why this is fine: we only read PUBLIC search results (constrained to
   linkedin.com) — no LinkedIn API, no feed scraping, ToS-safe. Trade-off:
   partial coverage and NO engagement metrics, so we rank by recency +
   finance-keyword match + curated creators, not by likes. */
import type { Env } from './env'
import { ApiError } from './http'

/* Curated finance / fintech LinkedIn handles (creators + companies).
   Edit freely — in "creators" mode each handle costs one search query. */
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

/** Bound per-creator queries so a Discover click can't burn credits. */
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

/** Common shape both providers normalize to. */
interface RawResult {
  title: string
  link: string
  snippet: string
  date: string
}

/* ---------- providers ---------- */

async function tavily(key: string, query: string, maxResults: number): Promise<RawResult[]> {
  const res = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      query,
      topic: 'general',
      search_depth: 'advanced',
      include_domains: ['linkedin.com'],
      time_range: 'month',
      max_results: maxResults,
    }),
  })
  if (!res.ok) {
    const t = await res.text().catch(() => '')
    throw new ApiError(`Tavily error ${res.status}: ${t.slice(0, 200)}`, res.status === 401 ? 401 : 502)
  }
  const data: any = await res.json().catch(() => ({}))
  const results: any[] = Array.isArray(data?.results) ? data.results : []
  return results.map((r) => ({
    title: String(r?.title || ''),
    link: String(r?.url || ''),
    snippet: String(r?.content || ''),
    date: String(r?.published_date || ''),
  }))
}

async function serper(key: string, q: string, num: number): Promise<RawResult[]> {
  const res = await fetch('https://google.serper.dev/search', {
    method: 'POST',
    headers: { 'X-API-KEY': key, 'content-type': 'application/json' },
    body: JSON.stringify({ q, num, gl: 'in', tbs: 'qdr:m' }), // qdr:m = past month
  })
  if (!res.ok) {
    const t = await res.text().catch(() => '')
    throw new ApiError(`Serper error ${res.status}: ${t.slice(0, 200)}`, res.status === 401 ? 401 : 502)
  }
  const data: any = await res.json().catch(() => ({}))
  const organic: any[] = Array.isArray(data?.organic) ? data.organic : []
  return organic.map((r) => ({
    title: String(r?.title || ''),
    link: String(r?.link || ''),
    snippet: String(r?.snippet || ''),
    date: String(r?.date || ''),
  }))
}

/* ---------- parsing + ranking ---------- */

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

function authorFrom(r: RawResult): string {
  const idx = r.title.toLowerCase().indexOf(' on linkedin')
  if (idx > 0) return r.title.slice(0, idx).trim()
  const posts = r.link.match(/linkedin\.com\/posts\/([^_/?#]+)/i)
  if (posts) return prettifyHandle(posts[1])
  const profile = r.link.match(/linkedin\.com\/in\/([^/?#]+)/i)
  if (profile) return prettifyHandle(profile[1])
  return 'LinkedIn author'
}

function toPost(r: RawResult): DiscoveredPost | null {
  if (!/linkedin\.com\/(posts|pulse)\//i.test(r.link)) return null
  const snippet = r.snippet.trim()
  if (!snippet) return null
  return { author: authorFrom(r), snippet, url: r.link, date: r.date }
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

/* ---------- entry point ---------- */

export async function searchPosts(env: Env, input: SearchInput): Promise<DiscoveredPost[]> {
  const useTavily = Boolean(env.TAVILY_API_KEY)
  const useSerper = !useTavily && Boolean(env.SERPER_API_KEY)
  if (!useTavily && !useSerper) {
    throw new ApiError(
      'No Discover key set — add TAVILY_API_KEY (recommended) or SERPER_API_KEY. See SETUP.md.',
      400,
    )
  }

  const mode = input.mode === 'creators' ? 'creators' : 'topic'
  const t = (input.topic || '').trim()
  const raw: RawResult[] = []

  if (useTavily) {
    const key = env.TAVILY_API_KEY!
    if (mode === 'creators') {
      const handles = CURATED_HANDLES.slice(0, MAX_CREATOR_QUERIES)
      if (handles.length) {
        // First call un-caught so a bad key surfaces clearly; rest best-effort.
        raw.push(...(await tavily(key, `${prettifyHandle(handles[0])} finance`, 6)))
        const rest = await Promise.all(
          handles.slice(1).map((h) => tavily(key, `${prettifyHandle(h)} finance`, 6).catch(() => [])),
        )
        for (const b of rest) raw.push(...b)
      }
    } else {
      const q = t ? `${t} finance` : 'finance cash flow profitability fundraising "unit economics"'
      raw.push(...(await tavily(key, q, 20)))
    }
  } else {
    const key = env.SERPER_API_KEY!
    if (mode === 'creators') {
      const handles = CURATED_HANDLES.slice(0, MAX_CREATOR_QUERIES)
      if (handles.length) {
        raw.push(...(await serper(key, `site:linkedin.com/posts/${handles[0]}`, 10)))
        const rest = await Promise.all(
          handles.slice(1).map((h) => serper(key, `site:linkedin.com/posts/${h}`, 10).catch(() => [])),
        )
        for (const b of rest) raw.push(...b)
      }
    } else {
      const topicPart = t ? `${t} OR ` : ''
      const q1 = `site:linkedin.com/posts (${topicPart}finance OR "cash flow" OR profitability OR margins OR fundraising OR "unit economics")`
      const q2 = `site:linkedin.com/pulse ${t || 'finance'}`
      raw.push(...(await serper(key, q1, 20)))
      raw.push(...(await serper(key, q2, 20).catch(() => [])))
    }
  }

  const posts = dedupeByUrl(raw.map(toPost).filter((p): p is DiscoveredPost => p !== null))
  posts.sort((a, b) => {
    const rd = recencyScore(b.date) - recencyScore(a.date)
    if (rd !== 0) return rd
    return keywordScore(b) - keywordScore(a)
  })
  return posts.slice(0, 15)
}
