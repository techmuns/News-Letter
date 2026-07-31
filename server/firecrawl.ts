/* ============================================================
   Firecrawl-backed harvesting — runs on the edge, never in the browser.

   Two jobs:
     1. discover — read a finance voice's listing page and pull out their
        latest real posts (title, url, date, excerpt) in one Firecrawl call
     2. read     — deep-read one of those posts as markdown, on demand

   The API key lives in the runtime env (Cloudflare secret in production,
   .env in dev) and never reaches the client.
   ============================================================ */

import {
  type HarvestRequest,
  type HarvestResponse,
  type HarvestSourceResult,
  type HarvestStatus,
  type HarvestedPost,
  type ReadResponse,
  postId,
} from '../shared/harvest'
import {
  DEFAULT_VOICE_IDS,
  FINANCE_VOICES,
  type FinanceVoice,
  voiceById,
} from '../shared/voices'

export interface Env {
  FIRECRAWL_API_KEY?: string
  /** override for self-hosted Firecrawl; defaults to the cloud API */
  FIRECRAWL_API_URL?: string
}

const DEFAULT_API_URL = 'https://api.firecrawl.dev/v2'
/** Serve a cached crawl if Firecrawl already has one this fresh (6h). */
const CACHE_MAX_AGE_MS = 6 * 60 * 60 * 1000
const SCRAPE_TIMEOUT_MS = 45_000
/** Firecrawl rate-limits per plan — keep the fan-out modest. */
const MAX_CONCURRENT_SOURCES = 3
const DEFAULT_PER_VOICE = 3
const MAX_PER_VOICE = 6

const LISTING_SCHEMA = {
  type: 'object',
  properties: {
    posts: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          url: { type: 'string' },
          excerpt: { type: 'string' },
          publishedAt: { type: 'string' },
        },
        required: ['title', 'url'],
      },
    },
  },
  required: ['posts'],
} as const

const LISTING_PROMPT = [
  'This is the index page of a finance writer\'s blog or newsletter.',
  'Extract the individual articles listed on it, newest first.',
  'For each: its exact headline (title), the absolute link to the article itself (url),',
  'the summary/teaser text shown for it if any (excerpt), and its publication date',
  'as YYYY-MM-DD if shown (publishedAt).',
  'Ignore navigation, categories, tags, author bios, adverts and subscribe prompts.',
].join(' ')

interface ListingPost {
  title?: string
  url?: string
  excerpt?: string
  publishedAt?: string
}

/* ---------------------------------------------------------------- */
/* Firecrawl transport                                              */
/* ---------------------------------------------------------------- */

class FirecrawlError extends Error {
  readonly status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = 'FirecrawlError'
    this.status = status
  }
}

async function scrape(
  env: Env,
  body: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const base = (env.FIRECRAWL_API_URL || DEFAULT_API_URL).replace(/\/+$/, '')
  const res = await fetch(`${base}/scrape`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.FIRECRAWL_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(SCRAPE_TIMEOUT_MS),
  })

  const text = await res.text()
  let parsed: Record<string, unknown> = {}
  try {
    parsed = text ? (JSON.parse(text) as Record<string, unknown>) : {}
  } catch {
    throw new FirecrawlError(`Firecrawl returned non-JSON (HTTP ${res.status})`, res.status)
  }

  if (!res.ok || parsed.success === false) {
    const detail =
      (typeof parsed.error === 'string' && parsed.error) ||
      (typeof parsed.message === 'string' && parsed.message) ||
      `HTTP ${res.status}`
    throw new FirecrawlError(detail, res.status)
  }

  return (parsed.data as Record<string, unknown>) ?? {}
}

/* ---------------------------------------------------------------- */
/* Normalisation                                                    */
/* ---------------------------------------------------------------- */

function absoluteUrl(href: string, base: string): string | null {
  try {
    return new URL(href, base).toString()
  } catch {
    return null
  }
}

