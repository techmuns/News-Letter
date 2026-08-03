/* ============================================================
   POST /api/scrape — Cloudflare Pages Function (production).

   Pages Functions are matched before _redirects, so the SPA
   catch-all in public/_redirects does not shadow this route.

   The Firecrawl key lives here as a Pages environment variable and
   is never sent to the browser. The client only ever sees the
   scraped result.

   One `onRequest` handling every method, rather than onRequestPost
   plus a fallback — the precedence between the two is a detail not
   worth depending on.
   ============================================================ */

import { handleScrapeRequest } from '../../src/lib/firecrawl.server'

interface Env {
  FIRECRAWL_API_KEY?: string
}

function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

export async function onRequest(context: { request: Request; env: Env }): Promise<Response> {
  if (context.request.method !== 'POST') {
    return json(405, { error: 'Use POST.' })
  }

  let payload: unknown
  try {
    payload = await context.request.json()
  } catch {
    return json(400, { error: 'Expected a JSON body.' })
  }

  const { status, body } = await handleScrapeRequest(context.env.FIRECRAWL_API_KEY, payload)
  return json(status, body)
}
