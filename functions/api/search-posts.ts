/* POST /api/search-posts — Discover step: find public LinkedIn finance posts.
   Body: { topic?: string, mode?: 'topic' | 'creators' } → { posts: DiscoveredPost[] } */
import { searchPosts } from './_lib/discover'
import { checkAuth, guard, json, preflight, readJson, type Ctx } from './_lib/http'

export const onRequestOptions = () => preflight()

export const onRequestPost = (ctx: Ctx) =>
  guard(async () => {
    const unauthorized = checkAuth(ctx)
    if (unauthorized) return unauthorized

    const body = await readJson(ctx.request)
    const posts = await searchPosts(ctx.env, {
      topic: body?.topic ? String(body.topic) : undefined,
      mode: body?.mode === 'creators' ? 'creators' : 'topic',
    })
    return json({ ok: true, posts })
  })
