/* ============================================================
   Firecrawl client — SERVER ONLY.

   The `.server` in the filename is load-bearing: this module reads
   the Firecrawl API key and must never be imported from anything
   under src/components, src/spaces or src/store. It is imported by
   exactly two entry points — the Vite dev middleware (local) and the
   Cloudflare Pages Function (deployed) — so the key stays out of the
   browser bundle in both.

   Runtime-agnostic: uses `fetch` and nothing else, so the same code
   runs on Node and on the Workers runtime.
   ============================================================ */

import {
  classifyLinkedInUrl,
  extractPostUrls,
  parsePost,
  type LinkedInTarget,
  type RawScrape,
  type ScrapedPost,
} from './linkedin'
export type { ScrapedPost }

const FIRECRAWL_ENDPOINT = 'https://api.firecrawl.dev/v2/scrape'
const FIRECRAWL_SEARCH_ENDPOINT = 'https://api.firecrawl.dev/v2/search'

/** Posts pulled from one profile/company page, unless the caller says otherwise. */
export const DEFAULT_POST_LIMIT = 5
const MAX_POST_LIMIT = 15
/** Firecrawl bills per scrape, so a profile fan-out stays deliberately small. */
const FANOUT_CONCURRENCY = 3

export class ScrapeError extends Error {
  readonly status: number
  constructor(message: string, status = 502) {
    super(message)
    this.name = 'ScrapeError'
    this.status = status
  }
}

export interface ScrapeOutcome {
  target: LinkedInTarget
  posts: ScrapedPost[]
  /** Things the caller should surface but that did not fail the request. */
  warnings: string[]
}

interface FirecrawlResponse {
  success?: boolean
  data?: RawScrape
  error?: string
  details?: unknown
}

/** One Firecrawl scrape. Throws ScrapeError with a message worth showing. */
async function firecrawlScrape(
  apiKey: string,
  url: string,
  opts: { withLinks?: boolean } = {},
): Promise<RawScrape> {
  let res: Response
  try {
    res = await fetch(FIRECRAWL_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        url,
        // rawHtml carries the schema.org JSON-LD block, which is where the
        // complete post text, author, date, image and engagement live for a
        // logged-out request. markdown is kept as the fallback for pages
        // that render but carry no structured data.
        formats: opts.withLinks ? ['markdown', 'rawHtml', 'links'] : ['markdown', 'rawHtml'],
        // Applies to the markdown only — rawHtml is returned unmodified, so
        // the JSON-LD survives either way. Keeping it on leaves the fallback
        // markdown clean.
        onlyMainContent: true,
        // LinkedIn renders the post body client-side; without a beat the
        // markdown comes back as an empty shell.
        waitFor: 2500,
        timeout: 45_000,
        proxy: 'auto',
      }),
    })
  } catch (err) {
    throw new ScrapeError(
      `Could not reach Firecrawl: ${err instanceof Error ? err.message : 'network error'}`,
      502,
    )
  }

  let body: FirecrawlResponse
  try {
    body = (await res.json()) as FirecrawlResponse
  } catch {
    throw new ScrapeError(`Firecrawl returned a non-JSON response (HTTP ${res.status})`, 502)
  }

  if (!res.ok || body.success === false) {
    const detail = body.error ?? `HTTP ${res.status}`
    // 401/402 are the caller's problem to fix and are worth saying plainly;
    // everything else is a scrape failure.
    if (res.status === 401 || res.status === 403) {
      throw new ScrapeError('Firecrawl rejected the API key.', 401)
    }
    if (res.status === 402) {
      throw new ScrapeError('Firecrawl credits exhausted.', 402)
    }
    if (res.status === 429) {
      throw new ScrapeError('Firecrawl rate limit hit — try again shortly.', 429)
    }
    throw new ScrapeError(`Firecrawl could not scrape that page: ${detail}`, 502)
  }

  return body.data ?? {}
}

/**
 * Find post permalinks for a profile or company by searching the open web,
 * rather than by reading a LinkedIn feed page.
 *
 * This exists because of a measured asymmetry: LinkedIn answers a logged-out
 * request for a POST permalink with the full post (status 200, complete
 * schema.org data), but answers the same request for a PROFILE with HTTP 999
 * and for a COMPANY feed with its login page. Those permalinks are public and
 * indexed — so we look them up, then scrape the pages that do work.
 *
 * Returns [] rather than throwing: search is a fallback, and a fallback that
 * can sink the request is worse than one that quietly finds nothing.
 */
async function findPostUrlsViaSearch(
  apiKey: string,
  target: LinkedInTarget,
  limit: number,
): Promise<string[]> {
  const slug = target.slug
  if (!slug) return []

  const readable = slug.replace(/-/g, ' ')
  const query = `site:linkedin.com/posts/ ${readable}`

  let res: Response
  try {
    res = await fetch(FIRECRAWL_SEARCH_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      // No scrapeOptions: we only want the URLs here. Scraping each one is a
      // separate, deliberate step so the credit cost stays visible.
      body: JSON.stringify({ query, limit: Math.min(limit * 3, 30), sources: ['web'] }),
    })
  } catch {
    return []
  }
  if (!res.ok) return []

  let body: { data?: { web?: { url?: string }[] } }
  try {
    body = (await res.json()) as { data?: { web?: { url?: string }[] } }
  } catch {
    return []
  }

  const seen = new Set<string>()
  const out: string[] = []
  for (const hit of body.data?.web ?? []) {
    if (typeof hit.url !== 'string') continue
    const found = classifyLinkedInUrl(hit.url)
    if (!found || found.kind !== 'post') continue
    // A search for "jane doe" also returns posts that merely mention her.
    // The author's own slug is embedded in their permalinks, so require it.
    if (!found.url.toLowerCase().includes(`/posts/${slug}`)) continue
    if (seen.has(found.key)) continue
    seen.add(found.key)
    out.push(found.url)
    if (out.length >= limit) break
  }
  return out
}

