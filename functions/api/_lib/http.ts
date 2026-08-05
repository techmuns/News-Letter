/* Small HTTP helpers shared by every /api route (Cloudflare Pages Functions). */
import type { Env } from './env'

/** Minimal Pages-Function context shape (avoids a @cloudflare/workers-types dep). */
export interface Ctx {
  request: Request
  env: Env
  params?: Record<string, string>
}

/** Thrown by the lib layer; carries an HTTP status the route maps onto the response. */
export class ApiError extends Error {
  status: number
  constructor(message: string, status = 500) {
    super(message)
    this.status = status
  }
}

const CORS: Record<string, string> = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET,POST,OPTIONS',
  'access-control-allow-headers': 'content-type,x-app-secret',
}

export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...CORS },
  })
}

export function preflight(): Response {
  return new Response(null, { status: 204, headers: CORS })
}

/** Returns a 401 Response if a shared secret is configured and missing/wrong; else null. */
export function checkAuth(ctx: Ctx): Response | null {
  const required = ctx.env.APP_SECRET
  if (!required) return null // open in dev; SETUP.md recommends setting APP_SECRET in production
  const got = ctx.request.headers.get('x-app-secret')
  if (got !== required) {
    return json({ error: 'Unauthorized — set the app secret in Studio → Settings.' }, 401)
  }
  return null
}

export async function readJson<T = any>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T
  } catch {
    return {} as T
  }
}

/** Wraps a route body: maps ApiError → its status, everything else → 500. */
export async function guard(fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn()
  } catch (e) {
    const status = e instanceof ApiError ? e.status : 500
    return json({ error: (e as Error)?.message || 'Unexpected error' }, status)
  }
}
