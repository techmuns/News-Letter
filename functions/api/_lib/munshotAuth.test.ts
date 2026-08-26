import { describe, expect, it } from 'vitest'
import { GUEST_IDENTITY_EMAIL, decodeMunshotEmail, requireMunshotUser } from './munshotAuth'
import type { Env } from './env'

function base64Url(obj: unknown): string {
  const json = JSON.stringify(obj)
  const b64 = Buffer.from(json, 'utf8').toString('base64')
  return b64.replace(/\+/g, '-').replace(/_/g, '/').replace(/=+$/, '')
}

/** An unsigned token — the exact thing an attacker can trivially mint. */
function fakeJwt(payload: Record<string, unknown>): string {
  return `${base64Url({ alg: 'none', typ: 'JWT' })}.${base64Url(payload)}.not-a-real-signature`
}

function requestWithAuth(value: string | null): Request {
  const headers = new Headers()
  if (value !== null) headers.set('authorization', value)
  return new Request('https://example.com/api/buffer/organizations', { headers })
}

/** A real HS256 token, so the verified path can be tested end to end. */
async function signHs256(payload: Record<string, unknown>, secret: string): Promise<string> {
  const signingInput = `${base64Url({ alg: 'HS256', typ: 'JWT' })}.${base64Url(payload)}`
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signingInput))
  const b64 = Buffer.from(new Uint8Array(sig)).toString('base64')
  return `${signingInput}.${b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')}`
}

const HMAC_SECRET = 'test-shared-signing-secret'
const UNVERIFIED_ENV = {} as Env
const VERIFIED_ENV = { MUNSHOT_JWT_HMAC_SECRET: HMAC_SECRET } as Env
const ENFORCED_ENV = {
  MUNSHOT_JWT_HMAC_SECRET: HMAC_SECRET,
  MUNSHOT_REQUIRE_VERIFIED_SESSION: 'true',
} as Env

const future = () => Math.floor(Date.now() / 1000) + 3600

describe('decodeMunshotEmail (unverified decode)', () => {
  it('extracts the email claim from a well-formed bearer JWT', () => {
    expect(decodeMunshotEmail(requestWithAuth(`Bearer ${fakeJwt({ email: 'Rahul@Acme.com' })}`))).toBe(
      'rahul@acme.com',
    )
  })

  it('is case-insensitive on the "Bearer" scheme', () => {
    expect(decodeMunshotEmail(requestWithAuth(`bearer ${fakeJwt({ email: 'a@b.com' })}`))).toBe('a@b.com')
  })

  it('returns null with no Authorization header', () => {
    expect(decodeMunshotEmail(requestWithAuth(null))).toBeNull()
  })

  it('returns null for a non-Bearer scheme', () => {
    expect(decodeMunshotEmail(requestWithAuth('Basic dXNlcjpwYXNz'))).toBeNull()
  })

  it('returns null for a token with too few segments', () => {
    expect(decodeMunshotEmail(requestWithAuth('Bearer not-a-jwt'))).toBeNull()
  })

  it('returns null when there is no email claim', () => {
    expect(decodeMunshotEmail(requestWithAuth(`Bearer ${fakeJwt({ sub: 'u1' })}`))).toBeNull()
  })

  it('returns null when the email claim is not email-shaped', () => {
    expect(decodeMunshotEmail(requestWithAuth(`Bearer ${fakeJwt({ email: 'nope' })}`))).toBeNull()
  })

  it('returns null for malformed base64 payload segments', () => {
    expect(decodeMunshotEmail(requestWithAuth('Bearer abc.!!!not-base64!!!.sig'))).toBeNull()
  })
})

