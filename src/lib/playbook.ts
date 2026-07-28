import {
  type GenerationBrief,
  type ContentType,
  type PillarId,
  type WorkspaceItem,
} from '../types'

/* ============================================================
   THE PLAYBOOK — finance_linkedin_creator_strategy_kb.md, as code.

   That file opens by calling itself "the operational file the
   content generator reads". Until now nothing read it, so a
   generated post carried none of its intelligence. This module is
   that file's operational half: the content patterns (§5), the
   value flow and promotion logic (§3, §10), the dashboards and
   their CTAs (§6), the structural skeletons (§8, §11), and the
   anti-patterns (§12) that must never be generated.

   Rules taken from the file and enforced here:
   · Lead with the signal, never with Munshot.
   · Every claim carries its source. NEVER FABRICATE FIGURES —
     where a number belongs and we don't have one, the generator
     leaves a gap for the author, it does not invent one.
   · One CTA, last, and only once the insight has earned it.
   ============================================================ */

/** §5 — the seven patterns, in the file's own strength order. */
export type PatternId =
  | 'divergence'
  | 'one-chart'
  | 'missed'
  | 'framework'
  | 'data-list'
  | 'reframe'
  | 'why-matters'

/**
 * One move in a pattern's skeleton. `line` is the prose the generator
 * writes; `gap` is what the author has to supply, written as a visible
 * bracket rather than invented.
 */
export interface PatternStep {
  /** heading used when this step becomes an article section */
  heading: string
  /** the sentence the write-up opens this step with, if any */
  lead?: string
  /** the bracketed gap the author fills — omitted when material fills it */
  gap?: string
  /** true when the author's own materials belong in this step */
  fillsFromMaterial?: boolean
}

export interface Pattern {
  id: PatternId
  name: string
  /** 1 = strongest for this audience (§5 ordering) */
  rank: number
  /** the file's one-line description of the shape */
  shape: string
  /**
   * How the post opens. `subject` is a noun phrase for what the material is
   * about, and is often EMPTY — a chart with no note attached names nothing.
   * Every hook has to read correctly either way.
   */
  hook: (subject: string) => string
  steps: PatternStep[]
}

/** " on the DRHP filing" / "" — lets one hook string serve both cases. */
function on(subject: string, prep = 'on'): string {
  return subject ? ` ${prep} ${subject}` : ''
}

