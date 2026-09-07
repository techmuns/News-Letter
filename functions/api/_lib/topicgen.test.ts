import { describe, it, expect } from 'vitest'
import { buildMarketBlock } from './topicgen'

describe('buildMarketBlock', () => {
  it('is empty when no market data is supplied', () => {
    expect(buildMarketBlock()).toBe('')
    expect(buildMarketBlock([])).toBe('')
  })

  it('labels a down move and gives the level, %, and computed points', () => {
    const out = buildMarketBlock([{ name: 'SENSEX', value: 76082.96, changePct: -0.57 }])
    expect(out).toContain('SENSEX: 76,082.96')
    expect(out).toContain('DOWN 0.57%')
    // points ≈ 76082.96 - 76082.96/(1-0.0057) ≈ 436.2 (matches the card)
    expect(out).toMatch(/≈436/)
    expect(out).toContain("TODAY'S MARKET DATA")
  })

  it('labels an up move', () => {
    expect(buildMarketBlock([{ name: 'NIFTY 50', value: 24000, changePct: 0.72 }])).toContain('UP 0.72%')
  })
})
