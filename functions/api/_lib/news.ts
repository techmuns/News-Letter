/* Recent-news lookup for the Daily Pulse "Topic" mode.

   Uses the Google Custom Search JSON API (GOOGLE_API_KEY + GOOGLE_CSE_ID). The
   search engine (cx) must be configured to "Search the entire web" in the
   Programmable Search Engine control panel — not restricted to a single site —
   so a keyword returns real news across sources. Returns [] when unconfigured
   or nothing recent is found (the caller turns that into a friendly message and
   never fabricates). */
import type { Env } from './env'
import { ApiError } from './http'

export interface NewsItem {
  title: string
  snippet: string
  /** the source domain, e.g. "reuters.com" */
  source: string
  link: string
  /** best-effort publish date (YYYY-MM-DD) or a relative phrase, may be '' */
  date: string
}

const ENDPOINT = 'https://www.googleapis.com/customsearch/v1'
const DATE_RE = /^([A-Z][a-z]{2,8}\.? \d{1,2}, \d{4}|\d+\s+(?:hour|day|week|month)s?\s+ago)/

export function newsConfigured(env: Env): boolean {
  return Boolean(env.GOOGLE_API_KEY && env.GOOGLE_CSE_ID)
}

function cleanSource(displayLink: unknown): string {
  return String(displayLink || '')
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .split('/')[0]
}

function itemDate(item: any): string {
  const m = (item?.pagemap?.metatags?.[0] || {}) as Record<string, string>
  const iso =
    m['article:published_time'] ||
    m['og:updated_time'] ||
    m['article:modified_time'] ||
    item?.pagemap?.newsarticle?.[0]?.datepublished ||
    ''
  if (iso) {
    const d = new Date(iso)
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10)
  }
  const mm = String(item?.snippet || '').match(DATE_RE)
  return mm ? mm[1] : ''
}

function cleanSnippet(sn: unknown): string {
  return String(sn || '')
    .replace(DATE_RE, '')
    .replace(/^\s*\.\.\.\s*/, '')
    .replace(/\s+/g, ' ')
    .trim()
}

async function queryGoogle(env: Env, q: string, dateRestrict: string): Promise<NewsItem[]> {
  const url = new URL(ENDPOINT)
  url.searchParams.set('key', env.GOOGLE_API_KEY as string)
  url.searchParams.set('cx', env.GOOGLE_CSE_ID as string)
  url.searchParams.set('q', q)
  url.searchParams.set('num', '6')
  url.searchParams.set('gl', 'in')
  url.searchParams.set('hl', 'en')
  if (dateRestrict) url.searchParams.set('dateRestrict', dateRestrict)

  let res: Response
  try {
    res = await fetch(url.toString(), { headers: { accept: 'application/json' } })
  } catch {
    throw new ApiError('News search failed — could not reach Google Custom Search.', 502)
  }
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new ApiError(
      `News search failed (Google API ${res.status}). Check that GOOGLE_API_KEY is valid, the "Custom Search API" is enabled for it, and the engine (GOOGLE_CSE_ID) is set to "Search the entire web". ${body.slice(0, 180)}`.trim(),
      502,
    )
  }
  const data: any = await res.json().catch(() => null)
  const items: any[] = Array.isArray(data?.items) ? data.items : []
  return items
    .map((it) => ({
      title: String(it?.title || '').trim(),
      snippet: cleanSnippet(it?.snippet),
      source: cleanSource(it?.displayLink),
      link: String(it?.link || '').trim(),
      date: itemDate(it),
    }))
    .filter((n) => n.title && n.link && n.snippet)
}

/** Recent news for a keyword. Prefers the last month; broadens to the last ~6
    months only if nothing recent turns up. [] when unconfigured / none found. */
export async function fetchTopicNews(env: Env, topic: string): Promise<NewsItem[]> {
  if (!newsConfigured(env)) return []
  const q = topic.trim()
  if (!q) return []

  let items = await queryGoogle(env, q, 'm1')
  if (items.length === 0) items = await queryGoogle(env, q, 'm6')

  // Dedupe by link, keep order (most relevant/recent first).
  const seen = new Set<string>()
  const out: NewsItem[] = []
  for (const it of items) {
    if (seen.has(it.link)) continue
    seen.add(it.link)
    out.push(it)
  }
  return out.slice(0, 6)
}
