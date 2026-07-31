/* ============================================================
   Contract between the browser and the Firecrawl-backed API.
   Shared by src/ (client) and functions/ + server/ (edge).
   ============================================================ */

/** A real post, by a real person, discovered on their own site. */
export interface HarvestedPost {
  /** stable id derived from the url — dedupes across harvests */
  id: string
  voiceId: string
  author: string
  authorRole: string
  outlet: string
  title: string
  url: string
  /** the post's own words — one or two sentences, as published */
  excerpt: string
  /** ISO date if the page exposed one */
  publishedAt?: string
  /** full markdown, present only after a deep read */
  markdown?: string
}

export interface HarvestRequest {
  /** voice ids to read; empty/omitted means the default set */
  voiceIds?: string[]
  /** max posts to take per voice */
  perVoice?: number
}

export interface HarvestSourceResult {
  voiceId: string
  ok: boolean
  posts: HarvestedPost[]
  /** why this voice returned nothing — surfaced in the UI, not swallowed */
  error?: string
  /** ms spent on this source */
  ms?: number
}

export interface HarvestResponse {
  /** true when posts came back from Firecrawl */
  live: boolean
  posts: HarvestedPost[]
  sources: HarvestSourceResult[]
  /** present when live is false — why nothing was harvested */
  notice?: string
  harvestedAt: string
}

export interface ReadRequest {
  url: string
}

export interface ReadResponse {
  live: boolean
  url: string
  title?: string
  markdown: string
  publishedAt?: string
  notice?: string
}

export interface HarvestStatus {
  /** a Firecrawl key is present on the server */
  configured: boolean
  /** how many voices the roster knows about */
  voices: number
}

/** Stable id for a post — the URL is the identity. */
export function postId(url: string): string {
  let hash = 5381
  for (let i = 0; i < url.length; i++) {
    hash = ((hash << 5) + hash + url.charCodeAt(i)) | 0
  }
  return `post-${(hash >>> 0).toString(36)}`
}