/** Run tasks with a small concurrency cap, preserving input order. */
async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length)
  let cursor = 0
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const i = cursor++
      results[i] = await fn(items[i])
    }
  })
  await Promise.all(workers)
  return results
}

/**
 * Scrape a LinkedIn post permalink, or the recent posts of a profile or
 * company page.
 *
 * LinkedIn blocks unauthenticated scrapers aggressively, so a run that
 * reaches Firecrawl successfully and still comes back with nothing is a
 * normal outcome, not an exception — it returns zero posts and a warning
 * saying why, and the UI reports that honestly.
 */
export async function scrapeLinkedIn(
  apiKey: string,
  rawUrl: string,
  limit = DEFAULT_POST_LIMIT,
): Promise<ScrapeOutcome> {
  const target = classifyLinkedInUrl(rawUrl)
  if (!target) {
    throw new ScrapeError(
      'That is not a LinkedIn post, profile or company URL.',
      400,
    )
  }

  const capped = Math.max(1, Math.min(limit, MAX_POST_LIMIT))
  const warnings: string[] = []

  if (target.kind === 'post') {
    const raw = await firecrawlScrape(apiKey, target.url)
    const post = parsePost(target.url, raw)
    if (!post) {
      warnings.push(
        'LinkedIn served a sign-in wall instead of the post — nothing could be read from it.',
      )
      return { target, posts: [], warnings }
    }
    return { target, posts: [post], warnings }
  }

  // Profile / company. Two routes to the same place, because LinkedIn walls
  // feed pages but not the permalinks themselves.
  //
  //   1. Read the feed page directly. Cheapest when it works, and it may —
  //      Firecrawl's proxies are not the datacenter IP this was measured from.
  //   2. If that comes back empty, look the permalinks up on the open web.
  //
  // Either way the posts themselves are then scraped individually, which is
  // the route that reliably returns full content.
  let urls: string[] = []
  let viaSearch = false

  try {
    urls = extractPostUrls(await firecrawlScrape(apiKey, target.url, { withLinks: true }), capped)
  } catch (err) {
    // A blocked feed page is expected, not fatal — fall through to search.
    // A key or credit problem is neither, and must still surface.
    if (err instanceof ScrapeError && (err.status === 401 || err.status === 402)) throw err
  }

  if (urls.length === 0) {
    urls = await findPostUrlsViaSearch(apiKey, target, capped)
    viaSearch = urls.length > 0
  }

  if (urls.length === 0) {
    warnings.push(
      `LinkedIn served a sign-in wall for that ${target.kind} page, and no public posts for it turned up in search either. Individual post URLs are far more reliable — paste one of those.`,
    )
    return { target, posts: [], warnings }
  }

  if (viaSearch) {
    warnings.push(
      `LinkedIn blocked the ${target.kind} page directly, so these were found via web search — recent posts may be missing.`,
    )
  }

  const settled = await mapLimit(urls, FANOUT_CONCURRENCY, async (url) => {
    try {
      return parsePost(url, await firecrawlScrape(apiKey, url))
    } catch {
      // One blocked post should not sink the rest of the batch.
      return null
    }
  })

  const posts = settled.filter((p): p is ScrapedPost => p !== null)
  const missed = urls.length - posts.length
  if (missed > 0) {
    warnings.push(`${missed} of ${urls.length} posts came back blocked or empty.`)
  }
  return { target, posts, warnings }
}

/**
 * Shared request handler for both entry points. Takes and returns plain
 * JSON-able values so the Node middleware and the Workers function agree
 * on the contract without either importing the other's types.
 */
export async function handleScrapeRequest(
  apiKey: string | undefined,
  payload: unknown,
): Promise<{ status: number; body: Record<string, unknown> }> {
  if (!apiKey) {
    return {
      status: 500,
      body: {
        error:
          'FIRECRAWL_API_KEY is not set on the server. Add it to .env for local dev, or to the Pages project environment variables.',
      },
    }
  }

  const input = (payload ?? {}) as { url?: unknown; limit?: unknown }
  if (typeof input.url !== 'string' || !input.url.trim()) {
    return { status: 400, body: { error: 'Send a JSON body with a "url" string.' } }
  }
  const limit = typeof input.limit === 'number' ? input.limit : DEFAULT_POST_LIMIT

  try {
    const outcome = await scrapeLinkedIn(apiKey, input.url, limit)
    return {
      status: 200,
      body: {
        kind: outcome.target.kind,
        label: outcome.target.label,
        posts: outcome.posts,
        warnings: outcome.warnings,
      },
    }
  } catch (err) {
    if (err instanceof ScrapeError) {
      return { status: err.status, body: { error: err.message } }
    }
    return {
      status: 500,
      body: { error: err instanceof Error ? err.message : 'Unexpected scrape failure.' },
    }
  }
}
