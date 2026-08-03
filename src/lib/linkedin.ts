/* ============================================================
   LinkedIn URL + content helpers.

   Pure functions only — no network, no DOM, no secrets. This module
   is shared by the browser (to validate what someone pasted before
   spending a Firecrawl credit on it) and by the server-side scrape
   endpoint (to turn Firecrawl's markdown back into a structured
   post), so the two can never disagree about what counts as a valid
   LinkedIn URL.
   ============================================================ */

export type LinkedInUrlKind = 'post' | 'profile' | 'company'

export interface LinkedInTarget {
  kind: LinkedInUrlKind
  /** the URL actually handed to Firecrawl (tracking params stripped) */
  url: string
  /** stable id used to de-dupe repeat scrapes of the same thing */
  key: string
  /** short label shown while the scrape is in flight */
  label: string
}

/** A post as it comes back from a scrape, before it becomes a pile item. */
export interface ScrapedPost {
  url: string
  author: string
  /** the author's LinkedIn tagline, when the page exposed it */
  authorHeadline?: string
  text: string
  postedAt?: string
  reactions?: number
  comments?: number
  reposts?: number
}

/** Firecrawl's `data` object, narrowed to the parts we read. */
export interface RawScrape {
  markdown?: string
  links?: string[]
  metadata?: Record<string, unknown>
}

const ACTIVITY_RE = /activity[-:](\d{6,})/i

/**
 * Work out what a pasted LinkedIn URL points at, and normalise it.
 * Returns null for anything that is not a LinkedIn URL we can act on —
 * the caller shows that as a validation message rather than firing a
 * request that was never going to work.
 */
export function classifyLinkedInUrl(raw: string): LinkedInTarget | null {
  const trimmed = raw.trim()
  if (!trimmed) return null

  let u: URL
  try {
    u = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`)
  } catch {
    return null
  }
  if (!/(^|\.)linkedin\.com$/i.test(u.hostname)) return null

  // Share links carry utm_* and trackingId noise that changes per copy —
  // dropping it keeps the de-dupe key stable across two people pasting
  // what is really the same post.
  const path = u.pathname.replace(/\/+$/, '')
  const clean = `https://www.linkedin.com${path}`

  const isPostPath = /^\/(posts|pulse)\//i.test(path)
  const isFeedUpdate = /^\/feed\/update\//i.test(path)
  if (isPostPath || isFeedUpdate) {
    const activity = ACTIVITY_RE.exec(path)
    return {
      kind: 'post',
      url: clean,
      key: activity ? `activity:${activity[1]}` : `url:${clean.toLowerCase()}`,
      label: 'LinkedIn post',
    }
  }

  const profile = /^\/in\/([^/]+)/i.exec(path)
  if (profile) {
    const slug = profile[1]
    return {
      kind: 'profile',
      // The profile root is mostly an identity card; recent-activity is
      // where the posts actually are.
      url: `https://www.linkedin.com/in/${slug}/recent-activity/all/`,
      key: `in:${slug.toLowerCase()}`,
      label: safeDecode(slug),
    }
  }

  const org = /^\/(company|school|showcase)\/([^/]+)/i.exec(path)
  if (org) {
    const slug = org[2]
    return {
      kind: 'company',
      url: `https://www.linkedin.com/company/${slug}/posts/`,
      key: `company:${slug.toLowerCase()}`,
      label: safeDecode(slug),
    }
  }

  return null
}

function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s)
  } catch {
    return s
  }
}

/* ---- Authwall detection ------------------------------------------------ */

// LinkedIn answers an unauthenticated scraper with a 200 and a sign-in page,
// not an error. Detecting that is the difference between "no posts found"
// and quietly filing a login screen into the pile as source material.
const AUTHWALL_MARKERS = [
  'sign in to view',
  'sign up to view',
  'join linkedin',
  'agree & join linkedin',
  'new to linkedin?',
  'authwall',
  'log in to continue',
  'sign in to see',
]

export function looksLikeAuthwall(markdown: string, title?: string): boolean {
  const body = markdown.trim()
  const hay = `${title ?? ''}\n${body}`.toLowerCase()
  const hit = AUTHWALL_MARKERS.some((m) => hay.includes(m))
  // Sign-in copy also appears in the footer of pages that DID render, so
  // the marker alone is not enough — a wall is short and is nothing but
  // that copy.
  return hit && body.length < 1200
}

/* ---- Reading Firecrawl output ------------------------------------------ */

function meta(metadata: Record<string, unknown> | undefined, ...keys: string[]): string | undefined {
  if (!metadata) return undefined
  for (const k of keys) {
    const v = metadata[k]
    if (typeof v === 'string' && v.trim()) return v.trim()
    if (Array.isArray(v)) {
      const first = v.find((x) => typeof x === 'string' && x.trim())
      if (typeof first === 'string') return first.trim()
    }
  }
  return undefined
}

