/* POST /api/pulse-generate — today's Daily Pulse feed → LinkedIn caption
   (hook + emoji bullets + hashtags) + matching email. */
import { generatePulsePost } from './_lib/pulsegen'
import { checkAuth, guard, json, preflight, readJson, type Ctx } from './_lib/http'

export const onRequestOptions = () => preflight()

export const onRequestPost = (ctx: Ctx) =>
  guard(async () => {
    const unauthorized = checkAuth(ctx)
    if (unauthorized) return unauthorized

    const body = await readJson(ctx.request)
    const { post, fetchedAt } = await generatePulsePost(ctx.env, {
      focusId: body?.focusId ? String(body.focusId) : undefined,
      tone: body?.tone ? String(body.tone) : undefined,
    })
    return json({ ok: true, post, fetchedAt })
  })
