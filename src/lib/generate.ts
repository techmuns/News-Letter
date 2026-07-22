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
import {
  AUDIENCE_OPTS,
  MARKET_OPTS,
  CONTENT_TYPE_OPTS,
  labelOf,
} from './brief'

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

  // 1) tone-flavoured hook
  paras.push(TONE_HOOK[brief.tone])

  // 2) base paragraphs, count driven by the length target
  const basParas = baseBody.split('\n\n').filter(Boolean)
  const want = LENGTH_PARAS[brief.length]
  for (let i = 0; i < want; i++) {
    if (i < basParas.length) paras.push(basParas[i])
    else paras.push(FILLER[(seed + i) % FILLER.length])
  }

  // 3) audience + market-lens framing
  const audience = labelOf(AUDIENCE_OPTS, brief.audience).toLowerCase()
  const lens = labelOf(MARKET_OPTS, brief.marketLens)
  paras.push(`Written for ${audience}${brief.marketLens === 'global' ? '' : `, ${lens} lens`}.`)

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
  const title = composeTitle(input, tpl.linkedin.headline)
  const body = composeBody(input, tpl.linkedin.body)

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
      preheader: sourceNote ? `${sourceNote} ${tpl.email.preheader}` : tpl.email.preheader,
    },
    article: {
      ...tpl.article,
      deck: sourceNote ? `${tpl.article.deck} ${sourceNote}` : tpl.article.deck,
    },
  }
}
