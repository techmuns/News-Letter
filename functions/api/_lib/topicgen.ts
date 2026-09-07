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

export interface MarketQuote {
  name: string
  value: number
  changePct: number
}

export interface TopicGenInput {
  topic: string
  tone?: string
  /** today's live index/price numbers from the feed — authoritative */
  market?: MarketQuote[]
}

const SYSTEM = `You are the content engine for Munshot — a market-intelligence platform. Write a LinkedIn post and a matching email newsletter about the TOPIC below, using ONLY the sourced news items provided.

Mirror the house format:
- hook: one short scroll-stopping line. It may start with ONE fitting emoji. Under ~70 characters.
  The hook must carry a TENSION, not a summary. Lead with the thing that is surprising, contradictory, or asymmetric in the sources — two facts that shouldn't both be true, a consequence readers won't expect, or who is affected differently and why.
  NEVER open with a neutral recap of what happened. Banned hook shapes: "X slides/rises/falls for Nth session", "X and Y extend losses", "Here's what moved", "Market update", "What you need to know". If the only honest hook is a recap, find the tension inside the detail instead.
- bullets: 4 to 6 short lines. EACH must START with a single relevant emoji, then one concrete, specific fact drawn from the sources (a number, a decision, an event, a named quote). One sentence each, no trailing hashtags, no leading "•" (the app adds it).
  Order them by what MATTERS, not by what the sources led with. Prefer a fact that reframes the story over a fact that merely repeats the headline.
  HARD RULE on small moves. Compute the percentage before you write the bullet. NEVER report a currency move below 0.3%, or an index/stock move below 0.5%, as a bullet of its own. A 2-paise move on a 95-rupee exchange rate is 0.02% — that is noise, not news, and reporting it to the paisa reads as machine-generated. Two exceptions, both requiring support in the sources: (a) the sources explicitly say that specific small move is itself the story, or (b) the move's SMALLNESS is the point and you say so in those words — e.g. "the rupee barely moved even as crude climbed, suggesting the RBI is leaning on it". Never state a small move as a bare event ("the rupee fell 2 paise"); if it does not clear the bar and neither exception applies, drop it and use the slot for something that changes a reader's decision.
  Never let a bullet undercut the hook. If the hook argues a cause (e.g. oil is driving the selloff), do not then present evidence that its transmission channel was flat without explaining the contradiction.
- close: ONE final line that leaves the reader something to answer, not a summary. A genuine open question raised by the sources, or the tension left unresolved. No emoji, no hashtags, never a platitude, and never a restatement of the hook. Keep it under ~120 characters.
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
MARKET DATA — AUTHORITATIVE, and it overrides the news for numbers.
- When a "TODAY'S MARKET DATA (live)" block is provided in the user's message, those are the real, live index/price figures for TODAY'S session.
- Use ONLY those figures for any index level, %, or points you state (Nifty, Sensex, and any others listed). Compute a points move from the level and %.
- The sourced news is for the STORY and the DRIVERS (what moved markets and why) — NOT for the numbers. The news may describe OLDER sessions with different values; NEVER quote an index level, %, or point-move from the news. If the news and the market data disagree on a number, the market data wins, silently.
- Write ONE coherent post about TODAY'S session only. Do NOT stitch several different dates together, and do NOT mention specific past dates like "on 1 September" / "on 3 September" — frame everything as today.
- Direction must match the data: if the market data shows indices DOWN today, the hook and bullets describe a down day (and vice-versa) — never call a down day a "rebound".

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
        close: { type: 'string' },
        hashtags: { type: 'array', items: { type: 'string' } },
      },
      required: ['hook', 'bullets', 'close', 'hashtags'],
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

export function buildMarketBlock(market?: MarketQuote[]): string {
  if (!market || market.length === 0) return ''
  const lines = market.map((m) => {
    const dir = m.changePct < 0 ? 'DOWN' : m.changePct > 0 ? 'UP' : 'flat'
    const pts = Math.abs(m.value - m.value / (1 + m.changePct / 100))
    return `- ${m.name}: ${m.value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${dir} ${Math.abs(m.changePct).toFixed(2)}%, ≈${pts.toLocaleString('en-IN', { maximumFractionDigits: 2 })} pts)`
  })
  return [
    "TODAY'S MARKET DATA (live) — these are the authoritative numbers; use ONLY these for any index level/%/points, and write the post about TODAY:",
    ...lines,
    '',
  ].join('\n')
}

function buildDigest(topic: string, tone: string, items: NewsItem[], market?: MarketQuote[]): string {
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
    buildMarketBlock(market),
    'SOURCED NEWS — use these for the STORY and DRIVERS only (NOT for index numbers, which come from the market data above):',
    sources,
  ]
    .filter(Boolean)
    .join('\n')
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
    user: buildDigest(topic, input.tone || '', sources, input.market),
    schema: SCHEMA,
  })
  // Defensive defaults so the UI never crashes on a missing field.
  post.linkedin = post.linkedin || ({} as any)
  post.email = post.email || ({} as any)
  post.linkedin.bullets = Array.isArray(post.linkedin.bullets) ? post.linkedin.bullets : []
  post.linkedin.close = typeof post.linkedin.close === 'string' ? post.linkedin.close : ''
  post.linkedin.hashtags = Array.isArray(post.linkedin.hashtags) ? post.linkedin.hashtags : []
  post.email.keyPoints = normalizeKeyPoints(post.email.keyPoints)
  post.email.spotlight = normalizeSpotlight(post.email.spotlight)
  if (!post.focus) post.focus = topic
  return { post, sources, topic }
}
