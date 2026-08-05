/* GET /api/buffer-channels — convenience helper to find your LinkedIn channel id. */
import { listBufferChannels } from './_lib/buffer'
import { checkAuth, guard, json, preflight, type Ctx } from './_lib/http'

export const onRequestOptions = () => preflight()

export const onRequestGet = (ctx: Ctx) =>
  guard(async () => {
    const unauthorized = checkAuth(ctx)
    if (unauthorized) return unauthorized
    const result = await listBufferChannels(ctx.env)
    return json({ ok: true, ...result })
  })
