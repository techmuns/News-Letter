import {
  type GenerationBrief,
  type LinkedInContent,
  type EmailContent,
  type ArticleContent,
  type ArticleSection,
  type SourceMode,
  type LengthTarget,
} from '../types'
import { GENERATABLE } from '../data/mockData'
import { type AiDraft } from './ai'
import { CONTENT_TYPE_OPTS, labelOf } from './brief'
import { type PatternId, PATTERNS, composeCta, pickDashboard } from './playbook'
import { CLOSING_ASK, CLOSING_HEAD, DEPTH_PARAS, VOICE, forReader } from './voice'

/* ============================================================
   Deterministic content generator. No model call — it composes a
   draft from the author's step-one write-up plus the playbook
   (finance_linkedin_creator_strategy_kb.md), so the three channel
   versions carry the same intelligence in each channel's shape:

   · LinkedIn — §11 skeleton: hook → signal → sourced data →
     implication → one CTA. Signal above the fold (§10).
   · Email    — §8: one idea · one story · one takeaway · one CTA.
   · Article  — §11 long-form: consensus view → the data that
     complicates it → the mechanism → what it means → how to
     monitor it.

   Where the author hasn't supplied a figure, the write-up's
   bracketed gaps are carried through untouched. §6 is explicit:
   never fabricate figures.
   ============================================================ */

export interface DraftInput {
  brief: GenerationBrief
  sourceMode: SourceMode
  /** human-readable labels of the selected inputs */
  sourceLabels: string[]
  /** the author's step-one write-up — when present it IS the source text */
  outline?: { headline: string; body: string; pattern?: string; dashboard?: string }
  /** bump to force a fresh variation (regenerate) */
  seed: number
}

export interface GeneratedDraft {
  name: string
  topic: string
  heroImage: string
  promoId: string
  linkedin: LinkedInContent
  email: EmailContent
  article: ArticleContent
}

const LENGTH_PARAS: Record<LengthTarget, number> = {
  micro: 1,
  short: 2,
  standard: 3,
  long: 4,
  deep: 5,
}

/** Extra insight lines used to pad longer length targets (kept generic-but-plausible). */
const FILLER = [
  'The second-order effect is the one that actually reprices the name.',
  'Read the disclosure delta, not just the summary — that is where the story turns.',
  'Consensus is anchored to the last cycle; the setup here is different.',
  'Position sizing follows conviction, and conviction follows the evidence.',
  'The tell is in what management chose not to restate.',
]

/** The playbook pattern this draft is shaped on (falls back to the strongest). */
function patternOf(input: DraftInput) {
  const id = input.outline?.pattern as PatternId | undefined
  return (id && PATTERNS[id]) || PATTERNS.divergence
}

/** Compose a LinkedIn post body that reflects the brief + sources. */
function composeBody(input: DraftInput, baseBody: string): string {
  const { brief, sourceMode, sourceLabels, seed } = input
  const paras: string[] = []
  const authored = !!input.outline
  const baseParas = baseBody.split('\n\n').filter(Boolean)

  if (authored) {
    // The author's write-up is kept whole. Padding it with generic filler or
    // trimming it to hit a length target would throw away the one part of the
    // draft that came from a person, so length only shapes template copy.
    paras.push(...baseParas)
  } else {
    const voice = VOICE[brief.tone]

    // 1) tone-flavoured hook
    paras.push(voice.opener)

    // 2) base paragraphs — the length target sets the count, depth moves it
    const want = Math.max(1, LENGTH_PARAS[brief.length] + DEPTH_PARAS[brief.depth])
    paras.push(voice.handoff)
    for (let i = 0; i < want; i++) {
      if (i < baseParas.length) paras.push(baseParas[i])
      else paras.push(FILLER[(seed + i) % FILLER.length])
    }

    // 3) the objective's closing move, asked of whoever this is written for
    paras.push(forReader(CLOSING_ASK[brief.objective], brief.audience))

    // 4) §3 value flow — the pointer closes the post, once, and only when the
    // insight ratio leaves room for it.
    const cta = composeCta(paras.join('\n'), brief)
    if (cta && !paras.some((p) => p.includes(cta))) paras.push(cta)
  }

  // The brief shapes the copy; it is never restated inside it. "Written for
  // buy-side analysts, analytical in tone" is a settings readout, not a post.

  // 4) provenance line — where this came from
  if (sourceMode === 'auto' && sourceLabels.length) {
    const shown = sourceLabels.slice(0, 3).join(', ')
    const more = sourceLabels.length > 3 ? ` +${sourceLabels.length - 3} more` : ''
    paras.push(`↳ Synthesised from ${sourceLabels.length} monitored source${sourceLabels.length > 1 ? 's' : ''}: ${shown}${more}.`)
  }

  return paras.join('\n\n')
}