/** Collapse markdown/HTML leftovers into a clean one-or-two-sentence excerpt. */
function cleanExcerpt(raw: string | undefined, limit = 260): string {
  if (!raw) return ''
  const flat = raw
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ') // images
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // links → their text
    .replace(/[#*_`>]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (flat.length <= limit) return flat
  const cut = flat.slice(0, limit)
  const lastStop = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('? '), cut.lastIndexOf('! '))
  return lastStop > limit * 0.5 ? cut.slice(0, lastStop + 1) : `${cut.trimEnd()}…`
}

function normaliseDate(raw: string | undefined): string | undefined {
  if (!raw) return undefined
  const trimmed = raw.trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed
  const parsed = Date.parse(trimmed)
  if (Number.isNaN(parsed)) return undefined
  return new Date(parsed).toISOString().slice(0, 10)
}

/**
 * Reject anything that reads like a sentence fragment rather than a headline.
 * Extraction occasionally grabs mid-paragraph anchor text; those make terrible
 * campaign names and worse LinkedIn hooks, so they never reach the pile.
 */
function looksLikeHeadline(title: string): boolean {
  if (title.length < 15 || title.length > 160) return false
  if (/^[a-z]/.test(title)) return false // mid-sentence fragment
  if (/^(and|but|so|that|which|because|who|whom|whose|where|when)\b/i.test(title)) return false
  if (/[,;:]\s*$/.test(title)) return false
  return /\s/.test(title) // a headline is more than one word
}

/** Turn one voice's extracted listing into real, deduped HarvestedPosts. */
function toPosts(voice: FinanceVoice, raw: ListingPost[], perVoice: number): HarvestedPost[] {
  const seen = new Set<string>()
  const posts: HarvestedPost[] = []

  for (const entry of raw) {
    if (!entry?.title || !entry?.url) continue
    const url = absoluteUrl(entry.url.trim(), voice.listingUrl)
    if (!url) continue
    // Keep only links that are actually this voice's posts, not nav or ads.
    if (!url.startsWith(voice.urlPrefix)) continue
    if (url.replace(/\/+$/, '') === voice.listingUrl.replace(/\/+$/, '')) continue
    if (seen.has(url)) continue
    seen.add(url)

    const title = cleanExcerpt(entry.title, 160)
    if (!looksLikeHeadline(title)) continue

    posts.push({
      id: postId(url),
      voiceId: voice.id,
      author: voice.name,
      authorRole: voice.role,
      outlet: voice.outlet,
      title,
      url,
      excerpt: cleanExcerpt(entry.excerpt),
      publishedAt: normaliseDate(entry.publishedAt),
    })

    if (posts.length >= perVoice) break
  }

  return posts
}

/* ---------------------------------------------------------------- */
/* Discover                                                         */
/* ---------------------------------------------------------------- */

async function harvestVoice(
  env: Env,
  voice: FinanceVoice,
  perVoice: number,
): Promise<HarvestSourceResult> {
  const started = Date.now()
  try {
    const data = await scrape(env, {
      url: voice.listingUrl,
      formats: [{ type: 'json', schema: LISTING_SCHEMA, prompt: LISTING_PROMPT }],
      onlyMainContent: true,
      blockAds: true,
      maxAge: CACHE_MAX_AGE_MS,
      // Stealth costs more credits — only the sites that need it get it.
      proxy: voice.needsStealth ? 'stealth' : 'auto',
      timeout: SCRAPE_TIMEOUT_MS,
    })

    const extracted = (data.json as { posts?: ListingPost[] } | undefined)?.posts ?? []
    const posts = toPosts(voice, extracted, perVoice)

    return {
      voiceId: voice.id,
      ok: true,
      posts,
      ms: Date.now() - started,
      error: posts.length === 0 ? 'No posts found on the listing page' : undefined,
    }
  } catch (err) {
    return {
      voiceId: voice.id,
      ok: false,
      posts: [],
      ms: Date.now() - started,
      error: err instanceof Error ? err.message : 'Unknown error',
    }
  }
}

/** Run tasks with a small concurrency cap so we stay inside rate limits. */
async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length)
  let cursor = 0
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++
      results[index] = await fn(items[index])
    }
  })
  await Promise.all(workers)
  return results
}

