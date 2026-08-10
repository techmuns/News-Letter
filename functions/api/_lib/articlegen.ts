/* Long-form article generator.

   Expands a recorded generation (its LinkedIn post + email summary) into a
   full, structured long-form article for the Munshot research desk. Grounded
   in the brief it's given — it adds structure/analysis, never new facts. */
import type { Env } from './env'
import { ApiError } from './http'
import { callClaudeJson, aiConfigured } from './llm'

export interface ArticleGenInput {
  title?: string
  topic?: string
  /** the short LinkedIn post body */
  linkedin?: string
  email?: { subject?: string; idea?: string; story?: string; takeaway?: string }
  tone?: string
}

export interface GeneratedArticle {
  title: string
  deck: string
  hero: string
  readMinutes: number
  sections: { heading: string; body: string }[]
  ctaTitle: string
  ctaBody: string
  ctaLabel: string
}

const SYSTEM = `You are the content engine for Munshot — a market-intelligence platform. Expand the provided brief (a short LinkedIn post plus an email summary about the SAME story) into a credible, well-structured LONG-FORM article for Munshot's research desk.

Rules:
- 550-850 words across 4 to 6 sections. Each section has a short, specific heading and 1-3 tight paragraphs.
- Open with a lede that frames why this matters now; close with a forward-looking "what to watch".
- Expand with analysis, structure, and context — do NOT introduce new facts, figures, names, or quotes beyond what the brief supports. Never invent numbers.
- Every section must earn its place with a specific, non-obvious point (a mechanism, a tension, a second-order effect). The piece as a whole must leave the reader with a clear, actionable takeaway — not a bland recap.
- Neutral, sharp, decision-useful — this publishes under the Munshot brand.
- Also return a title, a one-line deck (standfirst), and a short CTA (title, body, label) pointing to Munshot.`

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    title: { type: 'string' },
    deck: { type: 'string' },
    sections: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: { heading: { type: 'string' }, body: { type: 'string' } },
        required: ['heading', 'body'],
      },
    },
    ctaTitle: { type: 'string' },
    ctaBody: { type: 'string' },
    ctaLabel: { type: 'string' },
  },
  required: ['title', 'deck', 'sections', 'ctaTitle', 'ctaBody', 'ctaLabel'],
}

export async function generateArticle(env: Env, input: ArticleGenInput): Promise<GeneratedArticle> {
  if (!aiConfigured(env)) {
    throw new ApiError('No AI provider configured — set BEDROCK_API_KEY (see SETUP.md).', 400)
  }
  const post = (input.linkedin || '').trim()
  const e = input.email || {}
  const emailLines = [
    e.subject ? `Subject: ${e.subject}` : '',
    e.idea ? `Idea: ${e.idea}` : '',
    e.story ? `Story: ${e.story}` : '',
    e.takeaway ? `Takeaway: ${e.takeaway}` : '',
  ].filter(Boolean)
  if (!post && emailLines.length === 0) {
    throw new ApiError('Nothing to expand — this entry has no post or email content.', 400)
  }

  const brief = [
    `TONE: ${input.tone || 'sharp, credible, analytical'}`,
    input.topic ? `TOPIC: ${input.topic}` : '',
    input.title ? `WORKING TITLE: ${input.title}` : '',
    '',
    'LINKEDIN POST (the short version):',
    post || '(none)',
    '',
    'EMAIL SUMMARY:',
    emailLines.length ? emailLines.join('\n') : '(none)',
  ]
    .filter(Boolean)
    .join('\n')

  const a = await callClaudeJson<any>(env, { system: SYSTEM, user: brief, schema: SCHEMA })
  const sections = (Array.isArray(a?.sections) ? a.sections : [])
    .filter((s: any) => s && s.body)
    .map((s: any) => ({ heading: String(s.heading || ''), body: String(s.body || '') }))
  const words = sections.reduce(
    (n: number, s: any) => n + String(s.body || '').split(/\s+/).filter(Boolean).length,
    0,
  )
  return {
    title: String(a?.title || input.title || input.topic || 'Untitled'),
    deck: String(a?.deck || ''),
    hero: '📊',
    readMinutes: Math.max(2, Math.round(words / 200)),
    sections,
    ctaTitle: String(a?.ctaTitle || 'From Munshot Intelligence'),
    ctaBody: String(a?.ctaBody || 'Turn market moves into decision-ready insight.'),
    ctaLabel: String(a?.ctaLabel || 'Explore Munshot'),
  }
}