/** Compose a headline that nods to the content type. */
function composeTitle(input: DraftInput, baseHeadline: string): string {
  // An authored headline is used verbatim — it's what they chose to call it.
  if (input.outline) return baseHeadline
  const type = labelOf(CONTENT_TYPE_OPTS, input.brief.contentType)
  // Rotate a light prefix by seed so regeneration visibly changes the title.
  const prefixes = ['', `${type}: `, 'Signal — ', 'What the data says: ']
  return `${prefixes[input.seed % prefixes.length]}${baseHeadline}`
}

/**
 * §8 — the newsletter, from the same material: one idea, one story, one
 * takeaway, one CTA. The write-up's paragraphs map onto those four slots in
 * order, because that is the order the pattern skeleton already put them in.
 */
function composeEmail(input: DraftInput, tplEmail: EmailContent, headline: string, body: string): EmailContent {
  if (!input.outline) return tplEmail
  const paras = body.split('\n\n').filter(Boolean)
  const dash = input.outline.dashboard ?? pickDashboard(body, input.brief).name
  const cta = composeCta(body, input.brief)
  // The CTA is already the last paragraph of the post — it isn't body copy here.
  const content = cta ? paras.filter((p) => p !== cta) : paras
  const [idea, ...rest] = content
  // The takeaway is the pattern's closing step, so it's the last paragraph —
  // but only when there is more than one left, or the story would be empty.
  const takeaway = rest.length > 1 ? rest[rest.length - 1] : ''
  const story = (takeaway ? rest.slice(0, -1) : rest).join('\n\n')

  return {
    ...tplEmail,
    subject: headline,
    // §8's preheader is the idea in one line — the hook already is one.
    preheader: idea ? idea.replace(/\s+/g, ' ').slice(0, 120) : tplEmail.preheader,
    idea: idea ?? tplEmail.idea,
    story: story || tplEmail.story,
    takeaway: takeaway || '[What the reader should watch or do next — one concrete line.]',
    ctaLabel: cta ? `Open ${dash}` : tplEmail.ctaLabel,
  }
}

/**
 * §11 — the long-form article: the commonly-held view, the data that
 * complicates it, the mechanism, what it means, how to monitor it. Each of the
 * pattern's steps becomes a section, keeping the write-up's own paragraphs as
 * the body under the heading the playbook gives them.
 */
function composeArticle(input: DraftInput, tplArticle: ArticleContent, headline: string, body: string): ArticleContent {
  if (!input.outline) return tplArticle
  const pattern = patternOf(input)
  const dash = input.outline.dashboard ?? pickDashboard(body, input.brief).name
  const cta = composeCta(body, input.brief)
  const paras = body.split('\n\n').filter(Boolean)
  const content = cta ? paras.filter((p) => p !== cta) : paras

  // First paragraph is the hook — it becomes the standfirst, not a section.
  const [lead, ...restParas] = content
  const sections: ArticleSection[] = []

  // Each paragraph gets the heading of the step it came from. A gap paragraph
  // names its own step (the bracket text is unique to it); everything else is
  // the author's material, which belongs under the step that consumes it.
  // Slicing paragraphs evenly across the steps instead would file the evidence
  // under whichever heading the arithmetic landed on.
  //
  // Gaps and headings are matched after the reader's stake is resolved into
  // them, because that is the form the write-up carries.
  const reader = (text: string) => forReader(text, input.brief.audience)
  const materialHead = reader(
    pattern.steps.find((s) => s.fillsFromMaterial)?.heading ?? pattern.steps[0].heading,
  )
  const handoff = VOICE[input.brief.tone].handoff
  const closing = reader(CLOSING_ASK[input.brief.objective])
  for (const para of restParas) {
    // The handoff is the tone's way into the evidence, not a section of its own.
    if (para.trim() === handoff) continue
    const step = pattern.steps.find((s) => s.gap && reader(s.gap) === para.trim())
    // The objective's close is its own section — filing it under the material's
    // heading would repeat a heading the article has already used.
    const heading = para.trim() === closing
      ? CLOSING_HEAD[input.brief.objective]
      : step
        ? reader(step.heading)
        : materialHead
    const last = sections[sections.length - 1]
    if (last && last.heading === heading) last.body = `${last.body}\n\n${para}`
    else sections.push({ heading, body: para })
  }
  if (!sections.length && lead) sections.push({ body: lead })
  // §11 closes on how to monitor it — that is what the dashboard is for.
  if (cta) sections.push({ heading: 'How to monitor it', body: cta })

  return {
    ...tplArticle,
    title: headline,
    deck: lead ?? tplArticle.deck,
    sections,
    ctaTitle: `Follow this in ${dash}`,
    ctaBody: cta ?? tplArticle.ctaBody,
    ctaLabel: `Open ${dash}`,
  }
}

/**
 * Produce a full multi-channel draft. LinkedIn is fully composed from the
 * brief (the primary editable draft); Email and Article are recomposed from
 * the same write-up into their own playbook structure, so the three channel
 * previews carry one argument in three shapes.
 */
