/* Cloudflare Worker entry (Workers + Static Assets model).

   Serves the built SPA from the ASSETS binding and handles the /api/* routes
   by reusing the exact same logic modules the Pages Functions used
   (functions/api/_lib/*) — nothing about generation, Buffer, email, or
   Discover changed; only the deploy target moved from Pages to Workers. */
import { configuredFlags, type Env as ApiEnv } from '../functions/api/_lib/env'
import { checkAuth, guard, json, preflight, readJson, type Ctx } from '../functions/api/_lib/http'
import { generateContent } from '../functions/api/_lib/anthropic'
import { publishToBuffer, listBufferChannels } from '../functions/api/_lib/buffer'
import { sendEmail } from '../functions/api/_lib/email'
import { searchPosts } from '../functions/api/_lib/discover'

type Env = ApiEnv & { ASSETS: { fetch: (req: Request) => Promise<Response> } }

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(request.url)

    // Everything that isn't /api/* is the SPA — hand it to the assets binding
    // (not_found_handling: single-page-application returns index.html for routes).
    if (!pathname.startsWith('/api/')) {
      return env.ASSETS.fetch(request)
    }

    if (request.method === 'OPTIONS') return preflight()
    const ctx: Ctx = { request, env }

    if (request.method === 'GET') {
      if (pathname === '/api/health') {
        return json({ ok: true, ...configuredFlags(env) })
      }
      if (pathname === '/api/buffer-channels') {
        return guard(async () => {
          const unauthorized = checkAuth(ctx)
          if (unauthorized) return unauthorized
          return json({ ok: true, ...(await listBufferChannels(env)) })
        })
      }
      return json({ error: 'Not found' }, 404)
    }

    if (request.method === 'POST') {
      const unauthorized = checkAuth(ctx)
      if (unauthorized) return unauthorized
      const body = await readJson(request)

      if (pathname === '/api/generate') {
        return guard(async () => {
          if (!body?.sourceText || !String(body.sourceText).trim()) {
            return json({ error: 'sourceText is required.' }, 400)
          }
          const content = await generateContent(env, {
            sourceText: String(body.sourceText),
            dashboardSnippet: body.dashboardSnippet ? String(body.dashboardSnippet) : undefined,
            tone: body.tone ? String(body.tone) : undefined,
          })
          return json({ ok: true, content })
        })
      }

      if (pathname === '/api/search-posts') {
        return guard(async () => {
          const posts = await searchPosts(env, {
            topic: body?.topic ? String(body.topic) : undefined,
            mode: body?.mode === 'creators' ? 'creators' : 'topic',
          })
          return json({ ok: true, posts })
        })
      }

      if (pathname === '/api/publish-linkedin') {
        return guard(async () => {
          if (!body?.text || !String(body.text).trim()) {
            return json({ error: 'text is required.' }, 400)
          }
          const result = await publishToBuffer(env, {
            text: String(body.text),
            imageUrl: body.imageUrl ? String(body.imageUrl) : undefined,
            scheduledAt: body.scheduledAt ? String(body.scheduledAt) : undefined,
          })
          return json({ ok: true, ...result })
        })
      }

      if (pathname === '/api/send-email') {
        return guard(async () => {
          let recipients: string[] = Array.isArray(body?.recipients)
            ? body.recipients.map((r: unknown) => String(r))
            : []
          if (!recipients.length && env.EMAIL_RECIPIENTS) {
            recipients = env.EMAIL_RECIPIENTS.split(/[,\n;]+/)
          }
          const result = await sendEmail(env, {
            subject: String(body?.subject || ''),
            html: String(body?.html || ''),
            recipients,
          })
          return json({ ok: true, ...result })
        })
      }

      return json({ error: 'Not found' }, 404)
    }

    return json({ error: 'Method not allowed' }, 405)
  },
}
