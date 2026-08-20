/* AES-256-GCM encryption for tokens at rest, plus OAuth PKCE/state helpers.
   Uses the Workers-native Web Crypto API (`crypto.subtle`) — no dependency. */
import type { Env } from './env'
import { ApiError } from './http'

const IV_LENGTH = 12 // bytes, standard for AES-GCM

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary)
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

function base64UrlEncode(bytes: Uint8Array): string {
  return bytesToBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

async function importEncryptionKey(env: Env): Promise<CryptoKey> {
  if (!env.TOKEN_ENCRYPTION_KEY) {
    throw new ApiError('TOKEN_ENCRYPTION_KEY is not set (see SETUP.md — Buffer OAuth setup).', 500)
  }
  let raw: Uint8Array
  try {
    raw = base64ToBytes(env.TOKEN_ENCRYPTION_KEY)
  } catch {
    throw new ApiError('TOKEN_ENCRYPTION_KEY is not valid base64.', 500)
  }
  if (raw.length !== 32) {
    throw new ApiError('TOKEN_ENCRYPTION_KEY must decode to exactly 32 bytes (AES-256).', 500)
  }
  return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt'])
}

/** Encrypts a secret (a Buffer access/refresh token) for storage. Output is a
    single base64 string: IV followed by ciphertext. Never log the input or
    output of this function. */
export async function encryptSecret(env: Env, plaintext: string): Promise<string> {
  const key = await importEncryptionKey(env)
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH))
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(plaintext))
  const combined = new Uint8Array(iv.length + ciphertext.byteLength)
  combined.set(iv, 0)
  combined.set(new Uint8Array(ciphertext), iv.length)
  return bytesToBase64(combined)
}

/** Inverse of encryptSecret. Throws if the ciphertext was tampered with or
    the key is wrong (AES-GCM's auth tag fails to verify). */
export async function decryptSecret(env: Env, encoded: string): Promise<string> {
  const key = await importEncryptionKey(env)
  const combined = base64ToBytes(encoded)
  if (combined.length <= IV_LENGTH) throw new ApiError('Stored Buffer token is corrupt.', 500)
  const iv = combined.slice(0, IV_LENGTH)
  const ciphertext = combined.slice(IV_LENGTH)
  try {
    const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext)
    return new TextDecoder().decode(plaintext)
  } catch {
    throw new ApiError('Stored Buffer token could not be decrypted.', 500)
  }
}

/** A PKCE code_verifier: 32 random bytes, base64url — 43 chars, within the
    RFC 7636 43-128 char range. */
export function generateCodeVerifier(): string {
  return base64UrlEncode(crypto.getRandomValues(new Uint8Array(32)))
}

/** S256 code_challenge derived from a code_verifier, per RFC 7636. */
export async function codeChallengeFromVerifier(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))
  return base64UrlEncode(new Uint8Array(digest))
}

/** Random CSRF-protection value for the OAuth `state` param. */
export function generateState(): string {
  return base64UrlEncode(crypto.getRandomValues(new Uint8Array(24)))
}
