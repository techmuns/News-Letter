/* Daily Pulse "Topic" mode generator.

   Flow: fetch real recent news for a keyword (NewsAPI.org) → hand ONLY
   those sourced facts to Claude (Bedrock, via callClaudeJson) → the same house
   format as the market post (hook → emoji bullets → hashtags) + email. If no
   solid sources are found, the caller gets a friendly "no recent news" error and
   nothing is generated — we never fabricate claims about real people/companies. */
import type { Env } from './env'
import { ApiError } from './http'
import { callClaudeJson, aiConfigured } from './llm'
import { fetchTopicNews, newsConfigured, type NewsItem } from './news'
import { type PulsePost, normalizeKeyPoints, normalizeSpotlight } from './pulsegen'

export interface TopicGenInput {
  topic: string
  tone?: string
}

const SYSTEM = `You are the content engine for Munshot — a market-intelligence platform. Write a LinkedIn post and a matching email newsletter about the TOPIC below, using ONLY the sourced news items provided.

Mirror the house format:
- hook: one short scroll-stopping line. It may start with ONE fitting emoji. Under ~70 characters.
- bullets: 4 to 6 short lines. EACH must START with a single relevant emoji, then one concrete, specific fact drawn from the sources (a number, a decision, an event, a named quote). One sentence each, no trailing hashtags, no leading "•" (the app adds it).
- hashtags: 3 to 5 single #Tags relevant to the topic.

Email newsletter section (a rich, multi-part digest — like a professional research briefing):
- subject: a credible, non-clickbait subject.
- preheader: one line, ~90 characters.
- idea: the core story in 1-2 sentences (the welcome/intro read).
- story: the Top Story narrative — why it matters, grounded in the sourced facts (2-3 sentences).
- keyPoints: 3 to 4 key findings for the Top Story. Each is an object { lead, detail }: "lead" is a 2-4 word bold label; "detail" is ONE sentence carrying a HARD, specific fact from the sources (a number, %, date, or named figure). No vague leads, no filler.
- spotlight: a deeper dive on ONE important facet of the story, as an object:
    - headline: a sharp 4-9 word headline for the dive.
    - story: 2-3 sentences of analysis, grounded strictly in the sources.
    - wallStreetView: 1-2 sentences on how markets/investors/analysts read it (the financial angle), grounded in the sources.
    - pressView: 1-2 sentences on how the press/coverage frames it, grounded in the sources.
    - pressQuote: ONE short verbatim quote that actually appears in the provided sources, copied EXACTLY. If no direct quote is present in the sources, use an empty string "" — never invent, paraphrase, or attribute a quote that is not in the sources.
- takeaway: the one thing to remember.
- ctaLabel: a short button label pointing to Munshot.

Hard rules — this is about REAL people and companies, so accuracy is non-negotiable:
- Ground EVERY claim strictly in the provided sources. Do NOT add any fact, figure, quote, motive, or characterization that the sources do not state.
- If the sources are thin, write a shorter post — never pad with invented detail, speculation, or background "context" from your own knowledge.
- Never speculate about anyone's finances, intentions, or what happens next beyond what a source explicitly says.
- Do NOT fabricate or guess URLs. The app attaches the real source links separately, so you don't need to include links.
- Attribution like "per <source>" is welcome where it reads naturally.
- Make it worth reading: within what the sources support, leave the reader with at least ONE concrete, non-obvious takeaway — a specific figure, a second-order implication, or a "what most people miss" angle. No platitudes, no filler.
- Be granular and specific: cite the actual figures/decisions from the sources and connect them into a nuanced read (a tension, a consequence, why it matters beyond the headline) — never a bland recap. One sharp point fully made beats three shallow ones.
Keep it sharp, credible, and neutral — this publishes under the Munshot brand.`

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    focus: { type: 'string' },
    linkedin: {
      type: 'object',
      additionalProperties: false,
      properties: {
        hook: { type: 'string' },
        bullets: { type: 'array', items: { type: 'string' } },
        hashtags: { type: 'array', items: { type: 'string' } },
      },
      required: ['hook', 'bullets', 'hashtags'],
    },
    email: {
      type: 'object',
      additionalProperties: false,
      properties: {
        subject: { type: 'string' },
        preheader: { type: 'string' },
        idea: { type: 'string' },
        story: { type: 'string' },
        keyPoints: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            properties: { lead: { type: 'string' }, detail: { type: 'string' } },
            required: ['lead', 'detail'],
          },
        },
        spotlight: {
          type: 'object',
          additionalProperties: false,
          properties: {
            headline: { type: 'string' },
            story: { type: 'string' },
            wallStreetView: { type: 'string' },
            pressView: { type: 'string' },
            pressQuote: { type: 'string' },
          },
          required: ['headline', 'story', 'wallStreetView', 'pressView', 'pressQuote'],
        },
        takeaway: { type: 'string' },
        ctaLabel: { type: 'string' },
      },
      required: [
        'subject',
        'preheader',
        'idea',
        'story',
        'keyPoints',
        'spotlight',
        'takeaway',
        'ctaLabel',
      ],
    },
  },
  required: ['focus', 'linkedin', 'email'],
}

function buildDigest(topic: string, tone: string, items: NewsItem[]): string {
  const sources = items
    .map((n, i) => {
      const meta = [n.source, n.date].filter(Boolean).join(' · ')
      return `[${i + 1}] ${n.title}\n    (${meta})\n    ${n.snippet}`
    })
    .join('\n\n')
  return [
    `TONE: ${tone || 'sharp, credible, neutral'}`,
    `TOPIC: ${topic}`,
    '',
    'SOURCED NEWS — ground everything strictly in these items, and use nothing else:',
    sources,
  ].join('\n')
}

export async function generateTopicPost(
  env: Env,
  input: TopicGenInput,
): Promise<{ post: PulsePost; sources: NewsItem[]; topic: string }> {
  if (!aiConfigured(env)) {
    throw new ApiError('No AI provider configured — set BEDROCK_API_KEY (see SETUP.md).', 400)
  }
  const topic = (input.topic || '').trim()
  if (!topic) throw new ApiError('Enter a topic or keyword.', 400)
  if (!newsConfigured(env)) {
    throw new ApiError("Topic news isn't configured — set NEWSAPI_KEY (see SETUP.md).", 400)
  }

  const sources = await fetchTopicNews(env, topic)
  if (sources.length === 0) {
    throw new ApiError(`No recent news found for "${topic}" — try another keyword.`, 404)
  }

  const post = await callClaudeJson<PulsePost>(env, {
    system: SYSTEM,
    user: buildDigest(topic, input.tone || '', sources),
    schema: SCHEMA,
  })
  // Defensive defaults so the UI never crashes on a missing field.
  post.linkedin = post.linkedin || ({} as any)
  post.email = post.email || ({} as any)
  post.linkedin.bullets = Array.isArray(post.linkedin.bullets) ? post.linkedin.bullets : []
  post.linkedin.hashtags = Array.isArray(post.linkedin.hashtags) ? post.linkedin.hashtags : []
  post.email.keyPoints = normalizeKeyPoints(post.email.keyPoints)
  post.email.spotlight = normalizeSpotlight(post.email.spotlight)
  if (!post.focus) post.focus = topic
  return { post, sources, topic }
}
