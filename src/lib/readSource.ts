import { PAGE_SEP } from './extract'

/* ============================================================
   Turning a read document into the evidence a post can stand on.

   The playbook's hardest rule (§6, §9, §12) is that every claim
   carries its source and no figure is ever fabricated. So nothing
   in this module writes a sentence: it SELECTS sentences that are
   already in the document, keeps the page or the URL they came
   from, and hands them to the composer as quotes.

   What counts as worth quoting, in the file's own terms (§2, §9):
   a line carrying a figure, a period, a rate of change, or an
   ownership/risk disclosure — because that is what a reader
   short on time cannot extract for themselves.
   ============================================================ */

/** One sentence lifted verbatim out of provided material, with its provenance. */
export interface Excerpt {
  /** the sentence, exactly as it appears in the source */
  text: string
  /** where in the source it was found — "p. 14" or the article's host */
  locator: string
  /** how strongly it reads as evidence (higher = more quotable) */
  weight: number
  /** true when the sentence carries a figure — §9's evidence dimension */
  hasFigure: boolean
}

/** A figure a reader could audit: money, a rate, a period, a multiple. */
const FIGURE_RE =
  /(₹\s?[\d,]+(?:\.\d+)?|(?:Rs\.?|INR)\s?[\d,]+(?:\.\d+)?|[$€£]\s?[\d,]+(?:\.\d+)?|\b\d+(?:\.\d+)?\s?(?:%|per cent|percent|bps|bn|mn|crore|cr\b|lakh|million|billion|times|x\b)|\bQ[1-4]\s?FY\s?\d{2}|\bFY\s?\d{2,4}|\bH[12]\s?FY\s?\d{2})/i

/** The vocabulary of a disclosure — §6's dashboards are built on these. */
const SIGNAL_RE =
  /\b(revenue|profit|loss|margin|ebitda|pat|growth|decline|de ?grew|yoy|y-o-y|qoq|premium|claims?|combined ratio|market share|volume|realisation|realization|asp|inventory|order book|capex|debt|leverage|pledge|promoter|shareholding|stake|fii|dii|receivable|provision|contingent|auditor|related[- ]party|guidance|outlook|fresh issue|offer for sale|ofs|valuation|multiple|discount|price hike|utilisation|utilization)\b/i

/** Words that mark a line as boilerplate rather than substance. */
const BOILERPLATE_RE =
  /(all rights reserved|privacy policy|terms (?:of|and) |subscribe|newsletter|cookie|advertisement|read more|click here|share this|follow us|copyright|©|table of contents|page \d+ of \d+|this (?:page|section) (?:is )?intentionally|^please read|^dated\b|^for private circulation|^strictly confidential)/i

/** Legal/risk-factor scaffolding that carries figures but says nothing. */
const LEGALESE_RE =
  /\b(hereinafter|whereas|pursuant to the provisions|as amended from time to time|notwithstanding anything|the said|schedule [ivx]+ of the)\b/i

/**
 * Splits prose into sentences.
 *
 * The hard part is undoing the line wrapping a PDF arrives with. A body line
 * that ends without punctuation is nearly always mid-sentence — including when
 * the next line starts with a capital ("…by the Promoter" / "Selling
 * Shareholders."), which is why case can't be the test. Length can: a wrapped
 * body line is long, a heading is short. Getting this wrong produces
 * half-sentences, and a half-sentence is the one thing a quotation must not be.
 */
const WRAP_MIN = 45

