/* POST /api/topic-generate — a keyword → recent sourced news → a grounded
   LinkedIn caption (hook + emoji bullets + hashtags) + matching email. */
import { generateTopicPost } from './_lib/topicgen'
import { checkAuth, guard, json, preflight, readJson, type Ctx } from './_lib/http'

export const onRequestOptions = () => preflight()

export const onRequestPost = (ctx: Ctx) =>
  guard(async () => {
    const unauthorized = checkAuth(ctx)
    if (unauthorized) return unauthorized

    const body = await readJson(ctx.request)
    const { post, sources, topic } = await generateTopicPost(ctx.env, {
      topic: body?.topic ? String(body.topic) : '',
      tone: body?.tone ? String(body.tone) : undefined,
    })
    return json({ ok: true, post, sources, topic })
  })