export const PATTERNS: Record<PatternId, Pattern> = {
  divergence: {
    id: 'divergence',
    name: 'Divergence / contrarian',
    rank: 1,
    shape: 'The headline says X. The underlying data says Y.',
    hook: (s) => `The consensus read${on(s)} is the obvious one. The data underneath does not support it.`,
    steps: [
      { heading: 'The headline claim', gap: '[what the market currently believes here — one line]' },
      { heading: 'The data that contradicts it', fillsFromMaterial: true },
      { heading: 'Why the gap exists', gap: '[the mechanism — what produces this, and why it stays unnoticed]' },
      { heading: 'What it means for a book', gap: '[the implication for durability, multiple or risk — one line]' },
    ],
  },
  'one-chart': {
    id: 'one-chart',
    name: 'One chart, one insight',
    rank: 2,
    shape: 'A single clean, annotated chart carrying one takeaway.',
    hook: (s) => `One chart${on(s, 'from')}, and one thing it settles.`,
    steps: [
      { heading: 'What the chart shows', fillsFromMaterial: true },
      { heading: 'The one takeaway', gap: '[the single thing this chart proves — resist adding a second]' },
      { heading: 'Investor implication', gap: '[the implication for the position — what changes because of it]' },
    ],
  },
  missed: {
    id: 'missed',
    name: 'What most investors missed',
    rank: 3,
    shape: 'The signal buried under the obvious number.',
    hook: (s) => `Everyone read the top-line number${on(s, 'in')}. The signal is one layer under it.`,
    steps: [
      { heading: 'The number everyone saw', gap: '[the obvious headline figure — sourced, not estimated]' },
      { heading: 'The signal underneath', fillsFromMaterial: true },
      {
        heading: 'Why it matters',
        gap: '[what this means for the position that the headline number hides]',
      },
    ],
  },
  framework: {
    id: 'framework',
    name: 'Framework / named questions',
    rank: 4,
    shape: 'A fixed, repeatable test the reader can reuse.',
    hook: (s) =>
      s
        ? `A few checks tell you whether ${s} holds up. These are the ones that do the work.`
        : 'A few checks do most of the work here. These are them.',
    steps: [
      { heading: 'The checks', fillsFromMaterial: true },
      { heading: 'How to apply it', gap: '[where each check is read from — filing, disclosure, dashboard field]' },
      {
        heading: 'What it rules out',
        gap: '[the conclusion this lets you reject — and what it means for the position]',
      },
    ],
  },
  'data-list': {
    id: 'data-list',
    name: 'Data-backed list',
    rank: 5,
    shape: 'Scannable — but every item carries a number.',
    hook: (s) =>
      `${s ? `${s[0].toUpperCase()}${s.slice(1)}, as a checklist` : 'As a checklist'}. Every item below carries its own evidence — a list without data is filler.`,
    steps: [
      { heading: 'The claim to pressure-test', gap: '[the assumption these checks are testing]' },
      { heading: 'The checks', fillsFromMaterial: true },
      { heading: 'Where to verify each', gap: '[the source for each item — this is what makes it usable]' },
      { heading: 'What it means', gap: '[the implication if the checks fail — one line]' },
    ],
  },
  reframe: {
    id: 'reframe',
    name: 'Question-led reframe',
    rank: 6,
    shape: 'A question that changes how they read a number.',
    hook: (s) =>
      s
        ? `${s[0].toUpperCase()}${s.slice(1)} raises a better question than the one being asked of it.`
        : 'This number raises a better question than the one being asked of it.',
    steps: [
      { heading: 'The number', fillsFromMaterial: true },
      { heading: 'The reframing question', gap: '[the question that changes the reading — one line]' },
      {
        heading: 'The answer the data gives',
        gap: '[what the evidence says once reframed, and what it means for the position]',
      },
    ],
  },
  'why-matters': {
    id: 'why-matters',
    name: "Here's why it matters",
    rank: 7,
    shape: 'Second-order thinking made explicit.',
    hook: (s) =>
      s
        ? `${s[0].toUpperCase()}${s.slice(1)} is being priced on its first-order read. The second-order effect is the one that reprices it.`
        : 'This is being priced on its first-order read. The second-order effect is the one that reprices it.',
    steps: [
      { heading: 'The event', fillsFromMaterial: true },
      { heading: 'The first-order read', gap: '[where most analysis stops]' },
      { heading: 'The second-order effect', gap: '[the consequence of the consequence — this is the post]' },
      { heading: 'Implication', gap: '[what a desk does differently]' },
    ],
  },
}

/** §5 — content type maps onto the shape that fits it. */
const TYPE_PATTERN: Record<ContentType, PatternId> = {
  framework: 'framework',
  'deep-dive': 'why-matters',
  'data-drop': 'one-chart',
  contrarian: 'divergence',
  explainer: 'reframe',
  'case-study': 'missed',
  'myth-buster': 'divergence',
  trend: 'why-matters',
  teardown: 'framework',
  bookshelf: 'data-list',
}

/**
 * Chooses the pattern. The brief's content type sets the default; a
 * non-consensus stance overrides it (§5 ranks divergence strongest); and
 * a chart with nothing written around it is a one-chart post whatever the
 * brief says, because that is all the material can carry.
 */
export function pickPattern(brief: GenerationBrief, items: WorkspaceItem[]): PatternId {
  const notes = items.filter((it) => it.type === 'note' || it.type === 'link')
  const charts = items.filter((it) => it.type === 'screenshot')
  if (charts.length === 1 && notes.length === 0 && items.length === 1) return 'one-chart'
  if (brief.pointOfView === 'contrarian') return 'divergence'
  if (brief.pointOfView === 'variant') return 'missed'
  return TYPE_PATTERN[brief.contentType]
}

