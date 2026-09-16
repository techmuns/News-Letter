/* Auto-fill the Data Snapshot card from a topic. Fetches real recent news for
   the keyword (same source as the topic caption generator), hands ONLY those
   sourced facts to Claude, and gets back the structured card — a finding
   headline, the chart data, and three colour-coded takeaways that each lead
   with a REAL figure from the sources. Numbers are never invented: if the
   sources don't state a figure, the model leaves it out. */
import type { Env } from './env'
import { ApiError } from './http'
import { callClaudeJson, aiConfigured } from './llm'
import { fetchTopicNews, newsConfigured, type NewsItem } from './news'
import { buildMarketBlock, type MarketQuote } from './topicgen'

export interface SnapshotGenInput {
  topic: string
  market?: MarketQuote[]
}

export interface SnapshotCard {
  layout: 'bars' | 'trend' | 'ranking' | 'stat'
  title: string
  titleAccent: string
  subtitle: string
  bars: { name: string; sub: string; pct: string }[]
  series: { name: string; points: number[] }[]
  xLabels: string[]
  stat: { value: string; label: string; context: string }
  takeaways: { tone: 'red' | 'green' | 'plum'; figure: string; lead: string; text: string }[]
  watchNext: string
  source: string
}

const SYSTEM = `You are the data desk for Munshot — a market-intelligence platform. Turn the TOPIC and the sourced news below into ONE "Data Snapshot" card: a research graphic with a finding as the headline, a chart, and a sidebar of colour-coded takeaways. Use ONLY facts and numbers that appear in the provided sources (or in the live MARKET DATA block, which is authoritative). NEVER invent a figure.

Choose the layout that best fits the story:
- "bars": compare a few named values moving (e.g. index/stock % moves). Fill "bars" with 2–5 { name, sub (a level/context, may be ""), pct (SIGNED number, no % sign, e.g. "-1.18" or "0.4") }.
- "ranking": a sorted league of winners vs losers (sectors, movers). Same "bars" shape; it will be auto-sorted.
- "stat": ONE dominant number is the story. Fill "stat" { value (e.g. "~91%", "$5,597"), label (what it is), context (one sentence) }.
- "trend": a series over time. Fill "series" with 1–3 { name, points:[numbers oldest→newest] } and "xLabels" [first, last]. ONLY use this when the sources give a real series of comparable numbers; otherwise pick another layout.

Always fill:
- title: the FINDING as a SHORT phrase — at most ~8 words, NOT a paragraph and NOT the caption. titleAccent: a short tail (at most ~8 words) rendered in a highlight colour; title + titleAccent must read as ONE short headline sentence. Keep the whole headline to ~16 words max. Example title "Gold hit a record in January." + titleAccent "It has quietly round-tripped since." Put the full explanation in the takeaways, never in the title.
- subtitle: the dataset / method line (what, when, units). One short line.
- takeaways: EXACTLY 3. Each { tone, figure, lead, text }:
    - figure: a BIG real number/date from the sources ("~91%", "$5,597", "2007", "-23%"). This leads the point.
    - lead: a 2–5 word bold label.
    - text: ONE sentence with the mechanism or why it matters. Make ONE of the three an honest caveat or a "what most people miss".
    - tone: "red" for a fall/risk/warning, "green" for a rise/positive, "plum" for a neutral/structural read. Use a sensible mix.
- watchNext: one short line — the next event or number that could change the picture.
- source: a short, honest source line (e.g. "gold spot, 2026" or "exchange data, 16 Sep 2026"). Do NOT fabricate a specific provider name that isn't in the sources; keep it generic and true.

Hard rules:
- Ground EVERY number strictly in the sources or the MARKET DATA block. If the sources are thin on numbers, prefer the "stat" layout around the one solid figure rather than padding with invented data.
- Compute a signed % honestly; never state a fabricated precision.
- Keep it sharp, neutral, credible — this publishes under the Munshot brand.`

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    layout: { type: 'string', enum: ['bars', 'trend', 'ranking', 'stat'] },
    title: { type: 'string' },
    titleAccent: { type: 'string' },
    subtitle: { type: 'string' },
    bars: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: { name: { type: 'string' }, sub: { type: 'string' }, pct: { type: 'string' } },
        required: ['name', 'sub', 'pct'],
      },
    },
    series: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: { name: { type: 'string' }, points: { type: 'array', items: { type: 'number' } } },
        required: ['name', 'points'],
      },
    },
    xLabels: { type: 'array', items: { type: 'string' } },
    stat: {
      type: 'object',
      additionalProperties: false,
      properties: { value: { type: 'string' }, label: { type: 'string' }, context: { type: 'string' } },
      required: ['value', 'label', 'context'],
    },
    takeaways: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          tone: { type: 'string', enum: ['red', 'green', 'plum'] },
          figure: { type: 'string' },
          lead: { type: 'string' },
          text: { type: 'string' },
        },
        required: ['tone', 'figure', 'lead', 'text'],
      },
    },
    watchNext: { type: 'string' },
    source: { type: 'string' },
  },
  required: ['layout', 'title', 'titleAccent', 'subtitle', 'takeaways', 'watchNext', 'source'],
}

function buildDigest(topic: string, items: NewsItem[], market?: MarketQuote[]): string {
  const sources = items
    .map((n, i) => `[${i + 1}] ${n.title}\n    (${[n.source, n.date].filter(Boolean).join(' · ')})\n    ${n.snippet}`)
    .join('\n\n')
  return [`TOPIC: ${topic}`, '', buildMarketBlock(market), 'SOURCED NEWS — use ONLY these for facts and numbers:', sources]
    .filter(Boolean)
    .join('\n')
}

export async function generateSnapshotCard(
  env: Env,
  input: SnapshotGenInput,
): Promise<{ card: SnapshotCard; sources: NewsItem[]; topic: string }> {
  if (!aiConfigured(env)) throw new ApiError('No AI provider configured — set BEDROCK_API_KEY (see SETUP.md).', 400)
  const topic = (input.topic || '').trim()
  if (!topic) throw new ApiError('Enter a topic or keyword.', 400)
  if (!newsConfigured(env)) throw new ApiError("Topic news isn't configured — set NEWSAPI_KEY (see SETUP.md).", 400)

  const sources = await fetchTopicNews(env, topic)
  if (sources.length === 0) throw new ApiError(`No recent news found for "${topic}" — try another keyword.`, 404)

  const card = await callClaudeJson<SnapshotCard>(env, {
    system: SYSTEM,
    user: buildDigest(topic, sources, input.market),
    schema: SCHEMA,
  })
  // Defensive normalisation so the card renderer never crashes on a missing field.
  card.layout = ['bars', 'trend', 'ranking', 'stat'].includes(card.layout) ? card.layout : 'bars'
  card.bars = Array.isArray(card.bars) ? card.bars.filter((b) => b && b.name) : []
  card.series = Array.isArray(card.series) ? card.series.filter((s) => s && Array.isArray(s.points)) : []
  card.xLabels = Array.isArray(card.xLabels) ? card.xLabels.map(String) : []
  card.stat = card.stat && typeof card.stat === 'object' ? card.stat : { value: '', label: '', context: '' }
  card.takeaways = (Array.isArray(card.takeaways) ? card.takeaways : [])
    .filter((t) => t && (t.lead || t.text || t.figure))
    .slice(0, 3)
  card.titleAccent = typeof card.titleAccent === 'string' ? card.titleAccent : ''
  card.watchNext = typeof card.watchNext === 'string' ? card.watchNext : ''
  card.source = typeof card.source === 'string' && card.source.trim() ? card.source : topic
  return { card, sources, topic }
}
