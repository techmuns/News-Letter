import { type GenerationBrief, type MaterialGroup, type WorkspaceItem } from '../types'
import { CONTENT_TYPE_OPTS, labelOf } from './brief'
import {
  type Pattern,
  type PatternId,
  PATTERNS,
  composeCta,
  pickDashboard,
  pickPattern,
} from './playbook'

/* ============================================================
   Step one of generating a post: a basic write-up composed from
   the materials the author actually added.

   The shape is not invented here — it comes from the playbook
   (finance_linkedin_creator_strategy_kb.md §5): a pattern
   skeleton is chosen for the brief, the author's own material is
   dropped into the steps it can fill, and the steps it can't are
   left as visible bracketed gaps.

   That bracketing is the point. The playbook's hardest rule is
   "never fabricate figures" — so where a number or a mechanism
   belongs and we don't have one, the write-up asks for it rather
   than writing something plausible. The author fills the gaps;
   whatever survives here is what the full generation runs on.
   ============================================================ */

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

/** Everything the author gave us as one searchable blob (used to route the CTA). */
function materialText(items: WorkspaceItem[]): string {
  return items
    .map((it) => [it.title, it.preview, it.url].filter(Boolean).join(' '))
    .join('\n')
}

/**
 * A noun phrase for what the post is about, used inside the pattern's hook —
 * or an empty string when the material doesn't name anything.
 *
 * Only a document or a link gives a real name. Truncating the author's note to
 * seven words does not: "whether mix is shifting to entry-level, not premium
 * holds up" is a sentence sawn in half. Every hook reads correctly with no
 * subject, so an empty string is the honest answer.
 */
function subjectOf(items: WorkspaceItem[]): string {
  const doc = items.find((it) => it.type === 'pdf')
  if (doc) return titleFromFileName(doc.title)
  const link = items.find((it) => it.url)
  if (link?.url) return `the ${hostOf(link.url)} filing`
  return ''
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
 * The author's material, as the paragraphs it can legitimately become.
 * Notes go in verbatim — they're the argument. Files and links are listed,
 * never summarised: nothing here claims to know what's inside a document it
 * hasn't read.
 */
function materialParas(items: WorkspaceItem[]): string[] {
  const paras: string[] = []

  const notes = items.filter((it) => it.type === 'note')
  notes.slice(0, NOTES_SHOWN).forEach((it) => paras.push(noteText(it)))
  if (notes.length > NOTES_SHOWN) {
    const rest = notes.length - NOTES_SHOWN
    paras.push(`(${rest} more note${rest > 1 ? 's' : ''} to work in.)`)
  }

  const docs = items.filter((it) => it.type === 'pdf' || it.type === 'screenshot')
  if (docs.length) {
    paras.push(`Source: ${docs.map((d) => titleFromFileName(d.title)).join(', ')}.`)
  }

  const links = items.filter((it) => it.url)
  if (links.length) {
    paras.push(links.map((l) => `↳ ${l.url}`).join('\n'))
  }

  return paras
}

/**
 * Composes the write-up along the pattern's skeleton (§5), following the
 * playbook's value flow (§3): insight → evidence → investor implication →
 * dashboard connection → CTA.
 *
 * Steps the material can fill get the material. Steps it can't get a
 * bracketed prompt, so the author can see exactly what the playbook expects
 * of this shape and what is still missing.
 */
function composeBody(
  items: WorkspaceItem[],
  brief: GenerationBrief,
  pattern: Pattern,
): string {
  const paras: string[] = [pattern.hook(subjectOf(items))]
  const evidence = materialParas(items)
  let spent = false

  for (const step of pattern.steps) {
    if (step.lead) paras.push(step.lead)
    if (step.fillsFromMaterial && evidence.length && !spent) {
      paras.push(...evidence)
      spent = true
    } else if (step.gap) {
      paras.push(step.gap)
    }
  }

  // Anything left over that the skeleton had no slot for still belongs in the
  // post — the author's own words are never dropped to fit a shape.
  if (!spent && evidence.length) paras.push(...evidence)

  // §3 / §10 — the pointer comes last, and only once the insight is on the
  // page. At a 100/0 ratio there is no pointer at all.
  const cta = composeCta(materialText(items), brief)
  if (cta) paras.push(cta)

  // No brief restatement here. The audience/type/tone are settings the author
  // already chose — writing them back as a line of the post is filler, and it
  // is the first thing they would delete.
  return paras.join('\n\n')
}

export interface ComposedOutline {
  headline: string
  body: string
  /** the §5 pattern this write-up is shaped on */
  pattern: PatternId
  /** the §6 dashboard the CTA points at (null at a 100/0 insight ratio) */
  dashboard: string | null
}

/** The step-one write-up for a group of materials. */
export function composeOutline(
  group: Pick<MaterialGroup, 'items'>,
  brief: GenerationBrief,
): ComposedOutline {
  const { items } = group
  const patternId = pickPattern(brief, items)
  const pattern = PATTERNS[patternId]
  const text = materialText(items)
  return {
    headline: composeHeadline(items, brief),
    body: composeBody(items, brief, pattern),
    pattern: patternId,
    dashboard: brief.promotionRatio === 100 ? null : pickDashboard(text, brief).name,
  }
}
