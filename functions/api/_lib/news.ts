/* Recent-news lookup for the Daily Pulse "Topic" mode.

   Uses the NewsAPI.org "everything" endpoint (NEWSAPI_KEY). A keyword returns
   real, recent articles across sources; each article's title/description/url/
   source.name/publishedAt becomes the ONLY factual basis for the generated post.
   Returns [] when unconfigured or nothing recent is found (the caller turns that
   into a friendly "no recent news" message and never fabricates). */
import type { Env } from './env'
import { ApiError } from './http'

export interface NewsItem {
  title: string
  snippet: string
  /** the source name, e.g. "Reuters" */
  source: string
  link: string
  /** best-effort publish date (YYYY-MM-DD), may be '' */
  date: string
}

const ENDPOINT = 'https://newsapi.org/v2/everything'

export function newsConfigured(env: Env): boolean {
  return Boolean(env.NEWSAPI_KEY)
}

function fmtDate(publishedAt: unknown): string {
  const s = String(publishedAt || '').trim()
  if (!s) return ''
  const d = new Date(s)
  return isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10)
}

function cleanSnippet(sn: unknown): string {
  return String(sn || '')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Recent news for a keyword, most-recent first. [] when unconfigured or when
    NewsAPI reports zero results for the query. */
export async function fetchTopicNews(env: Env, topic: string): Promise<NewsItem[]> {
  if (!newsConfigured(env)) return []
  const q = topic.trim()
  if (!q) return []

  const url = new URL(ENDPOINT)
  url.searchParams.set('q', q)
  url.searchParams.set('language', 'en')
  url.searchParams.set('sortBy', 'publishedAt')
  url.searchParams.set('pageSize', '10')

  let res: Response
  try {
    res = await fetch(url.toString(), {
      headers: { accept: 'application/json', 'X-Api-Key': env.NEWSAPI_KEY as string },
    })
  } catch {
    throw new ApiError('News search failed — could not reach NewsAPI.', 502)
  }
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    // Surface NewsAPI's own error body (status code + code/message) so key,
    // plan, or query problems are diagnosable at a glance.
    throw new ApiError(
      `News search failed (NewsAPI ${res.status}). Check that NEWSAPI_KEY is valid and your plan allows this request. NewsAPI response: ${body
        .replace(/\s+/g, ' ')
        .slice(0, 900)}`.trim(),
      502,
    )
  }

  const data: any = await res.json().catch(() => null)
  // totalResults === 0 → nothing recent; caller returns "no recent news found".
  if (!data || Number(data.totalResults) === 0) return []
  const articles: any[] = Array.isArray(data.articles) ? data.articles : []

  const seen = new Set<string>()
  const out: NewsItem[] = []
  for (const a of articles) {
    const link = String(a?.url || '').trim()
    const title = String(a?.title || '').trim()
    if (!link || !title || seen.has(link)) continue
    seen.add(link)
    out.push({
      title,
      snippet: cleanSnippet(a?.description),
      source: String(a?.source?.name || '').trim(),
      link,
      date: fmtDate(a?.publishedAt),
    })
  }
  return out.slice(0, 6)
}
