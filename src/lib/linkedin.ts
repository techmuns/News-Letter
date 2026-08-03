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
  /** the profile/company slug — used to search for their post permalinks
      when LinkedIn walls off the feed page itself */
  slug?: string
}

/** A post as it comes back from a scrape, before it becomes a pile item. */
export interface ScrapedPost {
  url: string
  author: string
  /** the author's profile URL, when the page exposed it */
  authorUrl?: string
  /** the author's LinkedIn tagline, when the page exposed it */
  authorHeadline?: string
  text: string
  postedAt?: string
  reactions?: number
  comments?: number
  reposts?: number
  /** the post's own image — carried through as the campaign hero */
  imageUrl?: string
  /** true when this came from LinkedIn's structured data rather than
      being scraped out of rendered markdown */
  structured?: boolean
}

/** Firecrawl's `data` object, narrowed to the parts we read. */
export interface RawScrape {
  markdown?: string
  rawHtml?: string
  html?: string
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
      slug: slug.toLowerCase(),
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
      slug: slug.toLowerCase(),
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

// A page whose own title says it is the login screen is decisive, whatever
// its length. Company feed pages come back as half a megabyte of login page,
// which sails past a "walls are short" heuristic — measured, not guessed.
const AUTHWALL_TITLES = ['linkedin login, sign in', 'sign up | linkedin', 'join linkedin']

export function looksLikeAuthwall(markdown: string, title?: string): boolean {
  const heading = (title ?? '').toLowerCase()
  if (AUTHWALL_TITLES.some((t) => heading.includes(t))) return true

  const body = markdown.trim()
  const hay = `${heading}\n${body}`.toLowerCase()
  const hit = AUTHWALL_MARKERS.some((m) => hay.includes(m))
  // Sign-in copy also appears in the footer of pages that DID render, so
  // away from the title the marker alone is not enough — a wall is short
  // and is nothing but that copy.
  return hit && body.length < 1200
}

/* ---- LinkedIn's structured data (the reliable path) -------------------- */

// A logged-out request for a post permalink still returns a full
// schema.org SocialMediaPosting block: the complete post text, the author,
// the date, the image and the engagement counts. That is dramatically
// better than reading it back out of rendered markdown, so it is tried
// first and the markdown path is the fallback.

const LD_SCRIPT_RE = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi

function asRecord(v: unknown): Record<string, unknown> | undefined {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : undefined
}

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v.trim() ? v.trim() : undefined
}

/** schema.org nests the thing you want one level down, inconsistently. */
function urlOf(v: unknown): string | undefined {
  const direct = str(v)
  if (direct) return direct
  const rec = asRecord(v)
  if (rec) return str(rec.url)
  if (Array.isArray(v)) {
    for (const entry of v) {
      const found = urlOf(entry)
      if (found) return found
    }
  }
  return undefined
}

/** Flatten @graph wrappers and arrays into a flat list of nodes. */
function ldNodes(parsed: unknown): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = []
  const visit = (node: unknown) => {
    if (Array.isArray(node)) {
      node.forEach(visit)
      return
    }
    const rec = asRecord(node)
    if (!rec) return
    out.push(rec)
    if ('@graph' in rec) visit(rec['@graph'])
  }
  visit(parsed)
  return out
}

/** interactionStatistic → the count for one schema.org action type. */
function interactionCount(node: Record<string, unknown>, action: string): number | undefined {
  const raw = node.interactionStatistic
  const entries = Array.isArray(raw) ? raw : [raw]
  for (const entry of entries) {
    const rec = asRecord(entry)
    if (!rec) continue
    // LinkedIn emits http:// for some types and https:// for others.
    const type = str(rec.interactionType) ?? urlOf(rec.interactionType) ?? ''
    if (!type.toLowerCase().endsWith(action.toLowerCase())) continue
    const n = rec.userInteractionCount
    if (typeof n === 'number' && Number.isFinite(n)) return n
    const parsed = typeof n === 'string' ? Number(n.replace(/,/g, '')) : NaN
    if (Number.isFinite(parsed)) return parsed
  }
  return undefined
}

/**
 * Read a post out of the page's JSON-LD. Returns null when the page carried
 * no SocialMediaPosting node — which is what a profile block page or a login
 * page looks like.
 */
export function parseJsonLd(html: string, fallbackUrl: string): ScrapedPost | null {
  LD_SCRIPT_RE.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = LD_SCRIPT_RE.exec(html)) !== null) {
    let parsed: unknown
    try {
      parsed = JSON.parse(match[1].trim())
    } catch {
      continue
    }

    for (const node of ldNodes(parsed)) {
      const type = str(node['@type'])
      if (type !== 'SocialMediaPosting' && type !== 'DiscussionForumPosting') continue

      const text = str(node.articleBody) ?? str(node.headline)
      if (!text) continue

      const author = asRecord(node.author)
      const commentCount = node.commentCount
      return {
        url: str(node['@id']) ?? fallbackUrl,
        author: (author && str(author.name)) ?? 'Unknown author',
        authorUrl: author ? urlOf(author.url) : undefined,
        text,
        postedAt: str(node.datePublished),
        reactions: interactionCount(node, 'LikeAction'),
        comments:
          typeof commentCount === 'number'
            ? commentCount
            : interactionCount(node, 'CommentAction'),
        reposts: interactionCount(node, 'ShareAction'),
        imageUrl: urlOf(node.image),
        structured: true,
      }
    }
  }
  return null
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

// Two shapes in the wild, both seen on live pages:
//   "How to scrape … | Dr. Kallal Banerjee posted on the topic | LinkedIn"
//   "Jane Doe on LinkedIn: some post text | 42 comments"
// The first puts the AUTHOR second, so matching only the second shape
// silently files the post's own headline as the author's name.
const TITLE_POSTED_BY_RE = /^(.*?)\s*\|\s*(.+?)\s+posted on\b/i
const TITLE_AUTHOR_RE = /^(.*?)\s+on\s+LinkedIn:\s*([\s\S]*)$/i

/**
 * Turn one scraped LinkedIn page into a post. Returns null when the page
 * carried no usable text — an authwall, a deleted post, or a redirect to
 * the feed. Callers treat null as "this one didn't come through", not as
 * an error worth aborting the batch for.
 */
export function parsePost(url: string, raw: RawScrape): ScrapedPost | null {
  // LinkedIn's own structured data, when the page carried it, beats anything
  // we can reconstruct from rendered text.
  const html = raw.rawHtml ?? raw.html
  if (html) {
    const structured = parseJsonLd(html, url)
    if (structured) return structured
  }

  const markdown = raw.markdown ?? ''
  const title = meta(raw.metadata, 'ogTitle', 'title')
  if (looksLikeAuthwall(markdown, title)) return null

  const description = meta(raw.metadata, 'ogDescription', 'description')

  let author = meta(raw.metadata, 'author', 'article:author') ?? ''
  let titleText = ''
  if (title) {
    const posted = TITLE_POSTED_BY_RE.exec(title)
    const onLinkedIn = TITLE_AUTHOR_RE.exec(title)
    if (posted) {
      titleText = posted[1].trim()
      if (!author) author = posted[2].trim()
    } else if (onLinkedIn) {
      if (!author) author = onLinkedIn[1].trim()
      // The title tail repeats the post opening, plus a "| 42 comments" suffix.
      titleText = onLinkedIn[2].replace(/\s*\|\s*\d[\d.,KkMm]*\s+comments?\s*$/i, '').trim()
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
