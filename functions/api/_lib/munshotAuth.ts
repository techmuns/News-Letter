/* Identifies "the authenticated user" for the Buffer OAuth feature from the
   Munshot host JWT (the same token the frontend receives from the Munshot
   Dashboard SDK — see src/lib/sdk.ts) forwarded as `Authorization: Bearer`.

   ⚠️ KNOWN GAP — decodeMunshotEmail does NOT verify the JWT's signature. It
   only base64-decodes the payload and reads the `email` claim. This was a
   deliberate, explicit call for now: the app has no way yet to verify a
   Munshot-issued JWT server-side (no JWKS/public key, no introspection
   endpoint, no shared secret has been wired up). That means, as it stands,
   anyone who can reach these endpoints can claim to be any email address and
   read/write that email's Buffer connection — there is no real per-user
   isolation yet, only per-*claimed-email* separation.

   Before this is safe for real multi-tenant use, close this gap by verifying
   the token server-side (signature + iss/aud/exp) against whatever Munshot
   publishes for that purpose, then swap the body of decodeMunshotEmail for a
   verified decode. Everything downstream (buffer.ts, bufferAccounts.ts,
   worker/index.ts) already treats "email" as the trust boundary, so closing
   this one function closes the gap everywhere at once. */
import { ApiError } from './http'

function base64UrlDecodeToString(segment: string): string {
  const padded = segment.replace(/-/g, '+').replace(/_/g, '/')
  const withPadding = padded + '='.repeat((4 - (padded.length % 4)) % 4)
  return atob(withPadding)
}

/** Reads the `email` claim out of a JWT's payload without checking its
    signature. Returns null if the header is missing, malformed, or the
    payload has no plausible email. See the file-level ⚠️ above. */
export function decodeMunshotEmail(request: Request): string | null {
  const header = request.headers.get('authorization') || ''
  const match = header.match(/^Bearer\s+(.+)$/i)
  if (!match) return null
  const token = match[1].trim()
  const parts = token.split('.')
  if (parts.length < 2) return null
  try {
    const claims = JSON.parse(base64UrlDecodeToString(parts[1]))
    const email = typeof claims?.email === 'string' ? claims.email.trim().toLowerCase() : null
    return email && email.includes('@') ? email : null
  } catch {
    return null
  }
}

/** Guard for every Buffer OAuth route: returns the caller's email or throws
    a 401 ApiError (catch it the same way as any other route error via `guard`). */
export function requireMunshotUser(request: Request): string {
  const email = decodeMunshotEmail(request)
  if (!email) {
    throw new ApiError(
      'Missing or invalid Munshot session — open this from inside the Munshot dashboard and try again.',
      401,
    )
  }
  return email
}
