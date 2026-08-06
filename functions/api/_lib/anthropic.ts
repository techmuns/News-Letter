/* AI generation via the Anthropic Claude API (raw HTTPS — no SDK, edge-friendly).
   Turns a source (a standout finance post + an optional Munshot dashboard data
   point) into a short, high-engagement LinkedIn post and a matching email. */
import type { Env } from './env'
import { ApiError } from './http'
import { callClaudeJson, aiConfigured } from './llm'

export interface GenerateInput {
  sourceText: string
  dashboardSnippet?: string
  tone?: string
}

export interface GeneratedContent {
  topic: string
  linkedin: { headline: string; body: string; hashtags: string[] }
  email: {
    subject: string
    preheader: string
    idea: string
    story: string
    takeaway: string
    ctaLabel: string
  }
}

const SYSTEM = `You are the content engine for Munshot — a market-intelligence platform whose dashboards turn financial data into clear, decision-ready insight for fund managers and serious investors.

Your job: take a raw source (a standout finance post from a top LinkedIn voice, plus an optional data point pulled from a Munshot dashboard) and produce (1) a SHORT, high-engagement LinkedIn post and (2) a matching email-newsletter section. This is a distinct Munshot take that adds a data-backed angle — never a copy of the source.

Rules:
- LinkedIn: open with a scroll-stopping hook line, then 3-6 short punchy lines separated by line breaks (not paragraphs). Concrete, specific, useful. Written to earn comments and reposts. Roughly 500-900 characters in the body. No emojis unless one genuinely adds signal. Do NOT put hashtags in the body — return them separately, 3 sharp ones max.
- headline: a punchy 3-8 word phrase for the branded graphic card.
- Email: a compelling, non-clickbait subject; a one-line preheader; then three short sections — idea (the core insight), story (why it matters now, grounded in the data point if one is given), takeaway (the one thing to do or remember). Plus a short CTA label pointing to Munshot.
- Ground every claim in the provided source/data. Never invent specific numbers that were not given. If a data point is provided, feature it prominently.
- Match the requested tone. Keep it credible and sharp — this publishes under the Munshot brand.`

// JSON Schema for structured output. Note: structured outputs disallow
// length/number constraints, so we keep it to types + required + no extra props.
const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    topic: { type: 'string' },
    linkedin: {
      type: 'object',
      additionalProperties: false,
      properties: {
        headline: { type: 'string' },
        body: { type: 'string' },
        hashtags: { type: 'array', items: { type: 'string' } },
      },
      required: ['headline', 'body', 'hashtags'],
    },
    email: {
      type: 'object',
      additionalProperties: false,
      properties: {
        subject: { type: 'string' },
        preheader: { type: 'string' },
        idea: { type: 'string' },
        story: { type: 'string' },
        takeaway: { type: 'string' },
        ctaLabel: { type: 'string' },
      },
      required: ['subject', 'preheader', 'idea', 'story', 'takeaway', 'ctaLabel'],
    },
  },
  required: ['topic', 'linkedin', 'email'],
}

export async function generateContent(env: Env, input: GenerateInput): Promise<GeneratedContent> {
  if (!aiConfigured(env)) {
    throw new ApiError('No AI provider configured — set BEDROCK_API_KEY (see SETUP.md).', 400)
  }

  const userMessage = [
    `TONE: ${input.tone || 'sharp, credible, insightful'}`,
    '',
    'SOURCE (the standout finance post / notes to riff on):',
    input.sourceText.trim(),
    input.dashboardSnippet && input.dashboardSnippet.trim()
      ? `\nMUNSHOT DASHBOARD DATA POINT (feature this):\n${input.dashboardSnippet.trim()}`
      : '\n(No specific dashboard data point provided — keep claims qualitative and do not invent numbers.)',
  ].join('\n')

  const parsed = await callClaudeJson<GeneratedContent>(env, {
    system: SYSTEM,
    user: userMessage,
    schema: SCHEMA,
  })
  // Defensive defaults so the UI never crashes on a missing field.
  parsed.linkedin = parsed.linkedin || ({} as any)
  parsed.email = parsed.email || ({} as any)
  parsed.linkedin.hashtags = Array.isArray(parsed.linkedin.hashtags) ? parsed.linkedin.hashtags : []
  return parsed
}
