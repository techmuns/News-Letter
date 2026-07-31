/* Thin client for the Firecrawl-backed /api routes.
   The key never reaches here — the browser only ever sees normalised posts. */

import type {
  HarvestRequest,
  HarvestResponse,
  HarvestStatus,
  ReadResponse,
} from '../../shared/harvest'

async function asJson<T>(res: Response): Promise<T> {
  const text = await res.text()
  let body: unknown
  try {
    body = text ? JSON.parse(text) : {}
  } catch {
    throw new Error(
      res.ok
        ? 'The /api route returned something that is not JSON.'
        : `Request failed (HTTP ${res.status}).`,
    )
  }
  if (!res.ok) {
    const message =
      body && typeof body === 'object' && 'error' in body && typeof body.error === 'string'
        ? body.error
        : `Request failed (HTTP ${res.status}).`
    throw new Error(message)
  }
  return body as T
}

/** Is a Firecrawl key configured server-side? */
export async function fetchHarvestStatus(): Promise<HarvestStatus> {
  return asJson<HarvestStatus>(await fetch('/api/harvest'))
}

/** Scrape the selected voices for their latest real posts. */
export async function runHarvest(req: HarvestRequest): Promise<HarvestResponse> {
  return asJson<HarvestResponse>(
    await fetch('/api/harvest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
    }),
  )
}

/** Deep-read one harvested post so the generator works from its full text. */
export async function readPost(url: string): Promise<ReadResponse> {
  return asJson<ReadResponse>(
    await fetch('/api/read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    }),
  )
}