export function composeDraft(input: DraftInput): GeneratedDraft {
  const tpl = GENERATABLE[input.seed % GENERATABLE.length]
  // The author's own write-up outranks the template: they wrote it after
  // reading their material, so it's the truer starting text.
  const baseHeadline = input.outline?.headline?.trim() || tpl.linkedin.headline
  const baseBody = input.outline?.body?.trim() || tpl.linkedin.body
  const title = composeTitle(input, baseHeadline)
  const body = composeBody(input, baseBody)

  const sourceNote =
    input.sourceMode === 'auto' && input.sourceLabels.length
      ? `Generated from ${input.sourceLabels.length} monitored source${input.sourceLabels.length > 1 ? 's' : ''}.`
      : undefined

  const email = composeEmail(input, tpl.email, baseHeadline, body)
  const article = composeArticle(input, tpl.article, baseHeadline, body)
  // The promoted product follows the subject too, so it can't contradict the CTA.
  const dash = input.outline ? pickDashboard(body, input.brief) : null

  return {
    name: input.outline ? baseHeadline : tpl.name,
    // The topic is the subject area the material sits in, not the pattern name —
    // "Insurance / Sector" is what a campaign list needs to read.
    topic: dash ? dash.topic : tpl.topic,
    heroImage: tpl.heroImage,
    promoId: dash ? dash.promoId : tpl.promoId,
    linkedin: { ...tpl.linkedin, headline: title, body },
    email: {
      ...email,
      preheader: sourceNote ? `${sourceNote} ${email.preheader}` : email.preheader,
    },
    article: {
      ...article,
      deck: sourceNote ? `${article.deck} ${sourceNote}` : article.deck,
    },
  }
}

/* ============================================================
   The model-written draft.

   Same output shape as composeDraft above, so everything
   downstream — the three previews, the editor, scheduling —
   cannot tell which one produced a campaign. What differs is
   where the words came from: here they were written from the
   uploaded document by a vision model that read it, and they
   arrive already stripped of any brief metadata (src/lib/
   sanitize.ts).

   Only the channel chrome is borrowed from a template: the
   author avatar, the reaction counts, the hero label. Those are
   presentation for the mock previews, not content.
   ============================================================ */

/** Roughly how long the article reads — used when the model doesn't say. */
function readingMinutes(text: string): number {
  const words = text.trim() ? text.trim().split(/\s+/).length : 0
  return Math.max(1, Math.round(words / 220))
}

export function composeAiDraft(input: DraftInput, ai: AiDraft): GeneratedDraft {
  const tpl = GENERATABLE[input.seed % GENERATABLE.length]
  const headline = ai.linkedin.headline || ai.article.title || tpl.linkedin.headline
  const body = ai.linkedin.body

  // The pointer is picked from what the piece is actually about, exactly as on
  // the deterministic path — so the promoted product can't contradict the copy.
  const dash = pickDashboard([ai.topic, headline, body].join('\n'), input.brief)

  const sourceNote =
    input.sourceMode === 'auto' && input.sourceLabels.length
      ? `Generated from ${input.sourceLabels.length} monitored source${input.sourceLabels.length > 1 ? 's' : ''}.`
      : undefined

  // An article with no sections is still an article — its paragraphs become the
  // body rather than the piece arriving empty.
  const sections: ArticleSection[] = ai.article.sections.length
    ? ai.article.sections.map((s) => ({ ...(s.heading ? { heading: s.heading } : {}), body: s.body }))
    : body
        .split('\n\n')
        .filter(Boolean)
        .map((p) => ({ body: p }))

  const deck = ai.article.deck || body.split('\n\n')[0] || tpl.article.deck
  const cta = composeCta([ai.topic, headline, body].join('\n'), input.brief)

  return {
    name: headline,
    topic: ai.topic || dash.topic,
    heroImage: tpl.heroImage,
    promoId: dash.promoId,
    linkedin: { ...tpl.linkedin, headline, body },
    email: {
      ...tpl.email,
      subject: ai.email.subject || headline,
      preheader: sourceNote
        ? `${sourceNote} ${ai.email.preheader}`.trim()
        : ai.email.preheader || tpl.email.preheader,
      idea: ai.email.idea || body.split('\n\n')[0] || tpl.email.idea,
      story: ai.email.story || tpl.email.story,
      takeaway: ai.email.takeaway || tpl.email.takeaway,
      ctaLabel: ai.email.ctaLabel || `Open ${dash.name}`,
    },
    article: {
      ...tpl.article,
      title: ai.article.title || headline,
      deck: sourceNote ? `${deck} ${sourceNote}` : deck,
      readMinutes: ai.article.readMinutes || readingMinutes(sections.map((s) => s.body).join(' ')),
      sections,
      ctaTitle: `Follow this in ${dash.name}`,
      ctaBody: cta ?? tpl.article.ctaBody,
      ctaLabel: `Open ${dash.name}`,
    },
  }
}
