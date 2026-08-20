import { describe, expect, it } from 'vitest'
import { ALLOWED_HOST_ORIGINS } from './sdk'

describe('ALLOWED_HOST_ORIGINS', () => {
  it('is never empty — an empty allow-list fails open in the vendor SDK', () => {
    expect(ALLOWED_HOST_ORIGINS.length).toBeGreaterThan(0)
  })

  it('only contains exact https origins, no wildcards or paths', () => {
    for (const origin of ALLOWED_HOST_ORIGINS) {
      expect(origin).toMatch(/^https:\/\/[^/*]+$/)
    }
  })
})
