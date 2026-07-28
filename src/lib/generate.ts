import {
  type GenerationBrief,
  type LinkedInContent,
  type EmailContent,
  type ArticleContent,
  type SourceMode,
  type Tone,
  type LengthTarget,
} from '../types'
import { GENERATABLE } from '../data/mockData'
import { CONTENT_TYPE_OPTS, labelOf } from './brief'

/* ============================================================
   Mock content generator. No model call — this deterministically
   composes a draft whose text visibly reflects the brief (tone,
   length, audience, market lens) and the selected sources, so that
   changing settings + regenerating produces a visibly different draft.
   ============================================================ */

export interface DraftInput {
  brief: GenerationBrief
  sourceMode: SourceMode
  /** human-readable labels of the selected inputs */
  sourceLabels: string[]
  /** the author's step-one write-up — when present it IS the source text */
  outline?: { headline: string; body: string }
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

const TONE_HOOK: Record<Tone, string> = {
  authoritative: 'Here is what the filings actually say.',
  analytical: 'Line the data up and a pattern shows up.',
  provocative: 'Most people are reading this exactly backwards.',
  conversational: "A quick thing that's been on my mind:",
  academic: 'Consider the mechanism underneath the headline.',
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
    // 1) tone-flavoured hook
    paras.push(TONE_HOOK[brief.tone])

    // 2) base paragraphs, count driven by the length target
    const want = LENGTH_PARAS[brief.length]
    for (let i = 0; i < want; i++) {
      if (i < baseParas.length) paras.push(baseParas[i])
      else paras.push(FILLER[(seed + i) % FILLER.length])
    }
  }

  // The brief shapes the copy; it is never restated inside it. "Written for
  // buy-side analysts, analytical in tone" is a settings readout, not a post.

  // 3) provenance line — where this came from
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
  const type = labelOf(CONTENT_TYPE_OPTS, input.brief.contentType).replace(/ \/.*$/, '')
  // Rotate a light prefix by seed so regeneration visibly changes the title.
  const prefixes = ['', `${type}: `, 'Signal — ', 'What the data says: ']
  return `${prefixes[input.seed % prefixes.length]}${baseHeadline}`
}

/**
 * Produce a full multi-channel draft. LinkedIn is fully composed from the
 * brief (the primary editable draft); Email and Article keep their richer
 * template structure but pick up the composed title + a source note so the
 * three channel previews stay coherent.
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

  return {
    name: tpl.name,
    topic: tpl.topic,
    heroImage: tpl.heroImage,
    promoId: tpl.promoId,
    linkedin: { ...tpl.linkedin, headline: title, body },
    email: {
      ...tpl.email,
      subject: input.outline ? baseHeadline : tpl.email.subject,
      preheader: sourceNote ? `${sourceNote} ${tpl.email.preheader}` : tpl.email.preheader,
    },
    article: {
      ...tpl.article,
      title: input.outline ? baseHeadline : tpl.article.title,
      deck: sourceNote ? `${tpl.article.deck} ${sourceNote}` : tpl.article.deck,
    },
  }
}
