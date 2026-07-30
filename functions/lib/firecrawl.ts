/**
 * Firecrawl v2 /scrape — https://docs.firecrawl.dev/api-reference/endpoint/scrape
 * Turns a URL into clean markdown so it can feed the content-generation step.
 */

const FIRECRAWL_SCRAPE_URL = 'https://api.firecrawl.dev/v2/scrape'

export interface ScrapedPage {
  url: string
  title?: string
  markdown: string
}

export class FirecrawlError extends Error {}

export async function scrapeUrl(url: string, apiKey: string): Promise<ScrapedPage> {
  const res = await fetch(FIRECRAWL_SCRAPE_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      url,
      formats: [{ type: 'markdown' }],
    }),
  })

  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new FirecrawlError(`Firecrawl scrape failed (${res.status}): ${detail.slice(0, 300)}`)
  }

  const json = (await res.json()) as {
    success?: boolean
    data?: { markdown?: string; metadata?: { title?: string | string[] } }
  }

  if (!json.success || !json.data?.markdown) {
    throw new FirecrawlError(`Firecrawl returned no content for ${url}`)
  }

  const rawTitle = json.data.metadata?.title
  const title = Array.isArray(rawTitle) ? rawTitle[0] : rawTitle

  return { url, title, markdown: json.data.markdown }
}