export function splitSentences(text: string): string[] {
  const joined: string[] = []
  // A blank line is a paragraph break and never a wrap — joining across one
  // welds an article's headline onto its first paragraph.
  for (const para of text.split(/\n\s*\n/)) {
    const start = joined.length
    for (const block of para.split('\n')) {
      const line = block.trim()
      if (!line) continue
      const prev = joined[joined.length - 1]
      if (joined.length > start && prev.length >= WRAP_MIN && !/[.!?:;)]$/.test(prev)) {
        joined[joined.length - 1] = `${prev} ${line}`
      } else {
        joined.push(line)
      }
    }
  }

  const out: string[] = []
  for (const line of joined) {
    // A full stop inside an abbreviation or a figure is not a sentence end.
    // The single-capital guard covers "U.S." and initials; the named ones cover
    // the abbreviations that end in lowercase.
    const parts = line.split(
      /(?<![A-Z])(?<!\bRs)(?<!\bLtd)(?<!\bPvt)(?<!\bNo)(?<!\bMr)(?<!\bMs)(?<!\bDr)(?<!\bvs)(?<!\betc)(?<!\bInc)(?<!\bfig)(?<!\d)(?<=[.!?])\s+(?=[A-Z(₹"'])/,
    )
    for (const part of parts) {
      const s = part.trim()
      if (s) out.push(s)
    }
  }
  return out
}

/** Trailing artefacts of PDF extraction that shouldn't appear in a quote. */
function tidy(sentence: string): string {
  return sentence
    .replace(/^[\s•·▪◦*\-–—|]+/, '')
    .replace(/\s*\|\s*/g, ' · ')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([.,;:])/g, '$1')
    .trim()
}

/** Is this a whole thought, or half of one? */
function looksComplete(s: string): boolean {
  const words = s.split(/\s+/).length
  if (words < 6 || words > 60) return false
  if (!/^["'(₹$€£A-Z0-9]/.test(s)) return false
  // A sentence ending on a preposition or conjunction was cut off.
  if (/\b(and|or|of|for|with|the|a|an|to|in|on|by|from|that|which)$/i.test(s)) return false
  // An opened bracket or quote that never closes means the split landed inside
  // a parenthetical — "…promote the upcoming IPO (U.S." is not quotable.
  const opens = (s.match(/[([]/g) ?? []).length
  const closes = (s.match(/[)\]]/g) ?? []).length
  if (opens !== closes) return false
  if ((s.match(/"/g) ?? []).length % 2 !== 0) return false
  // A line that is mostly digits is a table row, unreadable out of context.
  const digits = (s.match(/\d/g) ?? []).length
  if (digits > s.length * 0.4) return false
  return true
}

/**
 * A company describing itself. Quotable — it's sourced and it carries the
 * figure — but it is the issuer's own framing, so §2's audience reads it as
 * promotion. Ranked below the same fact stated flatly.
 */
export const SELF_VOICE_RE = /^(our|we\b|the company believes|management believes)/i

function scoreSentence(s: string): number {
  let score = 0
  const hasFigure = FIGURE_RE.test(s)
  if (hasFigure) score += 3
  if (SIGNAL_RE.test(s)) score += 2
  if (SELF_VOICE_RE.test(s)) score -= 1
  // Comparison is what makes a figure mean something (§5's divergence pattern).
  if (/\b(compared (?:to|with)|versus|vs\.?|against|up from|down from|rose|fell|increased|decreased|higher|lower|against last year)\b/i.test(s)) {
    score += 2
  }
  // Two figures in one sentence is usually the delta itself.
  const figures = s.match(new RegExp(FIGURE_RE.source, 'gi'))
  if (figures && figures.length > 1) score += 1
  // §2 — the audience distrusts adjectives. Prefer the flat, factual line.
  if (/\b(strong|robust|healthy|exciting|impressive|remarkable|significant)\b/i.test(s)) score -= 1
  const words = s.split(/\s+/).length
  if (words >= 10 && words <= 34) score += 1
  return score
}

export interface ReadSource {
  /** the extracted text of one material */
  text: string
  /** how to cite it: a filename, or a host */
  label: string
  /** true when locators are page numbers (a PDF) rather than a host */
  paged?: boolean
}

/**
 * The most quotable sentences in a piece of read material, best first.
 *
 * Sentences carrying a figure are ranked above sentences that only assert, and
 * near-duplicates are dropped — a filing repeats its own summary several times
 * and quoting it twice reads as padding.
 */
export function excerptsFrom(source: ReadSource, limit = 6): Excerpt[] {
  const pages = source.text.split(PAGE_SEP)
  const found: Excerpt[] = []

  pages.forEach((page, pageIndex) => {
    for (const raw of splitSentences(page)) {
      const s = tidy(raw)
      if (!s || BOILERPLATE_RE.test(s) || LEGALESE_RE.test(s)) continue
      if (!looksComplete(s)) continue
      const weight = scoreSentence(s)
      if (weight < 3) continue
      found.push({
        text: s,
        locator: source.paged && pages.length > 1 ? `p. ${pageIndex + 1}` : source.label,
        weight,
        hasFigure: FIGURE_RE.test(s),
      })
    }
  })

  // Near-duplicate suppression on the first eight significant words.
  const seen = new Set<string>()
  const key = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9 ]/g, '')
      .split(/\s+/)
      .filter((w) => w.length > 3)
      .slice(0, 8)
      .join(' ')

  return found
    .sort((a, b) => b.weight - a.weight)
    .filter((e) => {
      const k = key(e.text)
      if (!k || seen.has(k)) return false
      seen.add(k)
      return true
    })
    .slice(0, limit)
}

/**
 * What the document appears to be about, taken from its own opening.
 *
 * The first substantial line of a filing or an article names the subject better
 * than a filename does — and it is the document's wording, not ours.
 *
 * It has to be a NAME, not a sentence. Every hook drops the subject mid-clause
 * ("The consensus read on ___ is the obvious one"), and a headline pushed
 * through that slot produces "The consensus read on Two-wheeler makers post
 * record July dispatches but discounts tell another story is the obvious one."
 *
 * So the test is positive, not negative: a title-cased or fully-capitalised run
 * of words with no punctuation and no verb — a document naming itself. Listing
 * the verbs to exclude instead would let every one not on the list through
 * ("IPO redirects here"). Anything that fails is no subject at all, and the
 * caller falls back to the file or the site, which always reads.
 */
const NAMEY_WORD = /^(?:[A-Z][A-Za-z&/'’-]*|[A-Z]{2,}|of|the|and|for|in|on|to|a|an|&)$/

export function subjectFrom(source: ReadSource): string {
  const head = source.text.split(PAGE_SEP)[0] ?? ''
  for (const raw of splitSentences(head).slice(0, 12)) {
    const s = tidy(raw).replace(/[.:;,]+$/, '')
    if (!s || BOILERPLATE_RE.test(s)) continue
    if (/[",;:()[\]]/.test(s)) continue
    const words = s.split(/\s+/)
    if (words.length < 3 || words.length > 8) continue
    if (!words.every((w) => NAMEY_WORD.test(w))) continue
    // A line with no lowercase letters at all is a cover-page banner.
    const shouted = /^[^a-z]+$/.test(s) && /[A-Z]{4}/.test(s)
    const named = shouted ? s.toLowerCase() : s
    // "the draft red herring prospectus holds up" — a bare noun phrase needs
    // its article back, or the hook reads as a telegram.
    return /^(the|a|an|this|its|our|their)\b/i.test(named) ? named : `the ${named}`
  }
  return ''
}
