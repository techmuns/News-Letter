/* "Discover" — find public LinkedIn finance posts to riff on, and auto-discover
   the finance creators worth tracking.

   Provider-agnostic search, in priority order: Google Custom Search JSON API
   (GOOGLE_API_KEY + GOOGLE_CSE_ID) → Tavily → Serper. Creator discovery needs
   the `/posts/<handle>_…` URL shape + "| N comments" titles, so it uses Google
   or Serper (both are Google's index), never Tavily.

   ToS-safe: we only read PUBLIC search results constrained to linkedin.com —
   no LinkedIn API, no feed scraping, no engagement metrics beyond the public
   comment counts Google surfaces. */
import { discoverProviderName, type DiscoverProvider, type Env } from './env'
import { ApiError } from './http'

/* Fallback finance / fintech handles used by creators mode when the caller
   hasn't supplied a tracked list yet. */
export const CURATED_HANDLES: string[] = [
  'nithin-kamath', 'nikhilkamathcio', 'zerodha', 'groww', 'cred', 'razorpay',
  'ashneer-grover', 'sajith-pai', 'ankurwarikoo', 'sharanhegde', 'paytm', 'phonepe',
]

/** Bound per-creator queries so one search can't burn free-tier credits. */
const MAX_CREATOR_QUERIES = 15

/** Broad finance queries used to auto-discover creators. */
const DISCOVERY_TOPICS = [
  'CFO', 'cash flow', 'valuation', 'markets', 'investing', 'fundraising',
  'unit economics', 'earnings', 'private equity', 'startup finance',
]

export type Freshness = 'day' | 'week' | 'month'

export interface SearchInput {
  topic?: string
  mode?: 'topic' | 'creators'
  /** creators mode: explicit handle list (from the tracked leaderboard) */
  handles?: string[]
  /** search recency window; defaults to 'week' */
  freshness?: Freshness
}

export interface DiscoveredPost {
  author: string
  snippet: string
  url: string
  date: string
  /** light engagement signal parsed from the title ("| N comments"); 0 if unknown */
  comments?: number
}

export interface Creator {
  handle: string
  name: string
  appearances: number
  totalComments: number
}

/** Common shape both providers normalize to. */
export interface RawResult {
  title: string
  link: string
  snippet: string
  date: string
}

function freshnessToQdr(f?: Freshness): 'd' | 'w' | 'm' {
  return f === 'day' ? 'd' : f === 'month' ? 'm' : 'w'
}

/* ---------- providers ---------- */

