import { type GenerationBrief, type MaterialGroup, type Tone, type WorkspaceItem } from '../types'
import { CONTENT_TYPE_OPTS, labelOf } from './brief'

/* ============================================================
   Step one of generating a post: a basic write-up composed from
   the materials the author actually added.

   This is deliberately NOT the finished post. It's a first pass
   the author reads, corrects and rewrites in their own words —
   whatever survives here is what the full generation runs on.
   ============================================================ */

/** How the write-up opens, per tone. Two variants, because "side by side"
    is a lie when the author only added one thing. */
const OPENER: Record<Tone, { one: string; many: string }> = {
  authoritative: {
    one: 'What this material actually shows:',
    many: 'What these materials actually show:',
  },
  analytical: {
    one: 'Reading this closely, one thing stands out:',
    many: 'Putting these side by side, a pattern shows up:',
  },
  provocative: {
    one: 'The obvious read of this is the wrong one.',
    many: 'The obvious read of these is the wrong one.',
  },
  conversational: {
    one: "Something worth sharing from what I've been reading:",
    many: "A few things I've been reading that point the same way:",
  },
  academic: {
    one: 'This points at one mechanism:',
    many: 'Together these point at one mechanism:',
  },
}

/** Strip a filename down to something readable as a title. */
function titleFromFileName(name: string): string {
  return name
    .replace(/\.[a-z0-9]{1,5}$/i, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

/** The host of a URL, for when a link is all we have to name the post after. */
function hostOf(url: string): string {
  const m = url.match(/^https?:\/\/(?:www\.)?([^/?#]+)/i)
  return m ? m[1] : url
}

/** First sentence of a block of prose, trimmed to a headline length. */
function firstSentence(text: string, max = 88): string {
  const clean = text.replace(/\s+/g, ' ').trim()
  const sentence = clean.match(/^.{16,140}?[.!?](?:\s|$)/)
  const picked = (sentence ? sentence[0] : clean).replace(/[.!?]\s*$/, '').trim()
  return picked.length > max ? `${picked.slice(0, max - 1).trimEnd()}…` : picked
}

/** The prose an author wrote into a note (falls back to its title). */
function noteText(item: WorkspaceItem): string {
  const body = (item.preview || '').trim()
  return body || item.title.trim()
}

/**
 * Names the post. A note the author wrote is the best signal, then a document
 * name, then the source they linked — so the headline always points at
 * something they recognise rather than at boilerplate.
 */
function composeHeadline(items: WorkspaceItem[], brief: GenerationBrief): string {
  // Anything the author typed beats anything derived — even a few words.
  const longest = items
    .filter((it) => it.type === 'note')
    .map(noteText)
    .filter(Boolean)
    .sort((a, b) => b.length - a.length)[0]
  if (longest) return firstSentence(longest)

  // A document name is usable; a screenshot filename ("Screenshot 2026-07-28
  // at 11.02") tells the reader nothing, so it's skipped.
  const doc = items.find((it) => it.type === 'pdf')
  if (doc) return titleFromFileName(doc.title)

  const link = items.find((it) => it.url)
  if (link?.url) return `What ${hostOf(link.url)} is reporting`

  const type = labelOf(CONTENT_TYPE_OPTS, brief.contentType).replace(/ \/.*$/, '')
  return `Untitled ${type.toLowerCase()}`
}

/** How many notes get quoted in full before the rest are just counted. */
const NOTES_SHOWN = 4

/**
 * Composes the write-up body: the author's own notes first (they're the
 * argument), then what it draws on, then who it's for. Files and links are
 * listed rather than invented around — nothing here claims to know what's
 * inside a document it hasn't read.
 */
function composeBody(items: WorkspaceItem[], brief: GenerationBrief): string {
  const opener = OPENER[brief.tone]
  const paras: string[] = [items.length > 1 ? opener.many : opener.one]

  const notes = items.filter((it) => it.type === 'note')
  notes.slice(0, NOTES_SHOWN).forEach((it) => paras.push(noteText(it)))
  if (notes.length > NOTES_SHOWN) {
    const rest = notes.length - NOTES_SHOWN
    paras.push(`(${rest} more note${rest > 1 ? 's' : ''} to work in.)`)
  }

  const docs = items.filter((it) => it.type === 'pdf' || it.type === 'screenshot')
  if (docs.length) {
    paras.push(`Working from: ${docs.map((d) => titleFromFileName(d.title)).join(', ')}.`)
  }

  const links = items.filter((it) => it.url)
  if (links.length) {
    paras.push(links.map((l) => `↳ ${l.url}`).join('\n'))
  }

  // No brief restatement here. The audience/type/tone are settings the author
  // already chose — writing them back as a line of the post is filler, and it
  // is the first thing they would delete.
  return paras.join('\n\n')
}

export interface ComposedOutline {
  headline: string
  body: string
}

/** The step-one write-up for a group of materials. */
export function composeOutline(
  group: Pick<MaterialGroup, 'items'>,
  brief: GenerationBrief,
): ComposedOutline {
  return {
    headline: composeHeadline(group.items, brief),
    body: composeBody(group.items, brief),
  }
}