describe('requireMunshotUser — mode 3: unverified (no key configured)', () => {
  it('falls back to the shared guest identity when no session is sent', async () => {
    await expect(requireMunshotUser(requestWithAuth(null), UNVERIFIED_ENV)).resolves.toBe(GUEST_IDENTITY_EMAIL)
  })

  it('trusts an UNSIGNED token — the known gap this mode has', async () => {
    // Documents the risk explicitly: without a key, a forged token wins.
    await expect(
      requireMunshotUser(requestWithAuth(`Bearer ${fakeJwt({ email: 'victim@client.com' })}`), UNVERIFIED_ENV),
    ).resolves.toBe('victim@client.com')
  })

  it('rejects a malformed session rather than silently guest-ing', async () => {
    await expect(requireMunshotUser(requestWithAuth('Bearer garbage'), UNVERIFIED_ENV)).rejects.toMatchObject({
      status: 401,
    })
  })

  it('refuses to run enforced with no key configured', async () => {
    const env = { MUNSHOT_REQUIRE_VERIFIED_SESSION: 'true' } as Env
    await expect(requireMunshotUser(requestWithAuth(null), env)).rejects.toMatchObject({ status: 500 })
  })
})

describe('requireMunshotUser — mode 1: verified + enforced', () => {
  it('accepts a correctly signed token', async () => {
    const token = await signHs256({ email: 'client-a@corp.com', exp: future() }, HMAC_SECRET)
    await expect(requireMunshotUser(requestWithAuth(`Bearer ${token}`), ENFORCED_ENV)).resolves.toBe(
      'client-a@corp.com',
    )
  })

  it('REJECTS a forged unsigned token claiming another client', async () => {
    // This is the whole point of the mode.
    await expect(
      requireMunshotUser(requestWithAuth(`Bearer ${fakeJwt({ email: 'victim@client.com' })}`), ENFORCED_ENV),
    ).rejects.toMatchObject({ status: 401 })
  })

  it('rejects a token signed with the wrong secret', async () => {
    const token = await signHs256({ email: 'attacker@evil.com', exp: future() }, 'wrong-secret')
    await expect(requireMunshotUser(requestWithAuth(`Bearer ${token}`), ENFORCED_ENV)).rejects.toMatchObject({
      status: 401,
    })
  })

  it('rejects an expired token', async () => {
    const token = await signHs256({ email: 'a@b.com', exp: Math.floor(Date.now() / 1000) - 60 }, HMAC_SECRET)
    await expect(requireMunshotUser(requestWithAuth(`Bearer ${token}`), ENFORCED_ENV)).rejects.toMatchObject({
      status: 401,
    })
  })

  it('rejects a request with no session at all — no guest fallback', async () => {
    await expect(requireMunshotUser(requestWithAuth(null), ENFORCED_ENV)).rejects.toMatchObject({ status: 401 })
  })

  it('rejects a valid signature whose issuer does not match', async () => {
    const env = { ...ENFORCED_ENV, MUNSHOT_JWT_ISSUER: 'https://expected.issuer' } as Env
    const token = await signHs256({ email: 'a@b.com', exp: future(), iss: 'https://other.issuer' }, HMAC_SECRET)
    await expect(requireMunshotUser(requestWithAuth(`Bearer ${token}`), env)).rejects.toMatchObject({ status: 401 })
  })

  it('rejects a valid signature whose audience does not match', async () => {
    const env = { ...ENFORCED_ENV, MUNSHOT_JWT_AUDIENCE: 'news-letter' } as Env
    const token = await signHs256({ email: 'a@b.com', exp: future(), aud: 'some-other-app' }, HMAC_SECRET)
    await expect(requireMunshotUser(requestWithAuth(`Bearer ${token}`), env)).rejects.toMatchObject({ status: 401 })
  })

  it('accepts a matching audience supplied as an array', async () => {
    const env = { ...ENFORCED_ENV, MUNSHOT_JWT_AUDIENCE: 'news-letter' } as Env
    const token = await signHs256({ email: 'a@b.com', exp: future(), aud: ['x', 'news-letter'] }, HMAC_SECRET)
    await expect(requireMunshotUser(requestWithAuth(`Bearer ${token}`), env)).resolves.toBe('a@b.com')
  })
})

describe('requireMunshotUser — mode 2: verified but permissive', () => {
  it('still guests a session-less caller', async () => {
    await expect(requireMunshotUser(requestWithAuth(null), VERIFIED_ENV)).resolves.toBe(GUEST_IDENTITY_EMAIL)
  })

  it('but still rejects a forged token when one IS supplied', async () => {
    await expect(
      requireMunshotUser(requestWithAuth(`Bearer ${fakeJwt({ email: 'victim@client.com' })}`), VERIFIED_ENV),
    ).rejects.toMatchObject({ status: 401 })
  })
})
