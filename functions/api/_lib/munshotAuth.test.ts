import { describe, expect, it } from 'vitest'
import { decodeMunshotEmail, requireMunshotUser } from './munshotAuth'

function base64Url(obj: unknown): string {
  const json = JSON.stringify(obj)
  const b64 = Buffer.from(json, 'utf8').toString('base64')
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fakeJwt(payload: Record<string, unknown>): string {
  const header = base64Url({ alg: 'none', typ: 'JWT' })
  return `${header}.${base64Url(payload)}.unsigned-test-signature`
}

function requestWithAuth(value: string | null): Request {
  const headers = new Headers()
  if (value !== null) headers.set('authorization', value)
  return new Request('https://example.com/api/buffer/organizations', { headers })
}

describe('decodeMunshotEmail', () => {
  it('extracts the email claim from a well-formed bearer JWT', () => {
    const token = fakeJwt({ email: 'Rahul@Acme.com', sub: 'user_1' })
    expect(decodeMunshotEmail(requestWithAuth(`Bearer ${token}`))).toBe('rahul@acme.com')
  })

  it('is case-insensitive on the "Bearer" scheme', () => {
    const token = fakeJwt({ email: 'a@b.com' })
    expect(decodeMunshotEmail(requestWithAuth(`bearer ${token}`))).toBe('a@b.com')
  })

  it('returns null when there is no Authorization header', () => {
    expect(decodeMunshotEmail(requestWithAuth(null))).toBeNull()
  })

  it('returns null for a non-Bearer scheme', () => {
    expect(decodeMunshotEmail(requestWithAuth('Basic dXNlcjpwYXNz'))).toBeNull()
  })

  it('returns null for a token with too few segments', () => {
    expect(decodeMunshotEmail(requestWithAuth('Bearer not-a-jwt'))).toBeNull()
  })

  it('returns null when the payload has no email claim', () => {
    const token = fakeJwt({ sub: 'user_1' })
    expect(decodeMunshotEmail(requestWithAuth(`Bearer ${token}`))).toBeNull()
  })

  it('returns null when the email claim is not email-shaped', () => {
    const token = fakeJwt({ email: 'not-an-email' })
    expect(decodeMunshotEmail(requestWithAuth(`Bearer ${token}`))).toBeNull()
  })

  it('returns null for malformed base64 payload segments', () => {
    expect(decodeMunshotEmail(requestWithAuth('Bearer abc.!!!not-base64!!!.sig'))).toBeNull()
  })
})

describe('requireMunshotUser', () => {
  it('returns the email on a valid token', () => {
    const token = fakeJwt({ email: 'user@munshot.io' })
    expect(requireMunshotUser(requestWithAuth(`Bearer ${token}`))).toBe('user@munshot.io')
  })

  it('throws a 401 ApiError when there is no valid token', () => {
    expect(() => requireMunshotUser(requestWithAuth(null))).toThrow()
    try {
      requireMunshotUser(requestWithAuth(null))
      expect.unreachable()
    } catch (e: any) {
      expect(e.status).toBe(401)
    }
  })
})
