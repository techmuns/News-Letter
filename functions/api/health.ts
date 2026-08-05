/* GET /api/health — reports which integrations are wired (booleans only).
   Powers the connection-status panel; never returns secret values. */
import { configuredFlags } from './_lib/env'
import { json, preflight, type Ctx } from './_lib/http'

export const onRequestOptions = () => preflight()
export const onRequestGet = (ctx: Ctx) => json({ ok: true, ...configuredFlags(ctx.env) })
