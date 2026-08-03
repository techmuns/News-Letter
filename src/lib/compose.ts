/* ============================================================
   Composing a campaign from real source material.

   "Turn into content" used to hand back a pre-written template no
   matter what was selected. When the selection carries real text —
   a scraped LinkedIn post, a typed note — the three channel drafts
   are built from THAT text instead.

   This is deterministic composition, not a writing model: it selects,
   restructures and attributes the source rather than inventing prose
   around it. That is a deliberate limit, and the reason the drafts
   land in "In Review" rather than "Ready" — a human still writes the
   final word. Swapping this module for an LLM call later changes
   nothing else in the app.
   ============================================================ */

import {
  type ArticleContent,
  type EmailContent,
  type LinkedInContent,
  type WorkspaceItem,
} from '../types'

export interface ComposedCampaign {
  name: string
  topic: string
  heroImage?: string
  linkedin: LinkedInContent
  email: EmailContent
  article: ArticleContent
}

/** Enough text to be worth composing from rather than templating. */
const MIN_SOURCE_CHARS = 120

interface Source {
  text: string
  author?: string
  url?: string
  imageUrl?: string
}

function collectSources(items: WorkspaceItem[]): Source[] {
  return items
    .map((i) => ({
      text: (i.body ?? i.preview ?? '').trim(),
      author: i.sourceAuthor,
      url: i.sourceUrl,
      imageUrl: i.imageUrl,
    }))
    .filter((s) => s.text.length > 0)
}

function paragraphsOf(text: string): string[] {
  return text
    .split(/\n\s*\n|\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0)
}

/** Split into sentences without tripping on decimals or "Rs." style stops. */
function sentencesOf(text: string): string[] {
  return text
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+(?=[A-Z“"'(])/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
}

function clip(text: string, max: number): string {
  const flat = text.replace(/\s+/g, ' ').trim()
  if (flat.length <= max) return flat
  // Prefer a word boundary so the clip does not cut mid-word.
  const cut = flat.slice(0, max)
  const lastSpace = cut.lastIndexOf(' ')
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).replace(/[,;:.\s]+$/, '')}…`
}

/** Drop a trailing full stop — headlines read better without one. */
function asHeadline(text: string, max = 88): string {
  return clip(text, max).replace(/\.$/, '')
}

function attribution(sources: Source[]): string | undefined {
  const authors = [...new Set(sources.map((s) => s.author).filter((a): a is string => !!a))]
  if (authors.length === 0) return undefined
  if (authors.length === 1) return authors[0]
  if (authors.length === 2) return `${authors[0]} and ${authors[1]}`
  return `${authors[0]} and ${authors.length - 1} others`
}

/**
 * Build a campaign from the selected pile items. Returns null when the
 * selection carries too little text to work with, so the caller can fall
 * back to a template rather than shipping an empty draft.
 */
export function composeFromSources(items: WorkspaceItem[]): ComposedCampaign | null {
  const sources = collectSources(items)
  const combined = sources.map((s) => s.text).join('\n\n')
  if (combined.length < MIN_SOURCE_CHARS) return null

  const paras = paragraphsOf(combined)
  if (paras.length === 0) return null

  const lead = paras[0]
  const middle = paras.slice(1, -1)
  const tail = paras.length > 1 ? paras[paras.length - 1] : ''

  const leadSentences = sentencesOf(lead)
  const hook = asHeadline(leadSentences[0] ?? lead)
  const credit = attribution(sources)
  const heroImage = sources.find((s) => s.imageUrl)?.imageUrl
  const primaryUrl = sources.find((s) => s.url)?.url

  const sourceLine = credit
    ? `Source: ${credit} on LinkedIn${sources.length > 1 ? ` · ${sources.length} posts` : ''}`
    : `Source: ${sources.length} item${sources.length > 1 ? 's' : ''} from the workspace`

  const topic = credit ? `LinkedIn · ${credit}` : 'Workspace source'

  /* ---- LinkedIn ---- */
  const linkedinBody = [
    lead,
    middle.length > 0 ? middle.join('\n\n') : '',
    tail && tail !== lead ? tail : '',
    sourceLine,
  ]
    .filter((p) => p.length > 0)
    .join('\n\n')

  const linkedin: LinkedInContent = {
    authorName: 'Munshot',
    authorHandle: 'Intelligence for institutional investors',
    authorAvatar: 'M',
    headline: hook,
    body: linkedinBody,
    reactions: 0,
    comments: 0,
    reposts: 0,
  }

  /* ---- Email ---- */
  const email: EmailContent = {
    subject: asHeadline(hook, 72),
    from: 'Munshot Intelligence <intel@munshot.io>',
    preheader: clip(leadSentences[1] ?? lead, 110),
    idea: lead,
    story:
      middle.length > 0
        ? middle.join('\n\n')
        : leadSentences.slice(1).join(' ') || lead,
    takeaway: tail && tail !== lead ? tail : (leadSentences[leadSentences.length - 1] ?? lead),
    ctaLabel: primaryUrl ? 'Read the original post' : 'Open the workspace',
  }

  /* ---- Article ---- */
  const sections = [
    { body: lead },
    ...middle.map((body, i) => ({
      // Only the first mid-section gets a heading; more would be invented
      // structure the source never had.
      heading: i === 0 ? 'What it says' : undefined,
      body,
    })),
    ...(tail && tail !== lead ? [{ heading: 'Why it matters', body: tail }] : []),
  ]

  const words = combined.split(/\s+/).length
  const article: ArticleContent = {
    title: asHeadline(hook, 76),
    deck: clip(leadSentences[1] ?? leadSentences[0] ?? lead, 130),
    hero: (credit ?? 'WORKSPACE').toUpperCase(),
    readMinutes: Math.max(1, Math.round(words / 200)),
    sections,
    ctaTitle: 'See this in Munshot',
    ctaBody: sourceLine,
    ctaLabel: 'Explore Munshot',
  }

  return {
    name: asHeadline(hook, 70),
    topic,
    heroImage,
    linkedin,
    email,
    article,
  }
}
