import { defineConfig, loadEnv, type Connect, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import {
  handleHarvest,
  handleRead,
  handleStatus,
  isRosterUrl,
  type Env,
} from './server/firecrawl'
import type { HarvestRequest, ReadRequest } from './shared/harvest'

/**
 * In production the /api routes are Cloudflare Pages Functions
 * (see functions/api/*). In `npm run dev` this middleware mounts the very
 * same handlers on the Vite server, so the app talks to one API contract
 * in both places — and the Firecrawl key stays server-side either way.
 */
function firecrawlApi(env: Env): Plugin {
  async function readBody<T>(req: Connect.IncomingMessage): Promise<T> {
    const chunks: string[] = []
    req.setEncoding('utf8')
    for await (const chunk of req) chunks.push(chunk as string)
    try {
      return JSON.parse(chunks.join('') || '{}') as T
    } catch {
      return {} as T
    }
  }

  return {
    name: 'munshot:firecrawl-api',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const path = (req.url ?? '').split('?')[0]
        if (!path.startsWith('/api/')) return next()

        const send = (body: unknown, status = 200) => {
          res.statusCode = status
          res.setHeader('Content-Type', 'application/json; charset=utf-8')
          res.setHeader('Cache-Control', 'no-store')
          res.end(JSON.stringify(body))
        }

        void (async () => {
          try {
            if (path === '/api/harvest' && req.method === 'GET') {
              return send(handleStatus(env))
            }
            if (path === '/api/harvest' && req.method === 'POST') {
              return send(await handleHarvest(env, await readBody<HarvestRequest>(req)))
            }
            if (path === '/api/read' && req.method === 'POST') {
              const { url } = await readBody<ReadRequest>(req)
              if (!url || !isRosterUrl(url)) {
                return send({ error: 'URL is not on the finance-voices roster' }, 400)
              }
              return send(await handleRead(env, url))
            }
            return send({ error: 'Not found' }, 404)
          } catch (err) {
            send({ error: err instanceof Error ? err.message : 'Unexpected error' }, 502)
          }
        })()
      })
    },
  }
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Read every key (prefix '') — FIRECRAWL_API_KEY is deliberately unprefixed
  // so it is never inlined into the client bundle.
  const fileEnv = loadEnv(mode, process.cwd(), '')
  const env: Env = {
    FIRECRAWL_API_KEY: process.env.FIRECRAWL_API_KEY || fileEnv.FIRECRAWL_API_KEY,
    FIRECRAWL_API_URL: process.env.FIRECRAWL_API_URL || fileEnv.FIRECRAWL_API_URL,
  }

  return { plugins: [react(), firecrawlApi(env)] }
})
