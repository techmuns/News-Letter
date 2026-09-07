/* Turns a generated LinkedIn post (hook + body) into MarketCardData by parsing
   the index numbers out of the copy. Shared by the draft editor (prefill) and
   the generators (auto-attach the market card). */

import { type MarketCardData, type Direction, type MarketIndex } from './marketCard'
import { type PulseItem } from './api'
import { toPlain } from './unicodeBold'

const inr = (n: number) =>
  n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/** Build one index tile from a live feed item: exact level, %, points and the
    real intraday trend — nothing to type or correct. */
function indexFromPulse(item: PulseItem, name: string): MarketIndex {
  const prev = item.current / (1 + item.d1 / 100)
  return {
    name,
    value: inr(item.current),
    changePct: Math.abs(item.d1).toFixed(2),
    changePts: inr(Math.abs(item.current - prev)),
    direction: item.d1 < 0 ? 'down' : 'up',
    spark: item.spark,
  }
}

/** Build the market card straight from the live market feed — accurate numbers
    with zero editing. Editorial text (headline/accent/driver) still comes from
    the generated post. Returns null when the feed lacks Nifty 50 & Sensex. */
export function marketCardFromFeed(
  items: PulseItem[],
  post: { headline: string; body: string },
): MarketCardData | null {
  const nifty = items.find((i) => /nifty\s*50\b/i.test(i.name)) ?? items.find((i) => /^nifty 50/i.test(i.name))
  const sensex = items.find((i) => /sensex/i.test(i.name))
  if (!nifty || !sensex) return null
  const base = seedMarketCard(post)
  base.indices = [indexFromPulse(nifty, 'NIFTY 50'), indexFromPulse(sensex, 'SENSEX')]
  return base
}

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']
export function todayLabel(): string {
  const d = new Date()
  return `${String(d.getDate()).padStart(2, '0')} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`
}

const NUM = '[0-9][0-9,]*\\.?[0-9]*'

/** The ~130-char stretch of copy starting at a keyword ("Nifty …"). */
function segmentAround(text: string, keyword: string): string {
  const i = text.toLowerCase().indexOf(keyword.toLowerCase())
  return i < 0 ? '' : text.slice(i, i + 130)
}

function looksDown(text: string): boolean {
  return /\b(fell|drop|lower|down|slid|slip|loss|declin|red|sink|slump|shed)/i.test(text)
}

/** Pull { value (index level), pts, pct, direction } out of a line like
    "Sensex closed 373.93 points (0.49%) lower at 76,570.35". The level is the
    number after "at"/"to"; the pts sit before "points"; the % before "%". */
function extractIndex(text: string, keyword: string, name: string): MarketCardData['indices'][number] {
  const seg = segmentAround(text, keyword)
  const pct = seg.match(new RegExp(`(${NUM})\\s*%`))?.[1] ?? ''
  const pts = seg.match(new RegExp(`(${NUM})\\s*(?:points|pts|point)`, 'i'))?.[1] ?? ''
  const level =
    seg.match(new RegExp(`\\b(?:at|to)\\s+(${NUM})`, 'i'))?.[1] ??
    (seg.match(new RegExp(NUM, 'g')) ?? [])
      .slice()
      .sort((a, b) => parseFloat(b.replace(/,/g, '')) - parseFloat(a.replace(/,/g, '')))[0] ??
    ''
  return { name, value: level, changePts: pts, changePct: pct, direction: looksDown(seg) ? 'down' : 'up' }
}

/** Build the market-card inputs from a post's headline + body. */
export function seedMarketCard(content: { headline: string; body: string }): MarketCardData {
  const plainHead = toPlain(content.headline)
  const dash = plainHead.search(/[—–-]/)
  const lead = dash > 0 ? plainHead.slice(0, dash + 1).trim() : plainHead
  const accent = dash > 0 ? plainHead.slice(dash + 1).trim() : ''
  const text = toPlain(`${content.headline}\n${content.body}`)
  const fallbackDir: Direction = looksDown(text) ? 'down' : 'up'
  const nifty = extractIndex(text, 'nifty', 'NIFTY 50')
  const sensex = extractIndex(text, 'sensex', 'SENSEX')
  if (!segmentAround(text, 'nifty')) nifty.direction = fallbackDir
  if (!segmentAround(text, 'sensex')) sensex.direction = fallbackDir
  const driver =
    toPlain(content.body)
      .split('\n')
      .map((l) => l.replace(/^[^\p{L}\p{N}]+/u, '').trim())
      .find((l) => l.length > 24) ?? ''
  return {
    date: todayLabel(),
    eyebrow: 'INDIAN EQUITIES · DAILY PULSE',
    headline: lead || 'Market close',
    accent,
    driver,
    indices: [nifty, sensex],
  }
}

/** True when the copy carried enough real index data to auto-attach the card:
    both index tiles have a level. Otherwise the generators keep the plain
    branded card and the user can still build one by hand in the editor. */
export function marketCardIsUsable(seed: MarketCardData): boolean {
  return seed.indices.length >= 2 && seed.indices.every((i) => i.value.trim().length > 0)
}
