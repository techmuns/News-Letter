/* Cloudflare Worker entry (Workers + Static Assets model).

   Serves the built SPA from the ASSETS binding, hosts uploaded post images at
   /img/<id>, and handles /api/* by reusing the same logic modules the Pages
   Functions used (functions/api/_lib/*). Generation, Buffer, and email logic
   are unchanged; the content source is the Daily Pulse feed. */
import { configuredFlags, type Env as ApiEnv } from '../functions/api/_lib/env'
import { checkAuth, guard, json, preflight, readJson, type Ctx } from '../functions/api/_lib/http'
import { generateContent } from '../functions/api/_lib/anthropic'
import { sanitizeImages } from '../functions/api/_lib/llm'
import { generateArticle } from '../functions/api/_lib/articlegen'
import { searchStocks } from '../functions/api/_lib/stocksearch'
import { generatePulsePost } from '../functions/api/_lib/pulsegen'
import { generateTopicPost } from '../functions/api/_lib/topicgen'
import { publishToBuffer, listBufferChannels, fetchBufferOrganizations, fetchBufferChannels, createBufferPost } from '../functions/api/_lib/buffer'
import { sendEmail } from '../functions/api/_lib/email'
import { fetchDailyPulse } from '../functions/api/_lib/dailypulse'
import { putImage, getImage } from '../functions/api/_lib/images'
import { requireMunshotUser } from '../functions/api/_lib/munshotAuth'
import { generateCodeVerifier, codeChallengeFromVerifier, generateState } from '../functions/api/_lib/crypto'
import { buildAuthorizeUrl, exchangeCodeForToken, saveOAuthState, consumeOAuthState } from '../functions/api/_lib/bufferOAuth'
import {
  getConnectionSummary,
  saveTokens,
  saveSelectedChannel,
  disconnect as disconnectBuffer,
  getValidAccessToken,
} from '../functions/api/_lib/bufferAccounts'
import { ApiError } from '../functions/api/_lib/http'

type Env = ApiEnv & { ASSETS: { fetch: (req: Request) => Promise<Response> } }

/** GET /api/auth/buffer/callback — a real browser navigation from Buffer, so
    (unlike every other route here) it can't carry an Authorization header and
    always resolves to a redirect back into the SPA rather than a JSON body,
    even on failure. Never logs the code/verifier/tokens involved. */