// Nav/footer lines LinkedIn ships on every page. They are not post content
// and they wreck the preview snippet if they survive into the pile.
const CHROME_LINE =
  /^(skip to main content|sign in|join now|linkedin|agree & join|new to linkedin|by clicking continue|report this post|like|comment|share|see more|show more|\d+ (followers?|connections?))\b/i

/** Strip markdown syntax and LinkedIn chrome down to readable post text. */
export function cleanBody(markdown: string): string {
  const withoutImages = markdown.replace(/!\[[^\]]*\]\([^)]*\)/g, '')
  const withoutLinks = withoutImages.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')

  const lines = withoutLinks
    .split('\n')
    .map((l) => l.replace(/^\s*[#>*-]+\s*/, '').trim())
    .filter((l) => l.length > 0 && !CHROME_LINE.test(l))

  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim()
}

/** "1,234" / "1.2K" / "3M" → a number. */
export function parseCount(raw: string): number | undefined {
  const m = /^([\d.,]+)\s*([kmKM])?$/.exec(raw.trim())
  if (!m) return undefined
  const n = Number(m[1].replace(/,/g, ''))
  if (!Number.isFinite(n)) return undefined
  const mult = m[2]?.toLowerCase() === 'k' ? 1_000 : m[2]?.toLowerCase() === 'm' ? 1_000_000 : 1
  return Math.round(n * mult)
}

function findCount(markdown: string, pattern: RegExp): number | undefined {
  const m = pattern.exec(markdown)
  return m ? parseCount(m[1]) : undefined
}

const TITLE_AUTHOR_RE = /^(.*?)\s+on\s+LinkedIn:\s*([\s\S]*)$/i

/**
 * Turn one scraped LinkedIn page into a post. Returns null when the page
 * carried no usable text — an authwall, a deleted post, or a redirect to
 * the feed. Callers treat null as "this one didn't come through", not as
 * an error worth aborting the batch for.
 */
export function parsePost(url: string, raw: RawScrape): ScrapedPost | null {
  const markdown = raw.markdown ?? ''
  const title = meta(raw.metadata, 'ogTitle', 'title')
  if (looksLikeAuthwall(markdown, title)) return null

  const description = meta(raw.metadata, 'ogDescription', 'description')

  let author = meta(raw.metadata, 'author', 'article:author') ?? ''
  let titleText = ''
  if (title) {
    const m = TITLE_AUTHOR_RE.exec(title)
    if (m) {
      if (!author) author = m[1].trim()
      // The title tail repeats the post opening, plus a "| 42 comments" suffix.
      titleText = m[2].replace(/\s*\|\s*\d[\d.,KkMm]*\s+comments?\s*$/i, '').trim()
    } else if (!author) {
      author = title.split(/\s+[|·—-]\s+/)[0].trim()
    }
  }

  // Prefer whichever source carried the most of the post. og:description is
  // reliable but truncated; the markdown is fuller but noisier.
  const fromMarkdown = cleanBody(markdown)
  const fromDescription = description ? cleanBody(description) : ''
  const candidates = [fromMarkdown, fromDescription, titleText].filter((t) => t.length > 0)
  if (candidates.length === 0) return null
  const text = candidates.reduce((best, c) => (c.length > best.length ? c : best))
  if (text.length < 20) return null

  return {
    url,
    author: author || 'Unknown author',
    authorHeadline: meta(raw.metadata, 'ogSiteName') === 'LinkedIn' ? undefined : meta(raw.metadata, 'ogSiteName'),
    text,
    postedAt: meta(raw.metadata, 'article:published_time', 'publishedTime', 'datePublished'),
    reactions: findCount(markdown, /([\d.,]+[KkMm]?)\s+(?:reactions?|likes?)\b/i),
    comments: findCount(markdown, /([\d.,]+[KkMm]?)\s+comments?\b/i),
    reposts: findCount(markdown, /([\d.,]+[KkMm]?)\s+(?:reposts?|shares?)\b/i),
  }
}

/**
 * Pull post permalinks out of a scraped profile or company page, newest
 * first as they appear, de-duped by activity id and capped.
 */
export function extractPostUrls(raw: RawScrape, limit: number): string[] {
  const fromLinks = raw.links ?? []
  const fromMarkdown = (raw.markdown ?? '').match(/https?:\/\/[^\s)"']*activity[-:]\d{6,}[^\s)"']*/gi) ?? []

  const seen = new Set<string>()
  const out: string[] = []
  for (const href of [...fromLinks, ...fromMarkdown]) {
    const target = classifyLinkedInUrl(href)
    if (!target || target.kind !== 'post') continue
    if (seen.has(target.key)) continue
    seen.add(target.key)
    out.push(target.url)
    if (out.length >= limit) break
  }
  return out
}

/** One-line summary for the pile card. */
export function postTitle(post: ScrapedPost): string {
  const firstLine = post.text.split('\n').find((l) => l.trim().length > 0) ?? post.text
  const trimmed = firstLine.trim()
  const head = trimmed.length > 64 ? `${trimmed.slice(0, 61)}…` : trimmed
  return `${post.author}: ${head}`
}