/* ------------------------------------------------------------
   §6 / §10 — the dashboards, and the CTA each one earns.
   The CTA is chosen by what the material is actually about, so
   it "flows from the insight" (§9) instead of being bolted on.
   ------------------------------------------------------------ */

export interface Dashboard {
  id: string
  name: string
  /** the subject area, used as the campaign's topic line */
  topic: string
  /** the Munshot product this subject sits closest to (see PROMOTIONS) */
  promoId: string
  /** what the material has to mention for this to be the right pointer */
  match: RegExp
  /** the §6 CTA, value-first and single-link */
  cta: string
}

export const DASHBOARDS: Dashboard[] = [
  {
    id: 'drhp',
    promoId: 'promo-drhp',
    topic: 'IPO / Primary markets',
    name: 'DRHP Tracker',
    match: /\b(drhp|ipo|offer[- ]for[- ]sale|ofs|red herring|sebi filing|listing|anchor book)\b/i,
    cta: 'The full fresh-vs-OFS split by filing is in the DRHP Tracker.',
  },
  {
    id: 'health-insurance',
    promoId: 'promo-sector',
    topic: 'Insurance / Sector',
    // "premium" alone is a trap — an auto note saying "not premium" is not an
    // insurance note, so the money sense has to be spelled out.
    name: 'Health Insurance Dashboard',
    match: /\b(insurer|insurance|premium (?:growth|income|rate|pricing)|renewal (?:rate|pricing)|combined ratio|claims ratio|gwp)\b/i,
    cta: 'Price-vs-volume decomposition for each insurer is on the Health Insurance Dashboard.',
  },
  {
    id: 'auto',
    promoId: 'promo-channel',
    topic: 'Auto / OEM',
    name: 'Auto Dashboard',
    match: /\b(oem|auto|vehicle|dealer|inventory days|discount|two[- ]wheeler|passenger vehicle)\b/i,
    cta: 'Mix, inventory days, and discounts per OEM are tracked on the Auto Dashboard.',
  },
  {
    id: 'ownership',
    promoId: 'promo-sector',
    topic: 'Ownership / Flows',
    name: 'Ownership Signal Dashboard',
    match: /\b(shareholding|ownership|promoter|fii|dii|retail holding|stake)\b/i,
    cta: 'Quarter-over-quarter ownership shifts by category are on the Ownership Signal Dashboard.',
  },
  {
    id: 'risk',
    promoId: 'promo-diligence',
    topic: 'Financial forensics',
    name: 'Financial Risk Dashboard',
    match: /\b(pledge|pledged|receivable|contingent liabilit|auditor|related[- ]party|red flag|governance)\b/i,
    cta: 'These signals are flagged per company on the Financial Risk Dashboard.',
  },
  {
    id: 'pulse',
    promoId: 'promo-sector',
    topic: 'Market structure',
    name: 'Daily Market Pulse',
    match: /\b(flows?|rotation|net sell|net buy|sector breakdown|index|nifty|market pulse)\b/i,
    cta: 'Sector-level flow breakdown is in the Daily Market Pulse.',
  },
]

/** Pillars with no keyword hit still get a defensible default pointer. */
const PILLAR_DASHBOARD: Record<PillarId, string> = {
  'research-tradecraft': 'pulse',
  'market-science': 'pulse',
  'financial-forensics': 'risk',
  'decision-frameworks': 'risk',
  'behavioral-edge': 'ownership',
  'governance-incentives': 'ownership',
  'portfolio-risk': 'risk',
  'ai-native': 'pulse',
}

/** The dashboard this material points at — by subject first, pillar second. */
export function pickDashboard(text: string, brief: GenerationBrief): Dashboard {
  const hit = DASHBOARDS.find((d) => d.match.test(text))
  if (hit) return hit
  const fallback = PILLAR_DASHBOARD[brief.pillar]
  return DASHBOARDS.find((d) => d.id === fallback) ?? DASHBOARDS[0]
}

/**
 * §3 / §10 — the CTA. Promotion is earned, so at a 100/0 insight ratio
 * there is no product line at all: the post is the whole value.
 */
