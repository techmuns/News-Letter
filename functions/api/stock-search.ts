/* POST /api/stock-search — proxy the Munshot stock/company search
   (keeps MUNS_ACCESS_TOKEN server-side). Body: { query }. */
import { searchStocks } from './_lib/stocksearch'
import { checkAuth, guard, json, preflight, readJson, type Ctx } from './_lib/http'

export const onRequestOptions = () => preflight()

export const onRequestPost = (ctx: Ctx) =>
  guard(async () => {
    const unauthorized = checkAuth(ctx)
    if (unauthorized) return unauthorized

    const body = await readJson(ctx.request)
    const out = await searchStocks(ctx.env, body?.query ? String(body.query) : '')
    return json({ ok: true, ...out })
  })
