import { afterEach, describe, expect, it } from 'vitest'
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

/** Claims an algorithm but carries a bogus signature — what a forged token
    actually looks like once `alg: none` is refused outright. */
function forgedSignedJwt(payload: Record<string, unknown>): string {
  return `${base64Url({ alg: 'HS256', typ: 'JWT' })}.${base64Url(payload)}.bm90LWEtcmVhbC1zaWc`
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

describe('requireMunshotUser — verification by calling a Munshot API', () => {
  const VERIFY_URL = 'https://munshot.test/verify'
  const API_ENV = {
    MUNSHOT_VERIFY_URL: VERIFY_URL,
    MUNSHOT_REQUIRE_VERIFIED_SESSION: 'true',
  } as Env

  const originalFetch = globalThis.fetch
  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  /** Stubs fetch and records the Authorization header it was called with. */
  function stubMunshot(status: number) {
    const seen: string[] = []
    globalThis.fetch = (async (_url: any, init: any) => {
      seen.push(String(init?.headers?.authorization || ''))
      return new Response(status === 200 ? '{"ok":true}' : '{"error":"nope"}', { status })
    }) as typeof fetch
    return seen
  }

  it('accepts a token Munshot accepts, and forwards it as a bearer', async () => {
    const seen = stubMunshot(200)
    // Deliberately unsigned locally — Munshot's verdict is what counts here.
    const token = forgedSignedJwt({ email: 'client-a@corp.com', exp: future() })
    await expect(requireMunshotUser(requestWithAuth(`Bearer ${token}`), API_ENV)).resolves.toBe(
      'client-a@corp.com',
    )
    expect(seen[0]).toBe(`Bearer ${token}`)
  })

  it('REJECTS a token Munshot rejects with 401', async () => {
    stubMunshot(401)
    await expect(
      requireMunshotUser(requestWithAuth(`Bearer ${forgedSignedJwt({ email: 'victim@client.com' })}`), API_ENV),
    ).rejects.toMatchObject({ status: 401 })
  })

  it('rejects on 403 as well', async () => {
    stubMunshot(403)
    await expect(
      requireMunshotUser(requestWithAuth(`Bearer ${forgedSignedJwt({ email: 'victim@client.com' })}`), API_ENV),
    ).rejects.toMatchObject({ status: 401 })
  })

  it('does NOT treat a Munshot outage as a valid session', async () => {
    // A 500 upstream must surface as an error, never as an accepted login.
    stubMunshot(500)
    await expect(
      requireMunshotUser(requestWithAuth(`Bearer ${forgedSignedJwt({ email: 'a@b.com' })}`), API_ENV),
    ).rejects.toMatchObject({ status: 502 })
  })

  it('still rejects an expired token even when Munshot accepts it', async () => {
    stubMunshot(200)
    const expired = forgedSignedJwt({ email: 'a@b.com', exp: Math.floor(Date.now() / 1000) - 60 })
    await expect(requireMunshotUser(requestWithAuth(`Bearer ${expired}`), API_ENV)).rejects.toMatchObject({
      status: 401,
    })
  })

  it('rejects an unsigned "alg: none" token before any network call', async () => {
    let called = false
    globalThis.fetch = (async () => {
      called = true
      return new Response('{}', { status: 200 })
    }) as typeof fetch
    const noneToken = `${base64Url({ alg: 'none' })}.${base64Url({ email: 'a@b.com', exp: future() })}.`
    await expect(requireMunshotUser(requestWithAuth(`Bearer ${noneToken}`), API_ENV)).rejects.toMatchObject({
      status: 401,
    })
    expect(called).toBe(false)
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
