// Cloudflare Pages Function — runs on every request, before any route or
// static asset. Gates the whole site behind a single shared password.
//
// Inert until SITE_PASSWORD is set (Pages project → Settings → Environment
// variables) so pushing this file can't lock anyone out by accident — the
// gate only turns on once the secret is configured.
export async function onRequest({ request, next, env }) {
  const password = env.SITE_PASSWORD
  if (!password) return next()

  const auth = request.headers.get('Authorization')
  if (auth?.startsWith('Basic ')) {
    const decoded = atob(auth.slice(6))
    const providedPassword = decoded.slice(decoded.indexOf(':') + 1)
    if (providedPassword === password) return next()
  }

  return new Response('Authentication required', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="Munshot Content System"' },
  })
}
