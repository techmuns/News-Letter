/* POST /api/generate-article — expand a recorded post + email into a full
   long-form article. */
import { generateArticle } from './_lib/articlegen'
import { checkAuth, guard, json, preflight, readJson, type Ctx } from './_lib/http'

export const onRequestOptions = () => preflight()

export const onRequestPost = (ctx: Ctx) =>
  guard(async () => {
    const unauthorized = checkAuth(ctx)
    if (unauthorized) return unauthorized

    const body = await readJson(ctx.request)
    const article = await generateArticle(ctx.env, {
      title: body?.title ? String(body.title) : undefined,
      topic: body?.topic ? String(body.topic) : undefined,
      linkedin: body?.linkedin ? String(body.linkedin) : undefined,
      email: body?.email && typeof body.email === 'object' ? body.email : undefined,
      tone: body?.tone ? String(body.tone) : undefined,
    })
    return json({ ok: true, article })
  })
