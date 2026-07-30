/**
 * Cloudflare Pages Function — POST /api/turn-into-content
 *
 * Real "Turn into content" pipeline: Firecrawl scrapes any linked sources,
 * Genspark drafts the LinkedIn/Email/Article versions from the combined
 * material. Keys stay server-side (Pages secrets), never reach the browser.
 */
import { scrapeUrl, FirecrawlError } from '../lib/firecrawl'
import { generateDrafts, GensparkError, type GeneratedDrafts } from '../lib/genspark'

interface Env {
  FIRECRAWL_API_KEY?: string
  GENSPARK_API_KEY?: string
}

interface SourceItem {
  id: string
  type: string
  title: string
  preview: string
  sourceUrl?: string
}

interface RequestBody {
  items: SourceItem[]
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

async function buildSourceText(items: SourceItem[], firecrawlKey?: string): Promise<string> {
  const parts = await Promise.all(
    items.map(async (item) => {
      if (item.sourceUrl) {
        if (!firecrawlKey) {
          return `# ${item.title}\n(link, not crawled — no Firecrawl key configured): ${item.sourceUrl}`
        }
        try {
          const page = await scrapeUrl(item.sourceUrl, firecrawlKey)
          return `# ${page.title ?? item.title}\nSource: ${item.sourceUrl}\n\n${page.markdown}`
        } catch (err) {
          const message = err instanceof FirecrawlError ? err.message : String(err)
          return `# ${item.title}\n(Firecrawl scrape failed for ${item.sourceUrl}: ${message})`
        }
      }
      return `# ${item.title}\n${item.preview}`
    }),
  )
  return parts.join('\n\n---\n\n')
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context

  if (!env.GENSPARK_API_KEY) {
    return jsonResponse({ error: 'missing_config', message: 'GENSPARK_API_KEY is not configured' }, 501)
  }

  let body: RequestBody
  try {
    body = await request.json()
  } catch {
    return jsonResponse({ error: 'bad_request', message: 'Invalid JSON body' }, 400)
  }

  if (!Array.isArray(body.items) || body.items.length === 0) {
    return jsonResponse({ error: 'bad_request', message: 'items must be a non-empty array' }, 400)
  }

  const sourceText = await buildSourceText(body.items, env.FIRECRAWL_API_KEY)

  let drafts: GeneratedDrafts
  try {
    drafts = await generateDrafts(sourceText, env.GENSPARK_API_KEY)
  } catch (err) {
    const message = err instanceof GensparkError ? err.message : String(err)
    return jsonResponse({ error: 'genspark_failed', message }, 502)
  }

  return jsonResponse(drafts)
}
