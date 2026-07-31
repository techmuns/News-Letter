/* Small HTTP helpers shared by the Cloudflare Pages Functions and the
   Vite dev middleware, so both expose exactly the same /api surface. */

import type { Env } from './firecrawl'

/** Minimal shape of a Pages Function context — avoids a workers-types dep. */
export interface PagesContext {
  request: Request
  env: Env
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      // Harvests are per-request and key-dependent — never cache at the edge.
      'Cache-Control': 'no-store',
    },
  })
}

export function errorJson(err: unknown, status = 502): Response {
  const message = err instanceof Error ? err.message : 'Unexpected error'
  return json({ error: message }, status)
}

export async function readJsonBody<T>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T
  } catch {
    return {} as T
  }
}