export async function handleHarvest(env: Env, req: HarvestRequest): Promise<HarvestResponse> {
  const harvestedAt = new Date().toISOString()

  const requested = req.voiceIds?.length ? req.voiceIds : DEFAULT_VOICE_IDS
  const voices = requested
    .map((id) => voiceById(id))
    .filter((v): v is FinanceVoice => Boolean(v))

  if (!env.FIRECRAWL_API_KEY) {
    return {
      live: false,
      posts: [],
      sources: voices.map((v) => ({
        voiceId: v.id,
        ok: false,
        posts: [],
        error: 'Firecrawl not connected',
      })),
      notice:
        'FIRECRAWL_API_KEY is not set on the server, so nothing was scraped. Add the key to harvest real posts.',
      harvestedAt,
    }
  }

  if (voices.length === 0) {
    return {
      live: true,
      posts: [],
      sources: [],
      notice: 'No known voices were selected.',
      harvestedAt,
    }
  }

  const perVoice = Math.min(Math.max(req.perVoice ?? DEFAULT_PER_VOICE, 1), MAX_PER_VOICE)
  const sources = await mapLimit(voices, MAX_CONCURRENT_SOURCES, (v) =>
    harvestVoice(env, v, perVoice),
  )

  // Interleave across voices so the feed reads as a mix, not one author's archive.
  const posts: HarvestedPost[] = []
  for (let round = 0; round < perVoice; round++) {
    for (const source of sources) {
      const post = source.posts[round]
      if (post) posts.push(post)
    }
  }

  const failed = sources.filter((s) => !s.ok)
  return {
    live: true,
    posts,
    sources,
    notice:
      posts.length === 0
        ? failed.length
          ? `Every source failed — first error: ${failed[0].error}`
          : 'Sources responded but no posts were found.'
        : undefined,
    harvestedAt,
  }
}

/* ---------------------------------------------------------------- */
/* Deep read                                                        */
/* ---------------------------------------------------------------- */

/** Only read URLs that belong to a voice on the roster. */
export function isRosterUrl(url: string): boolean {
  return FINANCE_VOICES.some((v) => url.startsWith(v.urlPrefix))
}

export async function handleRead(env: Env, url: string): Promise<ReadResponse> {
  if (!env.FIRECRAWL_API_KEY) {
    return {
      live: false,
      url,
      markdown: '',
      notice: 'FIRECRAWL_API_KEY is not set on the server, so the post could not be read.',
    }
  }

  const voice = FINANCE_VOICES.find((v) => url.startsWith(v.urlPrefix))
  const data = await scrape(env, {
    url,
    formats: ['markdown'],
    onlyMainContent: true,
    blockAds: true,
    maxAge: CACHE_MAX_AGE_MS,
    proxy: voice?.needsStealth ? 'stealth' : 'auto',
    timeout: SCRAPE_TIMEOUT_MS,
  })

  const metadata = (data.metadata as Record<string, unknown> | undefined) ?? {}
  const titleRaw = metadata.title
  const publishedRaw =
    metadata.publishedTime ?? metadata.publishedDate ?? metadata['article:published_time']

  return {
    live: true,
    url,
    title: typeof titleRaw === 'string' ? titleRaw : Array.isArray(titleRaw) ? titleRaw[0] : undefined,
    markdown: typeof data.markdown === 'string' ? data.markdown : '',
    publishedAt: normaliseDate(typeof publishedRaw === 'string' ? publishedRaw : undefined),
  }
}

export function handleStatus(env: Env): HarvestStatus {
  return {
    configured: Boolean(env.FIRECRAWL_API_KEY),
    voices: FINANCE_VOICES.length,
  }
}
