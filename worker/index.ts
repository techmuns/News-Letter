/* Cloudflare Worker entry (Workers + Static Assets model).

   Serves the built SPA from the ASSETS binding, hosts uploaded post images at
   /img/<id>, and handles /api/* by reusing the same logic modules the Pages
   Functions used (functions/api/_lib/*). Generation, Buffer, and email logic
   are unchanged; the content source is the Daily Pulse feed. */
import { configuredFlags, type Env as ApiEnv } from '../functions/api/_lib/env'
import { checkAuth, guard, json, preflight, readJson, type Ctx } from '../functions/api/_lib/http'
import { generateContent } from '../functions/api/_lib/anthropic'
import { generatePulsePost } from '../functions/api/_lib/pulsegen'
import { generateTopicPost } from '../functions/api/_lib/topicgen'
import { publishToBuffer, listBufferChannels } from '../functions/api/_lib/buffer'
import { sendEmail } from '../functions/api/_lib/email'
import { fetchDailyPulse } from '../functions/api/_lib/dailypulse'
import { putImage, getImage } from '../functions/api/_lib/images'

type Env = ApiEnv & { ASSETS: { fetch: (req: Request) => Promise<Response> } }

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(request.url)

    // Public image route — Buffer fetches these when publishing.
    if (pathname.startsWith('/img/')) {
      const img = await getImage(env, pathname.slice('/img/'.length))
      if (!img) return new Response('Not found', { status: 404 })
      return new Response(img.bytes, {
        headers: {
          'content-type': img.contentType,
          'cache-control': 'public, max-age=31536000, immutable',
          'access-control-allow-origin': '*',
        },
      })
    }

    // Everything that isn't /api/* is the SPA (index.html via not_found_handling).
    if (!pathname.startsWith('/api/')) {
      return env.ASSETS.fetch(request)
    }

    if (request.method === 'OPTIONS') return preflight()
    const ctx: Ctx = { request, env }

    if (request.method === 'GET') {
      if (pathname === '/api/health') {
        return json({ ok: true, ...configuredFlags(env) })
      }
      if (pathname === '/api/daily-pulse') {
        return guard(async () => json({ ok: true, ...(await fetchDailyPulse(env)) }))
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

      // Binary upload — read the body as bytes, not JSON.
      if (pathname === '/api/upload-image') {
        return guard(async () => {
          const ct = request.headers.get('content-type') || 'image/png'
          const bytes = await request.arrayBuffer()
          const id = await putImage(env, bytes, ct.startsWith('image/') ? ct : 'image/png')
          // Absolute URL so Buffer can fetch it; path kept for same-origin preview.
          const origin = new URL(request.url).origin
          return json({ ok: true, url: `${origin}/img/${id}`, path: `/img/${id}` })
        })
      }

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

      if (pathname === '/api/pulse-generate') {
        return guard(async () => {
          const { post, fetchedAt } = await generatePulsePost(env, {
            focusId: body?.focusId ? String(body.focusId) : undefined,
            tone: body?.tone ? String(body.tone) : undefined,
          })
          return json({ ok: true, post, fetchedAt })
        })
      }

      if (pathname === '/api/topic-generate') {
        return guard(async () => {
          const { post, sources, topic } = await generateTopicPost(env, {
            topic: body?.topic ? String(body.topic) : '',
            tone: body?.tone ? String(body.tone) : undefined,
          })
          return json({ ok: true, post, sources, topic })
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