async function tavily(
  key: string,
  query: string,
  maxResults: number,
  freshness: Freshness = 'week',
): Promise<RawResult[]> {
  const res = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      query,
      topic: 'general',
      search_depth: 'advanced',
      include_domains: ['linkedin.com'],
      time_range: freshness,
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

async function serper(
  key: string,
  q: string,
  num: number,
  freshness: Freshness = 'week',
): Promise<RawResult[]> {
  const res = await fetch('https://google.serper.dev/search', {
    method: 'POST',
    headers: { 'X-API-KEY': key, 'content-type': 'application/json' },
    body: JSON.stringify({ q, num, gl: 'in', tbs: `qdr:${freshnessToQdr(freshness)}` }),
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

/** Freshness → Google CSE `dateRestrict` (d1 = past day, w1 = week, m1 = month). */
function freshnessToDateRestrict(f?: Freshness): string {
  return f === 'day' ? 'd1' : f === 'month' ? 'm1' : 'w1'
}

/** Best-effort publish date for recency ranking: CSE metatags, else a date
    prefix Google often puts at the start of the snippet ("5 days ago", "Jun 5, 2024"). */
function googleItemDate(item: any): string {
  const mt = item?.pagemap?.metatags?.[0] || {}
  const iso =
    mt['article:published_time'] || mt['article:modified_time'] || mt['og:updated_time'] || ''
  if (iso) return String(iso)
  const s = String(item?.snippet || '')
  const rel = s.match(/^\s*(\d+\s+(?:hour|day|week|month)s?\s+ago)/i)
  if (rel) return rel[1]
  const abs = s.match(/^\s*([A-Z][a-z]{2}\s+\d{1,2},\s+\d{4})/)
  return abs ? abs[1] : ''
}

async function google(
  key: string,
  cx: string,
  q: string,
  num: number,
  freshness: Freshness = 'week',
): Promise<RawResult[]> {
  const params = new URLSearchParams({
    key,
    cx,
    q,
    num: String(Math.min(Math.max(num, 1), 10)), // CSE JSON API caps `num` at 10
    gl: 'in',
    dateRestrict: freshnessToDateRestrict(freshness),
  })
  const res = await fetch(`https://www.googleapis.com/customsearch/v1?${params.toString()}`)
  if (!res.ok) {
    const t = await res.text().catch(() => '')
    throw new ApiError(
      `Google CSE error ${res.status}: ${t.slice(0, 200)}`,
      res.status === 401 || res.status === 403 ? 401 : 502,
    )
  }
  const data: any = await res.json().catch(() => ({}))
  const items: any[] = Array.isArray(data?.items) ? data.items : []
  return items.map((r) => ({
    title: String(r?.title || ''),
    link: String(r?.link || ''),
    snippet: String(r?.snippet || ''),
    date: googleItemDate(r),
  }))
}

/** A provider-bound raw search: (query, num, freshness) → RawResult[]. */
type RawSearch = (q: string, num: number, freshness: Freshness) => Promise<RawResult[]>

/** Bind the chosen provider's fetch into one uniform search function. */
function boundSearch(env: Env, provider: DiscoverProvider): RawSearch {
  if (provider === 'google') {
    const key = env.GOOGLE_API_KEY!
    const cx = env.GOOGLE_CSE_ID!
    return (q, num, f) => google(key, cx, q, num, f)
  }
  if (provider === 'tavily') {
    const key = env.TAVILY_API_KEY!
    return (q, num, f) => tavily(key, q, num, f)
  }
  const key = env.SERPER_API_KEY!
  return (q, num, f) => serper(key, q, num, f)
}

/* ---------- parsing + ranking ---------- */

function prettifyHandle(h: string): string {
  return (
    h
      .replace(/-[0-9a-f]{6,}$/i, '')
      .split('-')
      .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
      .join(' ')
      .trim() || h
  )
}

/** The public handle from a /posts/<handle>_… URL (lowercased), or null. */
function handleFrom(url: string): string | null {
  const m = url.match(/linkedin\.com\/posts\/([^_/?#]+)/i)
  return m ? m[1].toLowerCase() : null
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

/** Light engagement signal — pulls "| 123 comments" (or "123 comments") from text. */
function parseComments(s: string): number {
  const piped = s.match(/\|\s*([\d,]+)\s*comments?/i)
  if (piped) return parseInt(piped[1].replace(/,/g, ''), 10) || 0
  const bare = s.match(/\b([\d,]+)\s*comments?\b/i)
  return bare ? parseInt(bare[1].replace(/,/g, ''), 10) || 0 : 0
}

function toPost(r: RawResult): DiscoveredPost | null {
  if (!/linkedin\.com\/(posts|pulse)\//i.test(r.link)) return null
  const snippet = r.snippet.trim()
  if (!snippet) return null
  return {
    author: authorFrom(r),
    snippet,
    url: r.link,
    date: r.date,
    comments: parseComments(r.title) || parseComments(r.snippet),
  }
}

function dedupeByUrl<T extends { url?: string; link?: string }>(items: T[]): T[] {
  const seen = new Set<string>()
  const out: T[] = []
  for (const it of items) {
    const raw = (it.url || it.link || '').split(/[?#]/)[0].replace(/\/+$/, '').toLowerCase()
    if (!raw || seen.has(raw)) continue
    seen.add(raw)
    out.push(it)
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

function recencyScore(date: string, now: number): number {
  if (!date) return 0
  const rel = date.toLowerCase().match(/(\d+)\s*(hour|day|week|month)s?\s*ago/)
  if (rel) {
    const n = parseInt(rel[1], 10)
    const unit = rel[2]
    const ms =
      unit === 'hour' ? 3.6e6 : unit === 'day' ? 8.64e7 : unit === 'week' ? 6.048e8 : 2.628e9
    return now - n * ms
  }
  const t = Date.parse(date)
  return isNaN(t) ? 0 : t
}

/* ---------- post search ---------- */

export async function searchPosts(env: Env, input: SearchInput): Promise<DiscoveredPost[]> {
  const provider = discoverProviderName(env)
  if (provider === 'none') {
    throw new ApiError(
      'No Discover key set — add GOOGLE_API_KEY + GOOGLE_CSE_ID (or SERPER_API_KEY / TAVILY_API_KEY). See SETUP.md.',
      400,
    )
  }

  const mode = input.mode === 'creators' ? 'creators' : 'topic'
  const t = (input.topic || '').trim()
  const fresh = input.freshness || 'week'
  const trackedHandles = (input.handles && input.handles.length ? input.handles : CURATED_HANDLES)
    .map((h) => h.trim())
    .filter(Boolean)
    .slice(0, MAX_CREATOR_QUERIES)
  const raw: RawResult[] = []
  const search = boundSearch(env, provider)

  if (provider === 'tavily') {
    // Tavily has no `site:` operator — use natural-language finance queries.
    if (mode === 'creators') {
      if (trackedHandles.length) {
        raw.push(...(await search(`${prettifyHandle(trackedHandles[0])} finance`, 6, fresh)))
        const rest = await Promise.all(
          trackedHandles.slice(1).map((h) => search(`${prettifyHandle(h)} finance`, 6, fresh).catch(() => [])),
        )
        for (const b of rest) raw.push(...b)
      }
    } else {
      const q = t ? `${t} finance` : 'finance cash flow profitability fundraising "unit economics"'
      raw.push(...(await search(q, 20, fresh)))
    }
  } else {
    // Google or Serper — identical site:linkedin.com/posts dorks + comment parsing.
    if (mode === 'creators') {
      if (trackedHandles.length) {
        raw.push(...(await search(`site:linkedin.com/posts/${trackedHandles[0]}`, 10, fresh)))
        const rest = await Promise.all(
          trackedHandles.slice(1).map((h) => search(`site:linkedin.com/posts/${h}`, 10, fresh).catch(() => [])),
        )
        for (const b of rest) raw.push(...b)
      }
    } else {
      const topicPart = t ? `${t} OR ` : ''
      const q1 = `site:linkedin.com/posts (${topicPart}finance OR "cash flow" OR profitability OR margins OR fundraising OR "unit economics")`
      const q2 = `site:linkedin.com/pulse ${t || 'finance'}`
      raw.push(...(await search(q1, 20, fresh)))
      raw.push(...(await search(q2, 20, fresh).catch(() => [])))
    }
  }

  return rankResults(raw)
}

/** Pure step (map → dedupe → rank), exported for testing.
    Ranking: recency → engagement (comments) → finance-keyword match. */
export function rankResults(raw: RawResult[]): DiscoveredPost[] {
  const now = Date.now()
  const posts = dedupeByUrl(raw.map(toPost).filter((p): p is DiscoveredPost => p !== null))
  const scored = posts.map((p) => ({ p, rec: recencyScore(p.date, now), kw: keywordScore(p) }))
  scored.sort((a, b) => {
    if (a.rec !== b.rec) return b.rec - a.rec
    const cd = (b.p.comments || 0) - (a.p.comments || 0)
    if (cd !== 0) return cd
    return b.kw - a.kw
  })
  return scored.slice(0, 15).map((s) => s.p)
}

/* ---------- creator discovery ---------- */

/** Pure aggregation (exported for testing): raw results → ranked creators.
    Dedupe posts by URL first, then per handle: distinct-post count + total comments. */
export function aggregateCreators(raw: RawResult[]): Creator[] {
  const map = new Map<string, Creator>()
  for (const r of dedupeByUrl(raw)) {
    const handle = handleFrom(r.link)
    if (!handle) continue
    const name = authorFrom(r)
    const comments = parseComments(r.title) || parseComments(r.snippet)
    const existing = map.get(handle)
    if (existing) {
      existing.appearances += 1
      existing.totalComments += comments
      if (existing.name === 'LinkedIn author' && name !== 'LinkedIn author') existing.name = name
    } else {
      map.set(handle, {
        handle,
        name: name === 'LinkedIn author' ? prettifyHandle(handle) : name,
        appearances: 1,
        totalComments: comments,
      })
    }
  }
  const list = [...map.values()]
  list.sort((a, b) => b.appearances - a.appearances || b.totalComments - a.totalComments)
  return list.slice(0, 30)
}

/** Run broad finance searches and rank the finance creators that surface most. */
export async function discoverCreators(env: Env, freshness: Freshness = 'week'): Promise<Creator[]> {
  // Needs the /posts/<handle>_… + "| N comments" shape → Google CSE or Serper.
  const provider: DiscoverProvider | null =
    env.GOOGLE_API_KEY && env.GOOGLE_CSE_ID ? 'google' : env.SERPER_API_KEY ? 'serper' : null
  if (!provider) {
    throw new ApiError(
      'Creator discovery needs GOOGLE_API_KEY + GOOGLE_CSE_ID (or SERPER_API_KEY). See SETUP.md.',
      400,
    )
  }
  const search = boundSearch(env, provider)
  const raw: RawResult[] = []
  // First call un-caught so a bad key surfaces clearly; the rest are best-effort.
  raw.push(...(await search(`site:linkedin.com/posts ${DISCOVERY_TOPICS[0]}`, 20, freshness)))
  const rest = await Promise.all(
    DISCOVERY_TOPICS.slice(1).map((topic) =>
      search(`site:linkedin.com/posts ${topic}`, 20, freshness).catch(() => []),
    ),
  )
  for (const b of rest) raw.push(...b)
  return aggregateCreators(raw)
}
