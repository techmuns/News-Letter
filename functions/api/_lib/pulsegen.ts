/* "Daily Pulse" post generator.

   Reuses the same Anthropic Claude path as _lib/anthropic.ts, but produces the
   Daily-Pulse post format the references teach:
     • LinkedIn caption = a hook line → 4-6 emoji theme-bullets → hashtags
       (mirrors the "Stock Market Today" post — structure, not words).
     • a matching email newsletter section (idea / story / takeaway).

   Grounded entirely in OUR own market feed (/api/daily-pulse): indices, FX,
   commodities and the 13 holdings, each with 1d/5d/1m % moves. The branded
   image (Top Gainers/Losers or index board) is rendered on the client from the
   same feed — see src/lib/pulseImage.ts. */
import type { Env } from './env'
import { ApiError } from './http'
import { fetchDailyPulse, type PulseFeed, type PulseItem } from './dailypulse'

export interface PulsePost {
  /** what the post centers on — "Whole-market wrap" or a specific instrument */
  focus: string
  linkedin: {
    /** short scroll-stopping hook, may carry one leading emoji */
    hook: string
    /** 4-6 theme bullets, each STARTING with a relevant emoji (no leading "•") */
    bullets: string[]
    hashtags: string[]
  }
  email: {
    subject: string
    preheader: string
    idea: string
    story: string
    takeaway: string
    ctaLabel: string
  }
}

export interface PulseGenInput {
  /** id of the item to center the narrative on; omit/'' → whole-market wrap */
  focusId?: string
  tone?: string
}

const GROUP_LABEL: Record<PulseItem['group'], string> = {
  index: 'Indices',
  currency: 'Currencies',
  commodity: 'Commodities',
  holding: 'Holdings',
}

const pct = (n: number) => `${n > 0 ? '+' : ''}${n.toFixed(2)}%`
const val = (n: number) => n.toLocaleString('en-IN', { maximumFractionDigits: 2 })

function line(it: PulseItem): string {
  const unit = it.unit ? ` ${it.unit}` : ''
  const sector = it.sector ? ` [${it.sector}]` : ''
  return `- ${it.name}${sector} (${it.ticker}): ${val(it.current)}${unit} | 1d ${pct(it.d1)}, 5d ${pct(it.d5)}, 1m ${pct(it.m1)}`
}

/** A compact, model-friendly digest of the whole feed, plus the holdings
    gainers/losers split the branded image will show. */
function buildDigest(feed: PulseFeed): string {
  const byGroup: Record<string, PulseItem[]> = {}
  for (const it of feed.items) (byGroup[it.group] ||= []).push(it)

  const blocks: string[] = []
  for (const g of ['index', 'currency', 'commodity', 'holding'] as PulseItem['group'][]) {
    const items = byGroup[g] || []
    if (!items.length) continue
    blocks.push(`${GROUP_LABEL[g]}:\n${items.map(line).join('\n')}`)
  }

  const holdings = (byGroup['holding'] || []).slice().sort((a, b) => b.d1 - a.d1)
  const gainers = holdings.filter((h) => h.d1 > 0).slice(0, 3)
  const losers = holdings.filter((h) => h.d1 < 0).slice(-3).reverse()
  if (gainers.length || losers.length) {
    blocks.push(
      [
        'Holdings movers (for the summary card):',
        `Top gainers: ${gainers.map((h) => `${h.name} ${pct(h.d1)}`).join(', ') || '—'}`,
        `Top losers: ${losers.map((h) => `${h.name} ${pct(h.d1)}`).join(', ') || '—'}`,
      ].join('\n'),
    )
  }
  return blocks.join('\n\n')
}

