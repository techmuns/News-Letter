/* ============================================================
   Browser-side client for POST /api/scrape.

   The browser never talks to Firecrawl directly — it talks to our own
   endpoint, which holds the key. That endpoint is the Vite middleware
   in dev and the Cloudflare Pages Function in production; this module
   cannot tell the difference, which is the point.
   ============================================================ */

import { type LinkedInUrlKind, type ScrapedPost } from './linkedin'

export interface ScrapeResponse {
  kind: LinkedInUrlKind
  label: string
  posts: ScrapedPost[]
  /** Non-fatal notes — e.g. LinkedIn blocked 2 of 5 posts. */
  warnings: string[]
}

export async function scrapeLinkedInUrl(url: string, limit?: number): Promise<ScrapeResponse> {
  let res: Response
  try {
    res = await fetch('/api/scrape', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(limit === undefined ? { url } : { url, limit }),
    })
  } catch {
    throw new Error('Could not reach the scrape endpoint. Is the dev server running?')
  }

  let body: Partial<ScrapeResponse> & { error?: string }
  try {
    body = await res.json()
  } catch {
    // The SPA catch-all serving index.html for /api/scrape is the classic
    // symptom of the route not being wired up, and it arrives as HTML.
    throw new Error(
      res.ok
        ? 'The scrape endpoint returned HTML instead of JSON — /api/scrape is not wired up.'
        : `Scrape failed (HTTP ${res.status}).`,
    )
  }

  if (!res.ok) throw new Error(body.error ?? `Scrape failed (HTTP ${res.status}).`)

  return {
    kind: body.kind ?? 'post',
    label: body.label ?? '',
    posts: body.posts ?? [],
    warnings: body.warnings ?? [],
  }
}
