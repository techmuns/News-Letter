import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { handleScrapeRequest } from './src/lib/firecrawl.server'

/**
 * POST /api/scrape for `npm run dev`.
 *
 * The deployed app gets this route from functions/api/scrape.ts (Cloudflare
 * Pages); this middleware is the same handler mounted on the dev server so
 * local and production behave identically. Both read the key server-side —
 * it is never exposed to the browser, which is also why it is not a VITE_
 * variable.
 */
function firecrawlDevApi(apiKey?: string): Plugin {
  return {
    name: 'firecrawl-dev-api',
    configureServer(server) {
      server.middlewares.use('/api/scrape', (req, res) => {
        const send = (status: number, body: Record<string, unknown>) => {
          res.statusCode = status
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify(body))
        }

        if (req.method !== 'POST') {
          send(405, { error: 'Use POST.' })
          return
        }

        const chunks: Uint8Array[] = []
        req.on('data', (chunk: Uint8Array) => chunks.push(chunk))
        req.on('error', () => send(400, { error: 'Could not read the request body.' }))
        req.on('end', () => {
          void (async () => {
            // Join the chunks as bytes rather than per-chunk strings, so a
            // multi-byte character split across two chunks survives.
            const total = chunks.reduce((n, c) => n + c.length, 0)
            const merged = new Uint8Array(total)
            let offset = 0
            for (const c of chunks) {
              merged.set(c, offset)
              offset += c.length
            }

            let payload: unknown
            try {
              payload = JSON.parse(new TextDecoder().decode(merged) || '{}')
            } catch {
              send(400, { error: 'Expected a JSON body.' })
              return
            }

            const { status, body } = await handleScrapeRequest(apiKey, payload)
            send(status, body)
          })()
        })
      })
    },
  }
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Empty prefix so the un-prefixed FIRECRAWL_API_KEY is readable here. It is
  // deliberately NOT a VITE_ variable — that would inline it into client code.
  const env = loadEnv(mode, '.', '')
  return {
    plugins: [react(), firecrawlDevApi(env.FIRECRAWL_API_KEY)],
  }
})
