/* ============================================================
   The auto-generator.

   Takes real posts scraped from real finance writers and composes the
   three Munshot channel drafts from *their actual words* — quoted,
   attributed and linked, never invented. Everything Munshot adds on top
   is framed as Munshot's own angle, so the two never blur.

   Deterministic by design: same post in, same draft out. The extraction
   step (below) is the seam an LLM pass would slot into later.
   ============================================================ */

import type { HarvestedPost } from '../../shared/harvest'
import { voiceById } from '../../shared/voices'
import type {
  ArticleContent,
  ArticleSection,
  CampaignSource,
  EmailContent,
  LinkedInContent,
} from '../types'

/* ---------------------------------------------------------------- */
/* 1. Markdown → clean prose                                         */
/* ---------------------------------------------------------------- */

const BOILERPLATE =
  /(subscribe|sign up|newsletter|click here|read more|share this|disclaimer|past performance|all rights reserved|cookie|privacy policy|follow us|comments? \(\d|©)/i

/** Strip markdown furniture and return substantive paragraphs. */
export function toParagraphs(markdown: string): string[] {
  return markdown
    .replace(/```[\s\S]*?```/g, ' ') // code fences
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ') // images
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // links → their text
    .replace(/^\s{0,3}#{1,6}\s+/gm, '') // heading markers
    .replace(/^\s{0,3}>\s?/gm, '') // blockquote markers
    .replace(/^\s*\|.*\|\s*$/gm, ' ') // table rows
    .replace(/[*_`]/g, '')
    .split(/\n\s*\n/)
    // Stripping links/emphasis leaves gaps before punctuation ("dissertation ,").
    .map((p) => p.replace(/\s+/g, ' ').replace(/\s+([,.;:!?])/g, '$1').trim())
    .filter((p) => p.length >= 90 && !BOILERPLATE.test(p))
}

const SENTENCE_SPLIT = /(?<=[.!?])\s+(?=[A-Z“"'(])/

export function toSentences(paragraphs: string[]): string[] {
  return paragraphs
    .flatMap((p) => p.split(SENTENCE_SPLIT))
    .map((s) => s.trim())
    .filter((s) => s.length >= 45 && s.length <= 320 && !BOILERPLATE.test(s))
}

/* ---------------------------------------------------------------- */
/* 2. Find the sentences worth quoting                               */
/* ---------------------------------------------------------------- */

const HAS_FIGURE = /(\d+(\.\d+)?\s?%|₹\s?[\d,.]+|\$\s?[\d,.]+|\b\d{2,}\b|\bbps\b|\bcrore\b|\bbillion\b|\bmillion\b|\btrillion\b)/i
const COMPARATIVE = /\b(more|less|higher|lower|faster|slower|rose|fell|grew|shrank|doubled|halved|than|versus|vs\.?|outpaced|lagged)\b/i
const CLAIM = /\b(because|means|implies|suggests|the reason|matters|the point|in other words|which is why|the risk|the question)\b/i
const HEDGE = /\b(i think|i believe|in my view|as i wrote|last week i|my friend)\b/i

const STOPWORDS = new Set([
  'about', 'after', 'again', 'against', 'because', 'been', 'before', 'being',
  'between', 'could', 'doing', 'during', 'every', 'have', 'having',
  'into', 'more', 'most', 'other', 'over', 'same', 'should', 'some', 'such',
  'than', 'that', 'their', 'them', 'then', 'there', 'these', 'they', 'this',
  'those', 'through', 'under', 'until', 'were', 'what', 'when', 'where',
  'which', 'while', 'with', 'would', 'your',
])

/** Content words from the headline — the post's own topic vocabulary. */
function topicWords(title: string): Set<string> {
  return new Set(
    title
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length >= 5 && !STOPWORDS.has(w)),
  )
}

/**
 * Score a sentence on how well it carries an argument on its own.
 * `position` is 0 at the top of the piece and 1 at the end: blog pages leak
 * related-post and footer text at the bottom, and the thesis is usually up top.
 */
function scoreSentence(s: string, position: number, topic: Set<string>): number {
  let score = 0
  if (HAS_FIGURE.test(s)) score += 3
  if (COMPARATIVE.test(s)) score += 2
  if (CLAIM.test(s)) score += 2
  if (s.length >= 70 && s.length <= 220) score += 2
  if (s.length > 260) score -= 2
  if (HEDGE.test(s)) score -= 2
  // A sentence whose subject lives in the previous one is a bad pull-quote.
  // (Purely structural openers like "Third," aren't penalised — they get
  // stripped by cleanQuote instead, which keeps the substance.)
  if (/^(but|and|so|that|this|it|they|he|she|those|these|which)\b/i.test(s)) score -= 3

  // On-topic beats merely well-formed: reward overlap with the headline.
  const lower = s.toLowerCase()
  let hits = 0
  for (const word of topic) if (lower.includes(word)) hits++
  score += Math.min(hits, 3) * 2

  score += (1 - position) * 3
  return score
}

const LEADING_CONNECTIVE =
  /^(first(ly)?|second(ly)?|third(ly)?|fourth(ly)?|fifth(ly)?|next|then|finally|lastly|moreover|furthermore|in addition|in short|put differently|in other words)\b[,:]?\s+/i

/**
 * Lift a sentence out of its paragraph cleanly. Structural openers ("Third,")
 * only make sense inside a list, so they go — the claim after them is the
 * part worth quoting, and dropping the scaffold changes no meaning.
 */
export function cleanQuote(s: string): string {
  const stripped = s.replace(LEADING_CONNECTIVE, '').trim()
  if (!stripped) return s.trim()
  // Re-capitalise unless the new first word is a name/acronym already.
  return /^[a-z]/.test(stripped) ? stripped[0].toUpperCase() + stripped.slice(1) : stripped
}

interface ScoredSentence {
  text: string
  score: number
}

function scoreAll(markdown: string, title: string): ScoredSentence[] {
  const sentences = toSentences(toParagraphs(markdown))
  const topic = topicWords(title)
  const last = Math.max(sentences.length - 1, 1)
  return sentences
    .map((text, index) => ({ text, score: scoreSentence(text, index / last, topic) }))
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
}

/** The best standalone lines from a post, strongest first. */
export function pullQuotes(markdown: string, title = '', count = 3): string[] {
  return scoreAll(markdown, title)
    .slice(0, count)
    .map((s) => cleanQuote(s.text))
}

const FIGURE_RE =
  /(?:₹|\$|€|£)\s?[\d,.]+\s?(?:bn|mn|cr|crore|lakh|billion|million|trillion)?|\d+(?:\.\d+)?\s?%|\d+\s?bps/gi

/**
 * Figures worth carrying over. Deliberately scoped to the lines we actually
 * quote rather than the whole page — a number lifted from an unrelated
 * paragraph would read as evidence for a claim it has nothing to do with.
 */
export function extractFigures(quotes: string[], limit = 3): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const quote of quotes) {
    for (const raw of quote.match(FIGURE_RE) ?? []) {
      const value = raw.replace(/\s+/g, ' ').trim()
      const key = value.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      out.push(value)
      if (out.length >= limit) return out
    }
  }
  return out
}

/* ---------------------------------------------------------------- */
/* 3. Topic → the Munshot product that actually fits                 */
/* ---------------------------------------------------------------- */

interface TopicRule {
  promoId: string
  topic: string
  hero: string
  keywords: RegExp
}

const TOPIC_RULES: TopicRule[] = [
  {
    promoId: 'promo-drhp',
    topic: 'IPO / Primary markets',
    hero: 'IPO · PRIMARY MARKETS',
    keywords:
      /\b(ipo|listing|listed at|prospectus|drhp|rhp|primary market|offer for sale|ofs|anchor book|subscription|issue size|sebi)\b/i,
  },
  {
    promoId: 'promo-sector',
    topic: 'Sector / Margins',
    hero: 'SECTOR · MARGINS',
    // No bare "valuation"/"earnings" here — they appear in every finance piece
    // ever written and would swallow every other rule.
    keywords:
      /\b(sector|margin|insurer|insurance|nbfc|loss ratio|combined ratio|operating leverage|re-?rating|gross margin|market share)\b/i,
  },
  {
    promoId: 'promo-diligence',
    topic: 'Filings / Diligence',
    hero: 'FILINGS · DILIGENCE',
    keywords:
      /\b(filing|annual report|disclosure|guidance|accounting|auditor|footnote|balance sheet|cash flow|related party|governance|red flag|restatement)\b/i,
  },
  {
    promoId: 'promo-channel',
    topic: 'Demand / Channel signals',
    hero: 'DEMAND · CHANNEL',
    keywords:
      /\b(distributor|dealer|channel check|inventory|volumes|demand|supply chain|footfall|retail sales|capacity)\b/i,
  },
]

const FALLBACK_RULE: TopicRule = {
  promoId: 'promo-sector',
  topic: 'Markets / Analysis',
  hero: 'MARKETS · ANALYSIS',
  keywords: /.^/,
}

/** How strongly the headline and the writer's beat count against the body. */
const TITLE_WEIGHT = 6
const BEAT_WEIGHT = 3
const MIN_BODY_HITS = 3
/** One keyword hit per this many characters before the body counts as evidence. */
const CHARS_PER_BODY_HIT = 8_000

/**
 * Does the body genuinely talk about this beat, or just mention it in passing?
 * A long essay picks up stray keywords from asides and sidebars, so evidence
 * has to scale with length — three "IPO"s in a 40k-character macro piece is
 * noise, the same three in a short note is the subject.
 */
function hasBodyEvidence(hits: number, length: number): boolean {
  return hits >= Math.max(MIN_BODY_HITS, Math.ceil(length / CHARS_PER_BODY_HIT))
}

/**
 * Pick the product pointer by what the post is actually about.
 *
 * A rule has to earn its place from the headline or from sustained body
 * coverage. The writer's usual beat only breaks ties between rules that
 * already qualified — otherwise every Damodaran post would route to IPO
 * simply because that is one of the things he writes about.
 */
export function matchTopic(title: string, body: string, beats: string[] = []): TopicRule {
  const count = (haystack: string, rule: TopicRule) =>
    (haystack.match(new RegExp(rule.keywords.source, 'gi')) ?? []).length

  const beatText = beats.join(' ')
  let best: { rule: TopicRule; score: number } | null = null

  for (const rule of TOPIC_RULES) {
    const titleHits = count(title, rule)
    const bodyHits = count(body, rule)
    if (titleHits === 0 && !hasBodyEvidence(bodyHits, body.length)) continue

    const score = titleHits * TITLE_WEIGHT + bodyHits + count(beatText, rule) * BEAT_WEIGHT
    if (!best || score > best.score) best = { rule, score }
  }
  return best?.rule ?? FALLBACK_RULE
}

/* ---------------------------------------------------------------- */
/* 4. Compose the three channel drafts                               */
/* ---------------------------------------------------------------- */

export interface ComposedDraft {
  name: string
  topic: string
  promoId: string
  linkedin: LinkedInContent
  email: EmailContent
  article: ArticleContent
  sources: CampaignSource[]
}

const FROM = 'Munshot Intelligence <intel@munshot.io>'

function firstName(full: string): string {
  return full.split(' ')[0]
}

function quoted(s: string): string {
  return `“${s.replace(/^[“"']|[”"']$/g, '').trim()}”`
}

function trimTrailingStop(s: string): string {
  return s.replace(/\s*[.,;:]\s*$/, '')
}

/** One line naming what Munshot would do with the claim. */
function munshotAngle(rule: TopicRule, figures: string[]): string {
  const evidence = figures.length
    ? ` The ${figures.length === 1 ? 'number' : 'numbers'} to hold it to: ${figures.join(', ')}.`
    : ''
  switch (rule.promoId) {
    case 'promo-drhp':
      return `Our read: the claim is testable against the filings themselves — issue sizing, use-of-proceeds and how both move between the draft DRHP and the final RHP.${evidence}`
    case 'promo-diligence':
      return `Our read: this is a disclosure question before it is a valuation question. The support for it sits in the filings — footnotes, related-party lines and cash-flow quality.${evidence}`
    case 'promo-channel':
      return `Our read: demand claims resolve at the channel before they resolve in the print. Distributor and inventory signals are where you check this early.${evidence}`
    default:
      return `Our read: the argument lives or dies on the margin line, not the top line — which is exactly where it is checkable across the tape.${evidence}`
  }
}

function promoLine(rule: TopicRule): string {
  switch (rule.promoId) {
    case 'promo-drhp':
      return 'DRHP Dash surfaces those filings and their amendments as they land.'
    case 'promo-diligence':
      return 'Diligence OS turns a single filing into that structured check in minutes.'
    case 'promo-channel':
      return 'Channel Probe reads the distributor signal weeks ahead of reported numbers.'
    default:
      return 'Sector Pulse tracks those margin shifts across the tape as they move.'
  }
}

function ctaFor(rule: TopicRule): { label: string; title: string; body: string } {
  switch (rule.promoId) {
    case 'promo-drhp':
      return {
        label: 'Open DRHP Dash',
        title: 'Test it against the filings',
        body: 'DRHP Dash diffs successive filings automatically and surfaces amendments as they land — so the edit reaches you before the listing does.',
      }
    case 'promo-diligence':
      return {
        label: 'See Diligence OS',
        title: 'Take it to the documents',
        body: 'Diligence OS turns a single filing upload into a structured workspace — the diff, the raise mix and the use-of-proceeds check, side by side.',
      }
    case 'promo-channel':
      return {
        label: 'Open Channel Probe',
        title: 'Check it at the channel',
        body: 'Channel Probe reads distributor and channel signals weeks ahead of the reported numbers, so demand claims resolve early.',
      }
    default:
      return {
        label: 'Explore Sector Pulse',
        title: 'Watch it on the tape',
        body: 'Sector Pulse maps margin and multiple shifts across the sector as they happen, so the move is visible before the quarter closes.',
      }
  }
}

/**
 * Compose a full campaign from real harvested posts. The first post leads;
 * any others are carried as corroborating reading.
 */
export function composeFromPosts(posts: HarvestedPost[]): ComposedDraft {
  const [lead, ...rest] = posts
  const voice = voiceById(lead.voiceId)
  const body = lead.markdown ?? lead.excerpt ?? ''

  const rule = matchTopic(lead.title, body, voice?.beats)
  const quotes = pullQuotes(body, lead.title)
  // Deep read may be unavailable — the published excerpt is still the
  // author's own words, so it is a legitimate fallback quote.
  const quotes0 = quotes[0] ?? lead.excerpt
  const quotes1 = quotes[1]
  // Only numbers that appear in the lines we quote, so the evidence and the
  // claim it supports are always the same passage.
  const figures = extractFigures([quotes0, quotes1].filter(Boolean))
  const paragraphs = toParagraphs(body)
  const readMinutes = Math.max(3, Math.min(9, Math.round(body.split(/\s+/).length / 240) || 4))

  const sources: CampaignSource[] = posts.map((p) => ({
    author: p.author,
    authorRole: p.authorRole,
    outlet: p.outlet,
    title: p.title,
    url: p.url,
    publishedAt: p.publishedAt,
  }))

  const attribution = `Source: ${lead.author}, ${quoted(lead.title)} — ${lead.outlet}. ${lead.url}`
  const angle = munshotAngle(rule, figures)
  const cta = ctaFor(rule)
  const who = `${lead.author}${voice ? ` (${voice.role})` : ''}`

  /* ---- LinkedIn ---- */
  const linkedin: LinkedInContent = {
    authorName: 'Munshot',
    authorHandle: 'Intelligence for institutional investors',
    authorAvatar: 'M',
    reactions: 0,
    comments: 0,
    reposts: 0,
    headline: lead.title,
    body: [
      `${who} published something worth stopping on this week.`,
      quotes0 ? `In their words: ${quoted(quotes0)}` : '',
      angle,
      promoLine(rule),
      attribution,
    ]
      .filter(Boolean)
      .join('\n\n'),
  }

  /* ---- Email ---- */
  const email: EmailContent = {
    subject: lead.title,
    from: FROM,
    preheader: `What ${lead.author} argued this week — and how to test it.`,
    idea: quotes0
      ? `${lead.author} (${lead.outlet}): ${quoted(quotes0)}`
      : `${lead.author} published ${quoted(lead.title)} in ${lead.outlet} this week.`,
    story:
      quotes1 ??
      paragraphs[0] ??
      lead.excerpt ??
      `Read the full argument in ${lead.outlet}: ${lead.url}`,
    takeaway: angle,
    ctaLabel: cta.label,
  }

  /* ---- Article ---- */
  const sections: ArticleSection[] = [
    {
      body: `${who} published ${quoted(lead.title)} in ${lead.outlet}${
        lead.publishedAt ? ` on ${lead.publishedAt}` : ''
      }. It is worth reading in full; what follows is the part that changes how we would screen, and where we would go to check it.`,
    },
  ]

  if (quotes0) {
    sections.push({
      heading: `What ${firstName(lead.author)} argued`,
      body: quotes1 ? `${quoted(quotes0)}\n\n${quoted(quotes1)}` : quoted(quotes0),
    })
  }

  if (figures.length) {
    const one = figures.length === 1
    sections.push({
      heading: one ? 'The number in the piece' : 'The numbers in the piece',
      body: one
        ? `The argument leans on one figure: ${figures[0]}. Carry it into your own screen — if it moves, the conclusion moves with it.`
        : `The argument leans on ${figures.join(', ')}. Carry those into your own screen — if they move, the conclusion moves with them.`,
    })
  }

  sections.push({ heading: 'How we would test it', body: angle })

  if (rest.length) {
    sections.push({
      heading: 'Read alongside',
      body: rest
        .map((p) => `${p.author}, ${quoted(trimTrailingStop(p.title))} (${p.outlet}) — ${p.url}`)
        .join('\n'),
    })
  }

  const article: ArticleContent = {
    title: lead.title,
    deck: lead.excerpt || `${lead.author} in ${lead.outlet}, read against the filings.`,
    hero: rule.hero,
    readMinutes,
    sections,
    ctaTitle: cta.title,
    ctaBody: cta.body,
    ctaLabel: cta.label,
  }

  return {
    name: lead.title,
    topic: rule.topic,
    promoId: rule.promoId,
    linkedin,
    email,
    article,
    sources,
  }
}
