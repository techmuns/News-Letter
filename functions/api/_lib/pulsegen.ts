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
import { callClaudeJson, aiConfigured } from './llm'
import { fetchDailyPulse, type PulseFeed, type PulseItem } from './dailypulse'

/** A bold-lead key finding for the Top Story. */
export interface KeyPoint {
  lead: string
  detail: string
}

/** The Spotlight deep-dive (two views + an optional grounded quote). */
export interface EmailSpotlight {
  headline: string
  story: string
  wallStreetView: string
  pressView: string
  pressQuote: string
}

export interface EmailSection {
  subject: string
  preheader: string
  idea: string
  story: string
  takeaway: string
  ctaLabel: string
  keyPoints: KeyPoint[]
  spotlight: EmailSpotlight
}

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
  email: EmailSection
}

/** Coerce the model's key-findings into a clean {lead, detail}[] (never throws). */
export function normalizeKeyPoints(raw: unknown): KeyPoint[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((k: any) => ({
      lead: String(k?.lead ?? '').trim(),
      detail: String(k?.detail ?? '').trim(),
    }))
    .filter((k) => k.lead || k.detail)
    .slice(0, 5)
}

/** Coerce the model's spotlight into a safe object, or undefined if empty. */
export function normalizeSpotlight(raw: unknown): EmailSpotlight {
  const s = (raw || {}) as any
  return {
    headline: String(s.headline ?? '').trim(),
    story: String(s.story ?? '').trim(),
    wallStreetView: String(s.wallStreetView ?? '').trim(),
    pressView: String(s.pressView ?? '').trim(),
    pressQuote: String(s.pressQuote ?? '').trim(),
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

Email newsletter (a rich, multi-part digest):
- subject: a credible, non-clickbait subject for today's update.
- preheader: one line, ~90 characters.
- idea: the core read on the day in 1-2 sentences (the welcome/intro read).
- story: the Top Story narrative — why it matters now, grounded in the specific moves in the data (2-3 sentences).
- keyPoints: 3 to 4 key findings for the Top Story. Each is an object { lead, detail }: "lead" is a 2-4 word bold label; "detail" is ONE sentence carrying a HARD number from the feed (a level or a % move). No vague leads.
- spotlight: a deeper dive on ONE standout instrument or theme from the feed, as an object:
    - headline: a sharp 4-9 word headline.
    - story: 2-3 sentences of analysis, grounded strictly in the feed's levels and % moves.
    - wallStreetView: 1-2 sentences on the trading/positioning read of this move (grounded in the numbers).
    - pressView: 1-2 sentences on the wider macro / cross-asset read — what it implies for other instruments in the feed (grounded in the numbers).
    - pressQuote: ALWAYS an empty string "" for this data-only update — there are no news sources to quote, so never invent or attribute a quote.
- takeaway: the one thing to remember or do.
- ctaLabel: a short button label pointing to Munshot.

Hard rules:
- Ground EVERY claim in the provided feed. You may cite the exact numbers given (levels and % moves). NEVER invent a number that is not in the feed.
- If a focus instrument is named, lead with it, but still give a rounded market picture.
- Make it worth reading: leave the reader with at least ONE concrete, non-obvious takeaway — a specific move, a divergence, a second-order implication, or a "what most people miss" read they can act on. No platitudes ("markets were mixed"), no filler.
- Be granular: cite the actual levels/% moves, connect them (e.g. what one move implies for another), and add a nuanced angle — a tension or a consequence others overlook. One sharp, fully-made point beats three shallow ones.
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

/** Fetch today's feed and generate the Daily Pulse post from it. */
export async function generatePulsePost(
  env: Env,
  input: PulseGenInput,
): Promise<{ post: PulsePost; fetchedAt: string }> {
  if (!aiConfigured(env)) {
    throw new ApiError('No AI provider configured — set BEDROCK_API_KEY (see SETUP.md).', 400)
  }

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

  const post = await callClaudeJson<PulsePost>(env, {
    system: SYSTEM,
    user: userMessage,
    schema: SCHEMA,
  })
  // Defensive defaults so the UI never crashes on a missing field.
  post.linkedin = post.linkedin || ({} as any)
  post.email = post.email || ({} as any)
  post.linkedin.bullets = Array.isArray(post.linkedin.bullets) ? post.linkedin.bullets : []
  post.linkedin.hashtags = Array.isArray(post.linkedin.hashtags) ? post.linkedin.hashtags : []
  post.email.keyPoints = normalizeKeyPoints(post.email.keyPoints)
  post.email.spotlight = normalizeSpotlight(post.email.spotlight)
  if (!post.focus) post.focus = focus ? focus.name : 'Whole-market wrap'
  return { post, fetchedAt: feed.fetchedAt }
}
