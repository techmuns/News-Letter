import { describe, it, expect } from 'vitest'
import { seedMarketCard, marketCardIsUsable } from './marketCardSeed'

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
