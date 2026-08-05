/* POST /api/generate — source text (+ optional dashboard snippet) → LinkedIn + email copy. */
import { generateContent } from './_lib/anthropic'
import { checkAuth, guard, json, preflight, readJson, type Ctx } from './_lib/http'

export const onRequestOptions = () => preflight()

export const onRequestPost = (ctx: Ctx) =>
  guard(async () => {
    const unauthorized = checkAuth(ctx)
    if (unauthorized) return unauthorized

    const body = await readJson(ctx.request)
    if (!body?.sourceText || !String(body.sourceText).trim()) {
      return json({ error: 'sourceText is required.' }, 400)
    }

    const content = await generateContent(ctx.env, {
      sourceText: String(body.sourceText),
      dashboardSnippet: body.dashboardSnippet ? String(body.dashboardSnippet) : undefined,
      tone: body.tone ? String(body.tone) : undefined,
    })
    return json({ ok: true, content })
  })
