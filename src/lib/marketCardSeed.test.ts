import { describe, it, expect } from 'vitest'
import { seedMarketCard, marketCardIsUsable, marketCardFromFeed } from './marketCardSeed'
import { type PulseItem } from './api'

const pulse = (over: Partial<PulseItem>): PulseItem => ({
  id: 'x',
  group: 'index' as PulseItem['group'],
  name: 'X',
  ticker: 'X',
  current: 0,
  d1: 0,
  d5: 0,
  m1: 0,
  spark: [1, 2, 3],
  ...over,
})

const MARKET_POST = {
  headline: "Third straight loss — but oil's the real culprit",
  body:
    '📉 Sensex closed 373.93 points (0.49%) lower at 76,570.35; Nifty dropped 141.35 points (0.59%) to 23,914.45\n' +
    '🛢️ Escalating US-Iran tensions drove crude higher\n\n#Sensex #Nifty',
}

describe('seedMarketCard', () => {
  it('parses the index level (not the points move) for each index', () => {
    const seed = seedMarketCard(MARKET_POST)
    const [nifty, sensex] = seed.indices
    expect(nifty.value).toBe('23,914.45')
    expect(sensex.value).toBe('76,570.35')
  })

  it('parses the points move and the percentage', () => {
    const [nifty, sensex] = seedMarketCard(MARKET_POST).indices
    expect(nifty.changePts).toBe('141.35')
    expect(nifty.changePct).toBe('0.59')
    expect(sensex.changePts).toBe('373.93')
    expect(sensex.changePct).toBe('0.49')
  })

  it('reads direction from the words (down here)', () => {
    for (const idx of seedMarketCard(MARKET_POST).indices) expect(idx.direction).toBe('down')
  })

  it('splits the headline into white lead and coloured accent on the dash', () => {
    const seed = seedMarketCard(MARKET_POST)
    expect(seed.headline).toBe('Third straight loss —')
    expect(seed.accent).toBe("but oil's the real culprit")
  })

  it('is usable when both index levels are present', () => {
    expect(marketCardIsUsable(seedMarketCard(MARKET_POST))).toBe(true)
  })
})

describe('marketCardIsUsable', () => {
  it('is false for a non-market post (no index levels parse)', () => {
    const seed = seedMarketCard({
      headline: 'Why the IPO frenzy is back',
      body: 'A wave of new listings is testing investor appetite. Grey-market premiums are climbing.',
    })
    expect(marketCardIsUsable(seed)).toBe(false)
  })

  it('is false when only one index parses', () => {
    const seed = seedMarketCard({
      headline: 'Nifty slips',
      body: 'Nifty fell 141.35 points (0.59%) to 23,914.45 as selling resumed.',
    })
    expect(seed.indices[0].value).toBe('23,914.45')
    expect(seed.indices[1].value).toBe('')
    expect(marketCardIsUsable(seed)).toBe(false)
  })
})

describe('marketCardFromFeed', () => {
  const POST = { headline: 'Markets slip — oil weighs', body: 'A down day.' }
  const FEED = [
    pulse({ name: 'India VIX', current: 11.27, d1: 5.57, spark: [10, 11, 11.3] }),
    pulse({ name: 'SENSEX', current: 76082.96, d1: -0.57, spark: [76500, 76300, 76082.96] }),
    pulse({ name: 'NIFTY 50', current: 23774.45, d1: -0.52, spark: [23900, 23820, 23774.45] }),
    pulse({ name: 'NIFTY Midcap 100', current: 18042.2, d1: -0.47 }),
  ]

  it('picks NIFTY 50 (not Midcap) and SENSEX with exact live numbers', () => {
    const card = marketCardFromFeed(FEED, POST)!
    expect(card).not.toBeNull()
    const [nifty, sensex] = card.indices
    expect(nifty.name).toBe('NIFTY 50')
    expect(nifty.value).toBe('23,774.45')
    expect(sensex.value).toBe('76,082.96')
  })

  it('carries the exact percentage, direction and the real spark', () => {
    const [nifty, sensex] = marketCardFromFeed(FEED, POST)!.indices
    expect(nifty.changePct).toBe('0.52')
    expect(nifty.direction).toBe('down')
    expect(sensex.changePct).toBe('0.57')
    expect(sensex.spark).toEqual([76500, 76300, 76082.96])
  })

  it('computes points from level and %', () => {
    const [nifty] = marketCardFromFeed(FEED, POST)!.indices
    // 23774.45 down 0.52% → previous ≈ 23898.7 → ~124.3 pts
    expect(parseFloat(nifty.changePts.replace(/,/g, ''))).toBeCloseTo(124.3, 0)
  })

  it('returns null when the feed lacks the indices', () => {
    expect(marketCardFromFeed([pulse({ name: 'Gold', current: 100, d1: 1 })], POST)).toBeNull()
  })
})
