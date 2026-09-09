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

VOICE — write as Munshot's research desk: analytical, understated, credible. First-person plural ("we"). You did the work; show the reader what you found. No hype, no motivational tone, minimal emojis (ideally none in the hook and bullets). Every claim earns its place with a number or a mechanism.

- hook: 1–2 sentences. It must do two things: (a) signal real analysis — an opener like "We read…", "We pulled … apart", "We stopped watching X and watched Y instead"; and (b) REFRAME — tell the reader the easy read is wrong, or point them at the number that actually mattered. NEVER a neutral recap. Banned shapes: "X slides/rises for Nth session", "X and Y extend losses", "market update", "what you need to know". No leading emoji. Understated beats clickbait.
- bullets: 3 to 5 analytical findings. Write each as a plain line with NO leading bullet, dash, or emoji (the app adds a "→"). Each must carry a specific, concrete number or fact AND add something the headline didn't — a mechanism ("$100 oil → bigger import bill → pressure on the rupee"), a second-order consequence, or a comparison over time ("~5× in four years"). Order by what reframes the story, not by what the sources led with.
  Make exactly ONE of the lines an HONEST CAVEAT — begin it "One caveat:" — naming a limit of the data or a reason not to over-read a single day. Intellectual honesty is the brand; never skip this line.
  HARD RULE on small moves. Compute the percentage before you write the line. NEVER report a currency move below 0.3%, or an index/stock move below 0.5%, as a line of its own, unless (a) the sources say that specific small move is the story, or (b) the move's SMALLNESS is the point and you say so ("the rupee barely moved even as crude climbed"). Never state a small move as a bare event.
  Never let a line undercut the hook without explaining the contradiction.
- close: the synthesis. Begin "The read:" and give ONE understated sentence on what it all means (a market changing hands, an input being re-priced, a structural shift) — not a question, not a platitude, not a restatement of the hook. Then, on a NEW line, exactly: Munshot — market intelligence for India.
- hashtags: 3 to 5 single #Tags relevant to the topic (e.g. #Nifty #IndianMarkets #CrudeOil).

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
