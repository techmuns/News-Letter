/* Live stock/company search via the Munshot backend (devde.muns.io).

   Proxied server-side so MUNS_ACCESS_TOKEN never reaches the browser. The
   upstream returns results keyed by ticker with [country, name, sector] tuples;
   we flatten that into a simple list for the Focus search bar. */
import type { Env } from './env'
import { ApiError } from './http'

const ENDPOINT = 'https://devde.muns.io/stock/search'
const USER_INDEX = 124 // static, per spec

export interface StockResult {
  symbol: string
  name: string
  country: string
  sector: string
}

export async function searchStocks(
  env: Env,
  query: string,
): Promise<{ total: number; results: StockResult[] }> {
  if (!env.MUNS_ACCESS_TOKEN) {
    throw new ApiError('Stock search is not configured (set MUNS_ACCESS_TOKEN).', 400)
  }
  const q = (query || '').trim()
  if (!q) return { total: 0, results: [] }

  let res: Response
  try {
    res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${env.MUNS_ACCESS_TOKEN}`,
        'content-type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify({ query: q, user_index: USER_INDEX }),
    })
  } catch {
    throw new ApiError('Could not reach stock search.', 502)
  }
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new ApiError(
      `Stock search failed (${res.status}). ${body.replace(/\s+/g, ' ').slice(0, 200)}`.trim(),
      502,
    )
  }

  const data: any = await res.json().catch(() => null)
  const raw = data?.data?.results
  const results: StockResult[] = []
  if (raw && typeof raw === 'object') {
    for (const [symbol, tuple] of Object.entries(raw)) {
      const a = Array.isArray(tuple) ? tuple : []
      results.push({
        symbol: String(symbol || ''),
        country: String(a[0] || ''),
        name: String(a[1] || ''),
        sector: String(a[2] || ''),
      })
    }
  }
  const total = Number(data?.data?.total_results)
  return { total: Number.isFinite(total) ? total : results.length, results }
}
