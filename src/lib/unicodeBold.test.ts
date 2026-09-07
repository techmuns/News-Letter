import { describe, it, expect } from 'vitest'
import { toBold, toPlain, autoBoldLead, autoBoldBody } from './unicodeBold'

describe('toBold / toPlain', () => {
  it('round-trips letters and digits', () => {
    expect(toPlain(toBold('Sensex 76,132'))).toBe('Sensex 76,132')
  })
  it('leaves punctuation and emoji untouched', () => {
    expect(toBold('—: 📉')).toBe('—: 📉')
  })
})

describe('autoBoldLead', () => {
  it('bolds the index name before a finance verb', () => {
    const out = autoBoldLead('📉 Sensex closed 382.62 points lower at 76,132.81')
    expect(out.startsWith('📉 ')).toBe(true)
    expect(out).toContain(toBold('Sensex'))
    expect(out).toContain('closed 382.62 points lower at 76,132.81') // rest stays plain
    expect(out).not.toContain(toBold('closed'))
  })
  it('bolds the lead before a colon', () => {
    expect(autoBoldLead('The question: how much more can crude climb?')).toContain(toBold('The question'))
  })
  it('bolds the first two words when there is no verb or delimiter', () => {
    expect(autoBoldLead('🛢️ Crude oil elevated on US–Iran tension')).toContain(toBold('Crude oil'))
  })
  it('leaves the hashtag line alone', () => {
    expect(autoBoldLead('#Sensex #Nifty #Markets')).toBe('#Sensex #Nifty #Markets')
  })
  it('is idempotent (re-running does not double-bold)', () => {
    const once = autoBoldLead('📉 Sensex closed lower')
    expect(autoBoldLead(once)).toBe(once)
  })
})

describe('autoBoldBody', () => {
  it('bolds each bullet lead but not blank or hashtag lines', () => {
    const body = '📉 Sensex fell 382 points\n🚗 Auto stocks led the drop\n\n#Sensex #Nifty'
    const out = autoBoldBody(body)
    expect(out).toContain(toBold('Sensex'))
    expect(out).toContain(toBold('Auto stocks'))
    expect(out).toContain('#Sensex #Nifty')
    expect(out).not.toContain(toBold('#Sensex'))
  })
})
