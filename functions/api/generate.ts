/* POST /api/generate — source text and/or screenshots (+ optional dashboard
   snippet) → LinkedIn + email copy. */
import { generateContent } from './_lib/anthropic'
import { sanitizeImages } from './_lib/llm'
import { checkAuth, guard, json, preflight, readJson, type Ctx } from './_lib/http'

export const onRequestOptions = () => preflight()

export const onRequestPost = (ctx: Ctx) =>
  guard(async () => {
    const unauthorized = checkAuth(ctx)
    if (unauthorized) return unauthorized

    const body = await readJson(ctx.request)
    const images = sanitizeImages(body?.images)
    const sourceText = body?.sourceText ? String(body.sourceText) : ''
    if (!sourceText.trim() && images.length === 0) {
      return json({ error: 'Provide sourceText or at least one image.' }, 400)
    }

    const content = await generateContent(ctx.env, {
      sourceText,
      dashboardSnippet: body.dashboardSnippet ? String(body.dashboardSnippet) : undefined,
      tone: body.tone ? String(body.tone) : undefined,
      images,
    })
    return json({ ok: true, content })
  })
