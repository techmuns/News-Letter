import { describe, expect, it } from 'vitest'
import { isTrustedOrigin, isValidSessionPayload } from './hostMessageGuard'

const ALLOWED = ['https://chat.muns.io']

describe('isTrustedOrigin', () => {
  it('accepts an exact allow-listed origin', () => {
    expect(isTrustedOrigin('https://chat.muns.io', ALLOWED)).toBe(true)
  })

  it('rejects a look-alike suffix origin', () => {
    expect(isTrustedOrigin('https://chat.muns.io.evil.example', ALLOWED)).toBe(false)
  })

  it('rejects a scheme mismatch', () => {
    expect(isTrustedOrigin('http://chat.muns.io', ALLOWED)).toBe(false)
  })

  it('rejects a subdomain that was not explicitly listed', () => {
    expect(isTrustedOrigin('https://sub.chat.muns.io', ALLOWED)).toBe(false)
  })

  it('fails closed on an empty allow-list', () => {
    expect(isTrustedOrigin('https://chat.muns.io', [])).toBe(false)
  })

  it('rejects an empty origin', () => {
    expect(isTrustedOrigin('', ALLOWED)).toBe(false)
  })

  it('rejects the sandboxed-iframe "null" origin', () => {
    expect(isTrustedOrigin('null', ALLOWED)).toBe(false)
  })
})

describe('isValidSessionPayload', () => {
  it('accepts a full session payload', () => {
    expect(isValidSessionPayload({ token: 'jwt', email: 'a@b.com' })).toBe(true)
  })

  it('accepts an all-null session (pre-login / logged-out)', () => {
    expect(isValidSessionPayload({ token: null, email: null })).toBe(true)
  })

  it('rejects a non-object payload', () => {
    expect(isValidSessionPayload('nope')).toBe(false)
  })

  it('rejects an email missing "@"', () => {
    expect(isValidSessionPayload({ email: 'not-an-email' })).toBe(false)
  })

  it('rejects a non-string email', () => {
    expect(isValidSessionPayload({ email: 12345 })).toBe(false)
  })

  it('rejects an oversized email', () => {
    expect(isValidSessionPayload({ email: `${'a'.repeat(400)}@x.com` })).toBe(false)
  })

  it('rejects a non-string token', () => {
    expect(isValidSessionPayload({ email: 'a@b.com', token: 12345 })).toBe(false)
  })
})