async function handleBufferOAuthCallback(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const oauthError = url.searchParams.get('error')
  const backTo = (query: string) => Response.redirect(`${url.origin}/channels?${query}`, 302)

  if (oauthError) return backTo(`buffer=error&reason=${encodeURIComponent(oauthError)}`)
  if (!code || !state) return backTo('buffer=error&reason=missing_code_or_state')

  const pending = await consumeOAuthState(env, state)
  if (!pending) return backTo('buffer=error&reason=invalid_or_expired_state')

  try {
    const tokens = await exchangeCodeForToken(env, { code, codeVerifier: pending.codeVerifier })
    await saveTokens(env, pending.email, {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresIn: tokens.expires_in,
      scope: tokens.scope,
    })
    return backTo('buffer=connected')
  } catch (e) {
    console.error('[buffer-oauth] token exchange failed:', (e as Error)?.message)
    return backTo('buffer=error&reason=token_exchange_failed')
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    const { pathname } = url

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

      // --- Buffer OAuth ("Connect Buffer") ---
      if (pathname === '/api/auth/buffer') {
        // Fetch-based kickoff (not a raw navigation) so the Munshot session
        // can be sent as a normal Authorization header; the frontend does the
        // actual browser redirect once it gets `authorizeUrl` back.
        return guard(async () => {
          const unauthorized = checkAuth(ctx)
          if (unauthorized) return unauthorized
          const email = await requireMunshotUser(request, env)
          const codeVerifier = generateCodeVerifier()
          const codeChallenge = await codeChallengeFromVerifier(codeVerifier)
          const state = generateState()
          await saveOAuthState(env, { state, email, codeVerifier })
          const authorizeUrl = buildAuthorizeUrl(env, { state, codeChallenge })
          return json({ ok: true, authorizeUrl })
        })
      }
      if (pathname === '/api/auth/buffer/callback') {
        return handleBufferOAuthCallback(request, env)
      }
      if (pathname === '/api/buffer/organizations') {
        return guard(async () => {
          const unauthorized = checkAuth(ctx)
          if (unauthorized) return unauthorized
          const email = await requireMunshotUser(request, env)
          const token = await getValidAccessToken(env, email)
          const organizations = await fetchBufferOrganizations(token)
          return json({ ok: true, organizations })
        })
      }
      if (pathname === '/api/buffer/channels') {
        return guard(async () => {
          const unauthorized = checkAuth(ctx)
          if (unauthorized) return unauthorized
          const email = await requireMunshotUser(request, env)
          const organizationId = url.searchParams.get('organizationId') || ''
          if (!organizationId) throw new ApiError('organizationId query param is required.', 400)
          const token = await getValidAccessToken(env, email)
          const channels = await fetchBufferChannels(token, organizationId)
          return json({ ok: true, organizationId, channels })
        })
      }
      if (pathname === '/api/buffer/connection') {
        return guard(async () => {
          const unauthorized = checkAuth(ctx)
          if (unauthorized) return unauthorized
          const email = await requireMunshotUser(request, env)
          const connection = await getConnectionSummary(env, email)
          return json({
            ok: true,
            connection: connection ?? {
              status: 'disconnected',
              organizationId: null,
              channelId: null,
              channelName: null,
              channelService: null,
              longLived: false,
            },
          })
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

      if (pathname === '/api/stock-search') {
        return guard(async () => {
          const out = await searchStocks(env, body?.query ? String(body.query) : '')
          return json({ ok: true, ...out })
        })
      }

      if (pathname === '/api/generate') {
        return guard(async () => {
          const images = sanitizeImages(body?.images)
          const sourceText = body?.sourceText ? String(body.sourceText) : ''
          if (!sourceText.trim() && images.length === 0) {
            return json({ error: 'Provide sourceText or at least one image.' }, 400)
          }
          const content = await generateContent(env, {
            sourceText,
            dashboardSnippet: body.dashboardSnippet ? String(body.dashboardSnippet) : undefined,
            tone: body.tone ? String(body.tone) : undefined,
            images,
          })
          return json({ ok: true, content })
        })
      }

      if (pathname === '/api/generate-article') {
        return guard(async () => {
          const article = await generateArticle(env, {
            title: body?.title ? String(body.title) : undefined,
            topic: body?.topic ? String(body.topic) : undefined,
            linkedin: body?.linkedin ? String(body.linkedin) : undefined,
            email: body?.email && typeof body.email === 'object' ? body.email : undefined,
            tone: body?.tone ? String(body.tone) : undefined,
          })
          return json({ ok: true, article })
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

      if (pathname === '/api/buffer/select-channel') {
        return guard(async () => {
          const email = await requireMunshotUser(request, env)
          const organizationId = body?.organizationId ? String(body.organizationId) : ''
          const channelId = body?.channelId ? String(body.channelId) : ''
          if (!organizationId || !channelId) {
            return json({ error: 'organizationId and channelId are required.' }, 400)
          }
          const token = await getValidAccessToken(env, email)
          // Re-fetch this org's channels server-side and require the chosen
          // id to actually be one of them — never trust a channelId the
          // client claims belongs to this user's organization.
          const channels = await fetchBufferChannels(token, organizationId)
          const match = channels.find((c) => c.id === channelId)
          if (!match) return json({ error: 'That channel was not found in your Buffer organization.' }, 404)
          await saveSelectedChannel(env, email, {
            organizationId,
            channelId,
            channelName: match.displayName || match.name || null,
            channelService: match.service,
          })
          return json({ ok: true, channel: match })
        })
      }

      if (pathname === '/api/buffer/posts') {
        return guard(async () => {
          const email = await requireMunshotUser(request, env)
          if (!body?.text || !String(body.text).trim()) {
            return json({ error: 'text is required.' }, 400)
          }
          const connection = await getConnectionSummary(env, email)
          if (!connection || connection.status !== 'connected' || !connection.channelId) {
            return json({ error: 'Connect a LinkedIn channel via Buffer first.' }, 409)
          }
          const token = await getValidAccessToken(env, email)
          const result = await createBufferPost(token, {
            channelId: connection.channelId,
            text: String(body.text),
            imageUrl: body.imageUrl ? String(body.imageUrl) : undefined,
            scheduledAt: body.scheduledAt ? String(body.scheduledAt) : undefined,
            postNow: Boolean(body.postNow),
          })
          return json({ ok: true, ...result })
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

    if (request.method === 'DELETE') {
      const unauthorized = checkAuth(ctx)
      if (unauthorized) return unauthorized

      if (pathname === '/api/buffer/disconnect') {
        return guard(async () => {
          const email = await requireMunshotUser(request, env)
          await disconnectBuffer(env, email)
          return json({ ok: true })
        })
      }

      return json({ error: 'Not found' }, 404)
    }

    return json({ error: 'Method not allowed' }, 405)
  },
}