const SYSTEM = `You are the content engine for Munshot — a market-intelligence platform. You write a daily "Daily Pulse" market update, published to LinkedIn (via the Munshot page) and as an email newsletter, from Munshot's OWN market feed.

You are given today's feed: Indian + global indices, FX, commodities, and Munshot's 13 tracked holdings — each with its latest level and 1-day / 5-day / 1-month % move.

Produce a punchy, original market update. Mirror the STRUCTURE of a great "Stock Market Today" LinkedIn post — never anyone's exact words.

LinkedIn caption:
- hook: one short scroll-stopping line summarizing the day's tone. It may start with ONE fitting emoji (e.g. 📈 / 📉 / ⚡). Keep it under ~60 characters.
- bullets: 4 to 6 short theme lines. EACH bullet must START with a single relevant emoji, then a concise, specific point drawn from the data (e.g. an index move, a standout holding, a commodity/FX shift, a risk to watch). One sentence each, no trailing hashtags. Do NOT include a leading "•" — the app adds it.
- hashtags: 3 to 5, each a single #Tag. Favor relevant, real tags (e.g. #StockMarket, #Sensex, #Nifty, #Markets). No spaces inside a tag.

Email newsletter (a matching section):
- subject: a credible, non-clickbait subject for today's update.
- preheader: one line, ~90 characters.
- idea: the core read on the day in 1-2 sentences.
- story: why it matters now, grounded in the specific moves in the data (2-3 sentences).
- takeaway: the one thing to remember or do.
- ctaLabel: a short button label pointing to Munshot.

Hard rules:
- Ground EVERY claim in the provided feed. You may cite the exact numbers given (levels and % moves). NEVER invent a number that is not in the feed.
- If a focus instrument is named, lead with it, but still give a rounded market picture.
- Keep it sharp and credible — this publishes under the Munshot brand.`

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
        takeaway: { type: 'string' },
        ctaLabel: { type: 'string' },
      },
      required: ['subject', 'preheader', 'idea', 'story', 'takeaway', 'ctaLabel'],
    },
  },
  required: ['focus', 'linkedin', 'email'],
}

/** Fetch today's feed and generate the Daily Pulse post from it. */
export async function generatePulsePost(
  env: Env,
  input: PulseGenInput,
): Promise<{ post: PulsePost; fetchedAt: string }> {
  if (!env.ANTHROPIC_API_KEY) throw new ApiError('ANTHROPIC_API_KEY is not set (see SETUP.md).', 400)

  const feed = await fetchDailyPulse(env)
  if (!feed.items.length) throw new ApiError('The Daily Pulse feed is empty right now.', 502)

  const focus = input.focusId ? feed.items.find((it) => it.id === input.focusId) : undefined
  const focusLine = focus
    ? `FOCUS INSTRUMENT (lead with this): ${focus.name} (${focus.ticker}) — 1d ${pct(focus.d1)}, 5d ${pct(focus.d5)}, 1m ${pct(focus.m1)}.`
    : 'FOCUS: none — write a whole-market daily wrap.'

  const userMessage = [
    `TONE: ${input.tone || 'sharp, credible, market-savvy'}`,
    focusLine,
    '',
    "TODAY'S MUNSHOT MARKET FEED:",
    buildDigest(feed),
  ].join('\n')

  const model = env.GEN_MODEL || 'claude-opus-5'
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model,
      max_tokens: 8000,
      system: SYSTEM,
      output_config: { effort: 'medium', format: { type: 'json_schema', schema: SCHEMA } },
      messages: [{ role: 'user', content: userMessage }],
    }),
  })

  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new ApiError(`Claude API error ${res.status}: ${detail.slice(0, 400)}`, 502)
  }

  const data: any = await res.json()
  if (data.stop_reason === 'refusal') {
    throw new ApiError('The model declined this request. Try a different focus or tone.', 422)
  }
  const text = (data.content || [])
    .filter((b: any) => b.type === 'text')
    .map((b: any) => b.text)
    .join('')
    .trim()

  let post: PulsePost
  try {
    post = JSON.parse(text)
  } catch {
    throw new ApiError('The model did not return valid JSON. Try again.', 502)
  }
  // Defensive defaults so the UI never crashes on a missing field.
  post.linkedin = post.linkedin || ({} as any)
  post.email = post.email || ({} as any)
  post.linkedin.bullets = Array.isArray(post.linkedin.bullets) ? post.linkedin.bullets : []
  post.linkedin.hashtags = Array.isArray(post.linkedin.hashtags) ? post.linkedin.hashtags : []
  if (!post.focus) post.focus = focus ? focus.name : 'Whole-market wrap'
  return { post, fetchedAt: feed.fetchedAt }
}
