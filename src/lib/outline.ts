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
import { type Excerpt, SELF_VOICE_RE, excerptsFrom, subjectFrom } from './readSource'

/* ============================================================
   Step one of generating a post: a basic write-up composed from
   the materials the author actually added — and, when a document
   or an article was provided, from what it says.

   The shape is not invented here — it comes from the playbook
   (finance_linkedin_creator_strategy_kb.md §5): a pattern
   skeleton is chosen for the brief, the author's own material is
   dropped into the steps it can fill, and the steps it can't are
   left as visible bracketed gaps.

   Two rules govern what the material becomes:

   · NEVER FABRICATE FIGURES (§6). Where a number or a mechanism
     belongs and we don't have one, the write-up asks for it in
     brackets rather than writing something plausible.
   · NEVER PARAPHRASE A SOURCE. A PDF or an article contributes
     verbatim sentences with their page or host attached, because
     a paraphrase of a filing is a claim nobody can audit. The
     selection is ours; the wording is the document's.
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
  if (picked.length <= max) return picked
  // Cut on a word boundary — "₹3,591 cror…" is worse than stopping a word
  // early — then drop any trailing filler word, because "well below the…"
  // dangles where "well below…" reads as a deliberate trim.
  const cut = picked.slice(0, max)
  const space = cut.lastIndexOf(' ')
  const trimmed = space > max * 0.6 ? cut.slice(0, space) : cut
  return `${trimmed
    .replace(/\s+\b(the|a|an|of|in|on|to|for|and|or|with|from|at|by|its|their|that|which|as)\b$/i, '')
    .replace(/[,;:—-]+$/, '')
    .trimEnd()}…`
}

/** Collapses a note to one line, for use as a numbered list item. */
function firstLine(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

/** The prose an author wrote into a note (falls back to its title). */
function noteText(item: WorkspaceItem): string {
  const body = (item.preview || '').trim()
  return body || item.title.trim()
}

/** Everything the author gave us as one searchable blob (used to route the CTA). */
function materialText(items: WorkspaceItem[]): string {
  return items
    .map((it) => [it.title, it.preview, it.url, it.extracted].filter(Boolean).join(' '))
    .join('\n')
}

/* ---- what was read ------------------------------------------ */

/** Materials whose text we actually have. */
function readItems(items: WorkspaceItem[]): WorkspaceItem[] {
  return items.filter((it) => (it.extracted ?? '').trim().length > 0)
}

/** How to cite a read material: its document name, or the site it came from. */
function citeLabel(item: WorkspaceItem): string {
  if (item.url) return hostOf(item.url)
  return titleFromFileName(item.title)
}

/**
 * The quotable evidence across every document and article provided.
 *
 * Each source contributes its best lines rather than the first N overall, so a
 * single long prospectus can't crowd out the article that was dropped beside it.
 *
 * Cached per item: scanning forty pages of a prospectus for its most quotable
 * sentences is the one genuinely expensive thing here, and the headline, the
 * check count and the body each need the same answer.
 */
const EXCERPT_CACHE = new WeakMap<WorkspaceItem, Excerpt[]>()

function excerptsOf(item: WorkspaceItem): Excerpt[] {
  const hit = EXCERPT_CACHE.get(item)
  if (hit) return hit
  const found = excerptsFrom(
    { text: item.extracted ?? '', label: citeLabel(item), paged: item.type === 'pdf' },
    6,
  )
  EXCERPT_CACHE.set(item, found)
  return found
}

function readExcerpts(items: WorkspaceItem[], perSource = 3): Excerpt[] {
  const sources = readItems(items)
  const share = sources.length > 2 ? 2 : perSource
  return sources
    .flatMap((it) => excerptsOf(it).slice(0, share))
    .sort((a, b) => b.weight - a.weight)
}

/** A quote, formatted as the post carries it: the line, then where it's from. */
function quoteLine(e: Excerpt): string {
  const text = /[.!?]$/.test(e.text) ? e.text : `${e.text}.`
  return `"${text}" — ${e.locator}`
}

/**
 * A noun phrase for what the post is about, used inside the pattern's hook —
 * or an empty string when the material doesn't name anything.
 *
 * A read document names itself: its own opening line is a better subject than
 * its filename, and it is the document's wording rather than ours. Failing
 * that, a filename or a host. What is never used is the author's note truncated
 * to seven words — "whether mix is shifting to entry-level, not premium holds
 * up" is a sentence sawn in half. Every hook reads correctly with no subject,
 * so an empty string is the honest answer.
 */
function subjectOf(items: WorkspaceItem[]): string {
  const read = readItems(items)[0]
  if (read?.extracted) {
    const named = subjectFrom({
      text: read.extracted,
      label: citeLabel(read),
      paged: read.type === 'pdf',
    })
    if (named) return named
  }
  const doc = items.find((it) => it.type === 'pdf')
  if (doc) return `the ${titleFromFileName(doc.title)}`
  // Never "the livemint.com filing" — a news site does not file anything, and
  // calling its report a filing is the sort of small false claim §9 rejects.
  const link = items.find((it) => it.url)
  if (link?.url) return `the ${hostOf(link.url)} report`
  return ''
}

/**
 * Names the post. The author's own note wins — they wrote it after reading the
 * material. Then the strongest sourced line out of the documents we read, then
 * a document name, then the site linked.
 */
function composeHeadline(items: WorkspaceItem[], brief: GenerationBrief): string {
  // Anything the author typed beats anything derived — even a few words.
  const longest = items
    .filter((it) => it.type === 'note')
    .map(noteText)
    .filter(Boolean)
    .sort((a, b) => b.length - a.length)[0]
  if (longest) return firstSentence(longest)

  // The best evidence line out of what was read — a real finding, in the
  // document's own words, rather than a filename dressed up as a title. A
  // first-person line is skipped where possible: "Our revenue increased 34%" as
  // a headline reads as our revenue, not the issuer's.
  const quotes = readExcerpts(items, 4)
  // The line itself is never reworded, even here — where only the issuer's own
  // voice is available it is used as it was written, and the author retitles it.
  const best =
    quotes.find((e) => e.hasFigure && !SELF_VOICE_RE.test(e.text)) ??
    quotes.find((e) => e.hasFigure) ??
    quotes[0]
  if (best) return firstSentence(best.text)

  // A document name is usable; a screenshot filename ("Screenshot 2026-07-28
  // at 11.02") tells the reader nothing, so it's skipped.
  const doc = items.find((it) => it.type === 'pdf')
  if (doc) {
    // "scanned-annual-report.pdf" becomes a title, so it gets a title's capital.
    const name = titleFromFileName(doc.title)
    return name ? `${name[0].toUpperCase()}${name.slice(1)}` : name
  }

  const link = items.find((it) => it.url)
  if (link?.url) return `What ${hostOf(link.url)} is reporting`

  const type = labelOf(CONTENT_TYPE_OPTS, brief.contentType).replace(/ \/.*$/, '')
  return `Untitled ${type.toLowerCase()}`
}

/** How many notes get quoted in full before the rest are just counted. */
const NOTES_SHOWN = 4

/**
 * The evidence lines this material yields, in order: the author's own notes
 * first, then the strongest sourced sentences out of what was read.
 *
 * One function, because §5's hook states the count ("Three checks tell you…")
 * and the body prints the list — if they were counted separately the post would
 * promise one number and show another.
 */
function evidenceLines(items: WorkspaceItem[]): { notes: string[]; quotes: Excerpt[] } {
  const notes = items.filter((it) => it.type === 'note').slice(0, NOTES_SHOWN)
  // Room left over after the author's own notes — their words lead.
  const room = Math.max(1, NOTES_SHOWN - notes.length)
  return { notes: notes.map(noteText), quotes: readExcerpts(items).slice(0, room) }
}

/** How many checks a checklist will have — §5 states the count up front. */
function countChecks(items: WorkspaceItem[]): number {
  const { notes, quotes } = evidenceLines(items)
  return notes.length + quotes.length
}

/**
 * The author's material, as the paragraphs it can legitimately become.
 *
 * Notes go in verbatim — they're the argument. A document or article that was
 * read contributes its own strongest sentences, quoted with the page or the site
 * they came from, so every figure in the post is traceable to the source that
 * printed it. Nothing here summarises: a summary of a filing is a claim we
 * can't attribute, and §9 hard-rejects an unsourced claim.
 *
 * On a checklist pattern the lines are numbered instead of paragraphed, which
 * is what §5's framework and data-list skeletons actually describe — and it's
 * why picking "Framework / checklist" changes the post you can see, not just
 * the headings underneath it.
 */
function materialParas(items: WorkspaceItem[], enumerate = false): string[] {
  const paras: string[] = []

  const { notes, quotes } = evidenceLines(items)

  if (enumerate && notes.length + quotes.length > 1) {
    // One check per line, numbered — a checklist reads as a block, not as
    // separate paragraphs. A single item is not a list, so it stays prose.
    const lines = [...notes.map(firstLine), ...quotes.map(quoteLine)]
    paras.push(lines.map((l, i) => `${i + 1}. ${l}`).join('\n'))
  } else {
    notes.forEach((n) => paras.push(n))
    quotes.forEach((q) => paras.push(quoteLine(q)))
  }

  const totalNotes = items.filter((it) => it.type === 'note').length
  if (totalNotes > notes.length) {
    const rest = totalNotes - notes.length
    paras.push(`(${rest} more note${rest > 1 ? 's' : ''} to work in.)`)
  }

  // Provenance. A read document is cited by what was read out of it; one we
  // couldn't read is named honestly as a file we haven't opened.
  const read = readItems(items)
  if (read.length) {
    paras.push(
      `Working from: ${read
        .map((it) => {
          const name = citeLabel(it)
          return it.pages ? `${name} (${it.pages} pages)` : name
        })
        .join(', ')}.`,
    )
  }

  const unread = items.filter(
    (it) => (it.type === 'pdf' || it.type === 'screenshot') && !(it.extracted ?? '').trim(),
  )
  if (unread.length) {
    paras.push(
      `Source: ${unread.map((d) => titleFromFileName(d.title)).join(', ')} — not read, quote from it yourself.`,
    )
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
  const paras: string[] = [pattern.hook(subjectOf(items), countChecks(items))]
  const evidence = materialParas(items, pattern.enumerate)
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

/* ---- what the author can see we read ------------------------ */

export interface SourceDigest {
  itemId: string
  /** how it is cited in the post */
  label: string
  pages?: number
  /** words of text we hold for it */
  words: number
  /** every quotable line found, best first — the write-up uses the top few */
  quotes: Excerpt[]
  /** set when reading failed, with the reason */
  error?: string
  reading: boolean
}

/**
 * Per-material account of what was read.
 *
 * Shown beside the write-up so the author can see the post is built on the
 * document's own sentences, check the ones that were picked, and pull in a line
 * that was passed over. Without this the reading is invisible and they have to
 * take our word for it.
 */
export function sourceDigest(items: WorkspaceItem[]): SourceDigest[] {
  return items
    // Screenshots are listed too: once a vision model reads them they carry
    // quotable lines like any other document, and when one can't be read the
    // author needs to see that here rather than discover it in the post.
    .filter(
      (it) => it.type === 'pdf' || it.type === 'link' || it.type === 'screenshot' || it.extracted,
    )
    .map((it) => {
      const text = (it.extracted ?? '').trim()
      return {
        itemId: it.id,
        label: citeLabel(it),
        ...(it.pages ? { pages: it.pages } : {}),
        words: text ? text.split(/\s+/).length : 0,
        quotes: text ? excerptsOf(it) : [],
        ...(it.readError ? { error: it.readError } : {}),
        reading: it.readState === 'reading',
      }
    })
}

/** The quote lines the write-up currently carries, so the rest can be offered. */
export function quoteLineOf(e: Excerpt): string {
  return quoteLine(e)
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
