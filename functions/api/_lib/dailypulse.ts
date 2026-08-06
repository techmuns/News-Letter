/* "Daily Pulse" — pull the latest market snapshot from the Daily Market Pulse
   dashboard (techmuns/DailyMarketPulse) and normalize it into pickable items
   for Studio.

   Source: that repo publishes `public/data/live.json`, refreshed twice daily by
   its own GitHub Action (07:00 & 19:00 IST) and committed back. We read the
   default-branch copy via the rename-proof `HEAD` ref, so it tracks whatever
   they publish without hard-coding a branch name. Override with DAILY_PULSE_URL
   to point at the deployed dashboard (…/data/live.json) or a pinned branch.

   The feed carries live numbers keyed by a stable `id` but no display names, so
   we enrich each item from a small built-in map (the same ids the dashboard's
   own mock data uses). */
import type { Env } from './env'
import { ApiError } from './http'

const DEFAULT_FEED_URL =
  'https://raw.githubusercontent.com/techmuns/DailyMarketPulse/HEAD/public/data/live.json'

export type PulseGroup = 'index' | 'currency' | 'commodity' | 'holding'

export interface PulseItem {
  id: string
  group: PulseGroup
  name: string
  ticker: string
  current: number
  unit?: string
  sector?: string
  /** percent change: 1-day, 5-day, 1-month */
  d1: number
  d5: number
  m1: number
  spark: number[]
}

export interface PulseFeed {
  fetchedAt: string
  items: PulseItem[]
}

/** Stable id → display metadata the raw feed omits (names, units, sectors). */
interface Meta {
  name: string
  group: PulseGroup
  unit?: string
  sector?: string
}
const INSTRUMENTS: Record<string, Meta> = {
  // indices
  'i-nifty': { name: 'NIFTY 50', group: 'index' },
  'i-sensex': { name: 'SENSEX', group: 'index' },
  'i-niftym': { name: 'NIFTY Midcap 100', group: 'index' },
  'i-spx': { name: 'S&P 500', group: 'index' },
  'i-nasdaq': { name: 'NASDAQ Composite', group: 'index' },
  'i-vix': { name: 'India VIX', group: 'index' },
  // currencies
  'fx-usdinr': { name: 'USD / INR', group: 'currency' },
  'fx-eurinr': { name: 'EUR / INR', group: 'currency' },
  'fx-jpyinr': { name: 'JPY / INR', group: 'currency' },
  'fx-cnyinr': { name: 'CNY / INR', group: 'currency' },
  'fx-dxy': { name: 'Dollar Index (DXY)', group: 'currency' },
  // commodities
  'c-brent': { name: 'Brent Crude', group: 'commodity', unit: 'USD/bbl' },
  'c-gold': { name: 'Gold', group: 'commodity', unit: 'USD/oz' },
  'c-steel': { name: 'HRC Steel', group: 'commodity', unit: '₹/t' },
  'c-alum': { name: 'Aluminium (LME)', group: 'commodity', unit: 'USD/t' },
  'c-copper': { name: 'Copper (LME)', group: 'commodity', unit: 'USD/t' },
  'c-sugar': { name: 'Sugar', group: 'commodity', unit: 'USc/lb' },
  // holdings — portfolio
  'p-infy': { name: 'Infosys', group: 'holding', sector: 'IT Services' },
  'p-mm': { name: 'Mahindra & Mahindra', group: 'holding', sector: 'Autos' },
  'p-hdfcb': { name: 'HDFC Bank', group: 'holding', sector: 'Banks' },
  'p-asianp': { name: 'Asian Paints', group: 'holding', sector: 'Paints' },
  'p-tcs': { name: 'Tata Consultancy Services', group: 'holding', sector: 'IT Services' },
  'p-relian': { name: 'Reliance Industries', group: 'holding', sector: 'Conglomerate' },
  'p-titan': { name: 'Titan Company', group: 'holding', sector: 'Consumer' },
  'p-bajfin': { name: 'Bajaj Finance', group: 'holding', sector: 'NBFC' },
  // holdings — watchlist
  'w-pidil': { name: 'Pidilite Industries', group: 'holding', sector: 'Specialty Chem' },
  'w-dmart': { name: 'Avenue Supermarts (DMart)', group: 'holding', sector: 'Retail' },
  'w-divis': { name: "Divi's Laboratories", group: 'holding', sector: 'Pharma' },
  'w-zomato': { name: 'Eternal (Zomato)', group: 'holding', sector: 'Internet' },
  'w-pi': { name: 'PI Industries', group: 'holding', sector: 'Agri Chem' },
}

/** Feed's top-level array keys → our group tag, in display order. */
const GROUP_KEYS: { key: string; group: PulseGroup }[] = [
  { key: 'indices', group: 'index' },
  { key: 'currencies', group: 'currency' },
  { key: 'commodities', group: 'commodity' },
  { key: 'holdings', group: 'holding' },
]
const GROUP_ORDER: PulseGroup[] = ['index', 'currency', 'commodity', 'holding']

function num(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : 0
}

function normalize(raw: any, fallbackGroup: PulseGroup): PulseItem | null {
  const id = String(raw?.id || '')
  if (!id) return null
  const meta = INSTRUMENTS[id]
  const trend = raw?.trend || {}
  return {
    id,
    group: meta?.group || fallbackGroup,
    name: meta?.name || id,
    ticker: String(raw?.ticker || ''),
    current: num(raw?.current),
    unit: meta?.unit,
    sector: meta?.sector,
    d1: num(trend.d1),
    d5: num(trend.d5),
    m1: num(trend.m1),
    spark: Array.isArray(trend.spark) ? trend.spark.map(num) : [],
  }
}

/** Fetch + normalize the latest Daily Pulse snapshot. Biggest 1-day movers
    surface first within each group; groups stay in index→…→holding order. */
export async function fetchDailyPulse(env: Env): Promise<PulseFeed> {
  const url = (env.DAILY_PULSE_URL && env.DAILY_PULSE_URL.trim()) || DEFAULT_FEED_URL
  let res: Response
  try {
    res = await fetch(url, { headers: { accept: 'application/json' } })
  } catch {
    throw new ApiError('Could not reach the Daily Pulse feed.', 502)
  }
  if (!res.ok) {
    throw new ApiError(`Daily Pulse feed error ${res.status}.`, res.status === 404 ? 404 : 502)
  }
  const data: any = await res.json().catch(() => null)
  if (!data || typeof data !== 'object') {
    throw new ApiError('Daily Pulse feed returned unexpected data.', 502)
  }

  const items: PulseItem[] = []
  for (const { key, group } of GROUP_KEYS) {
    const arr = Array.isArray(data[key]) ? data[key] : []
    for (const raw of arr) {
      const it = normalize(raw, group)
      if (it) items.push(it)
    }
  }
  items.sort((a, b) =>
    a.group !== b.group
      ? GROUP_ORDER.indexOf(a.group) - GROUP_ORDER.indexOf(b.group)
      : Math.abs(b.d1) - Math.abs(a.d1),
  )

  return { fetchedAt: String(data.fetchedAt || ''), items }
}
