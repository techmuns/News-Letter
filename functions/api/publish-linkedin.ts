/* POST /api/publish-linkedin — push a post to the Munshot LinkedIn page via Buffer.
   Body: { text: string, imageUrl?: string, scheduledAt?: string (ISO-8601 UTC) } */
import { publishToBuffer } from './_lib/buffer'
import { checkAuth, guard, json, preflight, readJson, type Ctx } from './_lib/http'

export const onRequestOptions = () => preflight()

export const onRequestPost = (ctx: Ctx) =>
  guard(async () => {
    const unauthorized = checkAuth(ctx)
    if (unauthorized) return unauthorized

    const body = await readJson(ctx.request)
    if (!body?.text || !String(body.text).trim()) {
      return json({ error: 'text is required.' }, 400)
    }

    const result = await publishToBuffer(ctx.env, {
      text: String(body.text),
      imageUrl: body.imageUrl ? String(body.imageUrl) : undefined,
      scheduledAt: body.scheduledAt ? String(body.scheduledAt) : undefined,
    })
    return json({ ok: true, ...result })
  })
