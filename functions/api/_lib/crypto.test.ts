import { describe, expect, it } from 'vitest'
import { codeChallengeFromVerifier, decryptSecret, encryptSecret, generateCodeVerifier, generateState } from './crypto'
import type { Env } from './env'

// Fixed valid 32-byte keys (base64) for deterministic tests — never real secrets.
const TEST_KEY = 'AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE='
const OTHER_KEY = 'AgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgI='
const env = { TOKEN_ENCRYPTION_KEY: TEST_KEY } as Env

describe('encryptSecret / decryptSecret', () => {
  it('round-trips a plaintext token', async () => {
    const plaintext = 'buffer-access-token-abc123'
    const encrypted = await encryptSecret(env, plaintext)
    expect(encrypted).not.toContain(plaintext)
    expect(await decryptSecret(env, encrypted)).toBe(plaintext)
  })

  it('produces a different ciphertext each time (random IV)', async () => {
    const a = await encryptSecret(env, 'same-token')
    const b = await encryptSecret(env, 'same-token')
    expect(a).not.toBe(b)
  })

  it('fails to decrypt with the wrong key', async () => {
    const encrypted = await encryptSecret(env, 'secret')
    const wrongEnv = { TOKEN_ENCRYPTION_KEY: OTHER_KEY } as Env
    await expect(decryptSecret(wrongEnv, encrypted)).rejects.toThrow()
  })

  it('rejects a key that is not 32 bytes', async () => {
    const shortKeyEnv = { TOKEN_ENCRYPTION_KEY: 'dG9vc2hvcnQ=' } as Env
    await expect(encryptSecret(shortKeyEnv, 'x')).rejects.toThrow(/32 bytes/)
  })

  it('rejects when TOKEN_ENCRYPTION_KEY is unset', async () => {
    await expect(encryptSecret({} as Env, 'x')).rejects.toThrow(/TOKEN_ENCRYPTION_KEY/)
  })
})

describe('PKCE helpers', () => {
  it('generates a code_verifier within the RFC 7636 length range', () => {
    const verifier = generateCodeVerifier()
    expect(verifier.length).toBeGreaterThanOrEqual(43)
    expect(verifier.length).toBeLessThanOrEqual(128)
    expect(verifier).toMatch(/^[A-Za-z0-9_-]+$/) // base64url, no padding
  })

  it('derives a stable S256 code_challenge for a given verifier', async () => {
    const challenge1 = await codeChallengeFromVerifier('fixed-verifier-value')
    const challenge2 = await codeChallengeFromVerifier('fixed-verifier-value')
    expect(challenge1).toBe(challenge2)
    expect(challenge1).toMatch(/^[A-Za-z0-9_-]+$/)
  })

  it('generates different verifiers and states on each call', () => {
    expect(generateCodeVerifier()).not.toBe(generateCodeVerifier())
    expect(generateState()).not.toBe(generateState())
  })
})
