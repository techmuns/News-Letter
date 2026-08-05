/* Auto-image hosting for Buffer posts.

   Buffer needs a PUBLIC image URL. We store the client-rendered branded PNG in
   Workers KV (the STORE binding) and serve it at /img/<id>, then hand that URL
   to the Buffer image-post call. Falls back gracefully (501) when KV isn't
   bound, so the deploy never breaks and the manual-URL field still works. */
import type { Env } from './env'
import { ApiError } from './http'

const MAX_BYTES = 3 * 1024 * 1024 // 3MB
const TTL_SECONDS = 60 * 60 * 24 * 30 // 30 days — auto-housekeeping

function newId(): string {
  return crypto.randomUUID().replace(/-/g, '')
}

/** Store image bytes in KV; returns the id to serve at /img/<id>. */
export async function putImage(
  env: Env,
  bytes: ArrayBuffer,
  contentType = 'image/png',
): Promise<string> {
  if (!env.STORE) {
    throw new ApiError('Image storage not configured — add the KV `STORE` binding (see SETUP.md).', 501)
  }
  if (!bytes.byteLength) throw new ApiError('Empty image.', 400)
  if (bytes.byteLength > MAX_BYTES) throw new ApiError('Image too large (max 3MB).', 413)
  const id = newId()
  await env.STORE.put(`img:${id}`, bytes, {
    expirationTtl: TTL_SECONDS,
    metadata: { contentType },
  })
  return id
}

/** Fetch a stored image, or null if missing / storage unavailable. */
export async function getImage(
  env: Env,
  id: string,
): Promise<{ bytes: ArrayBuffer; contentType: string } | null> {
  if (!env.STORE) return null
  if (!/^[a-f0-9]{16,40}$/i.test(id)) return null
  const res = await env.STORE.getWithMetadata(`img:${id}`, { type: 'arrayBuffer' })
  if (!res || !res.value) return null
  const contentType = (res.metadata as any)?.contentType || 'image/png'
  return { bytes: res.value as ArrayBuffer, contentType }
}