export function composeCta(text: string, brief: GenerationBrief): string | null {
  if (brief.promotionRatio === 100) return null
  return pickDashboard(text, brief).cta
}

/* ------------------------------------------------------------
   §2 — register. The audience doesn't lack information, it lacks
   time to extract signal. These are the words the file bans and
   the ones it asks for; used by the pre-publish checks below.
   ------------------------------------------------------------ */

/** §12 anti-patterns, as detectors. A hit is a hard reject, not a nudge. */
export const ANTI_PATTERNS: { id: string; label: string; test: RegExp }[] = [
  {
    id: 'tip',
    label: 'Reads as a buy/sell tip or price target',
    test: /\b(price target|target price|buy this|sell this|multibagger|sure ?shot|will double|must[- ]buy|accumulate at)\b/i,
  },
  {
    id: 'hype',
    label: 'Hype / hustle tone',
    test: /\b(insane|game[- ]changer|explosive|skyrocket|mind[- ]blowing|10x your|secret sauce|hack)\b/i,
  },
  {
    id: 'bait',
    label: 'Engagement bait or curiosity gap',
    test: /(comment ["“]?yes|drop a ["“]?\+?1|you won'?t believe|thread ?🧵|like if you|tag someone)/i,
  },
  {
    id: 'generic',
    label: 'Generic finance advice — empty for this audience',
    test: /\b(\d+\s+money (tips|habits)|financial freedom|get rich|passive income ideas)\b/i,
  },
]

/** A bracketed gap the author still has to fill. Global — use with `match`,
    never with `.test()`, which is stateful on a /g regex. */
export const GAP_RE = /\[[^\]\n]{4,}\]/g

/** Same shape, safe to `.test()`. */
const HAS_GAP = /\[[^\]\n]{4,}\]/

/** Something that reads as evidence: a figure, a period, a filing reference.
    No trailing \b after the unit — "18% in Q1" has a space there, so requiring
    a word boundary would reject the most common way a figure is written. */
const NUMBER_RE = /(₹\s?\d|[$€£]\s?\d|\b\d+(\.\d+)?\s?(%|bps|x\b|cr\b|crore|lakh|bn\b|mn\b|million|billion)|\bQ[1-4](\s?FY)?\b|\bFY\s?\d{2})/i
const SOURCE_RE = /(https?:\/\/|\bsource\b|\bfiling|\bdisclos|\bDRHP\b|\bshareholding pattern\b|↳|working from:)/i

export type ScoreDim =
  | 'investorValue'
  | 'clarity'
  | 'evidence'
  | 'relevance'
  | 'cta'
  | 'tone'

export interface ScoreLine {
  dim: ScoreDim
  label: string
  score: 0 | 1 | 2
  /** what would move it up — empty at 2 */
  fix: string
}

export interface PieceScore {
  lines: ScoreLine[]
  total: number
  /** §9 — pass is ≥9 of 12 with nothing hard-rejected */
  pass: boolean
  hardRejects: string[]
  gaps: number
}

/**
 * §9 — the pre-publish rubric, run on the write-up.
 *
 * These are STRUCTURAL checks, not a judgement of the argument: the file's
 * six dimensions each have a signal that can actually be detected in text
 * (is the signal in the first two lines, is there a sourced number, is
 * there exactly one CTA). It tells the author what the playbook would
 * reject; it does not claim to know whether the insight is good.
 */
export function scorePiece(input: {
  headline: string
  body: string
  brief: GenerationBrief
}): PieceScore {
  const { headline, body, brief } = input
  const text = `${headline}\n${body}`
  const paras = body.split('\n\n').filter((p) => p.trim())
  const gaps = (text.match(GAP_RE) ?? []).length
  // The gap prompts are our own words, not the author's — scoring them as
  // evidence or as a stated implication would grade the scaffolding.
  const filled = text.replace(GAP_RE, ' ')
  const hasNumber = NUMBER_RE.test(filled)
  const hasSource = SOURCE_RE.test(filled)
  const ctaLines = DASHBOARDS.filter((d) => text.includes(d.name)).length
  const links = (body.match(/https?:\/\//g) ?? []).length
  const words = filled.trim() ? filled.trim().split(/\s+/).length : 0

  const lines: ScoreLine[] = []

  // Investor value — is there a stated implication, or only description?
  const hasImplication = /\b(implication|means for|reprices?|durabilit|multiple|risk|what a desk|position|underprice)\b/i.test(
    body.replace(GAP_RE, ' '),
  )
  lines.push({
    dim: 'investorValue',
    label: 'Investor value',
    score: hasImplication && gaps === 0 ? 2 : hasImplication || words > 60 ? 1 : 0,
    fix: hasImplication
      ? gaps > 0
        ? `${gaps} gap${gaps > 1 ? 's' : ''} still bracketed — fill them and the signal is extractable.`
        : ''
      : 'Say what it means for a position, not only what happened.',
  })

  // Clarity — §9 wants the signal inside the first two lines.
  const lead = paras[0] ?? ''
  const leadWords = lead.trim() ? lead.trim().split(/\s+/).length : 0
  lines.push({
    dim: 'clarity',
    label: 'Clarity',
    score: leadWords > 0 && leadWords <= 40 && !HAS_GAP.test(lead) ? 2 : leadWords > 0 ? 1 : 0,
    fix:
      leadWords === 0
        ? 'Open with the signal.'
        : leadWords > 40
          ? 'Lead is long — put the signal in the first two lines.'
          : HAS_GAP.test(lead)
            ? 'The opening line still has a gap in it.'
            : '',
  })

  // Evidence — a number, and where it came from.
  lines.push({
    dim: 'evidence',
    label: 'Evidence',
    score: hasNumber && hasSource ? 2 : hasNumber || hasSource ? 1 : 0,
    fix: hasNumber
      ? hasSource
        ? ''
        : 'Name the source the figures come from.'
      : 'No figure yet — one sourced number is what makes this auditable.',
  })

  // Munshot relevance — does the pointer follow from the subject?
  const dash = pickDashboard(text, brief)
  const earned = brief.promotionRatio === 100 || text.includes(dash.name)
  lines.push({
    dim: 'relevance',
    label: 'Munshot relevance',
    score: earned ? 2 : ctaLines > 0 ? 1 : 0,
    fix: earned ? '' : `Point at ${dash.name} — it's the view this material sits in.`,
  })

  // CTA strength — one link, last, value-first.
  const ctaOk = brief.promotionRatio === 100 ? links <= 1 : ctaLines === 1 && links <= 1
  lines.push({
    dim: 'cta',
    label: 'CTA strength',
    score: ctaOk ? 2 : ctaLines > 1 || links > 1 ? 0 : 1,
    fix: ctaOk ? '' : ctaLines > 1 || links > 1 ? 'More than one CTA — keep exactly one.' : 'Close with one value-first line.',
  })

  // Non-promotional tone — §12.
  const hits = ANTI_PATTERNS.filter((a) => a.test.test(text))
  lines.push({
    dim: 'tone',
    label: 'Non-promotional tone',
    score: hits.length ? 0 : 2,
    fix: hits.length ? hits.map((h) => h.label).join(' · ') : '',
  })

  // §9 hard rejects — these override the total.
  const hardRejects: string[] = hits.map((h) => h.label)
  if (hasNumber && !hasSource) hardRejects.push('A figure with no source attached')
  // An unfilled bracket is not publishable copy, so it can't pass — a draft of
  // prompts would otherwise score well on structure while saying nothing. While
  // gaps remain they subsume the missing-takeaway reject: the gap IS the ask.
  if (gaps > 0) hardRejects.push(`${gaps} unfilled gap${gaps > 1 ? 's' : ''}`)
  else if (!hasImplication) hardRejects.push('No clear takeaway for the reader')

  const total = lines.reduce((n, l) => n + l.score, 0)
  return { lines, total, pass: total >= 9 && hardRejects.length === 0, hardRejects, gaps }
}
