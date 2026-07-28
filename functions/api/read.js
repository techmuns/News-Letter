// Cloudflare Pages Function — server-side article reader.
//
// A browser can't fetch most news pages or filing portals: without a
// permissive CORS header the response body is unreadable, however public the
// page is. This route fetches the page from the edge instead and hands back the
// text, so a pasted link becomes material the generator can actually quote.
//
// It only ever returns text it received. There is no summarising here — the
// playbook's rule is that a claim carries its source, so what the composer
// quotes has to be a verbatim span of the page.

const MAX_BYTES = 3_000_000
const MAX_CHARS = 200_000

/** Blocks the obvious internal targets so this can't be used to probe a network. */
function isPublicHttpUrl(raw) {
  let u
  try {
    u = new URL(raw)
  } catch {
    return false
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return false
  const host = u.hostname.toLowerCase()
  if (
    host === 'localhost' ||
    host === '0.0.0.0' ||
    host.endsWith('.localhost') ||
    host.endsWith('.internal') ||
    host.endsWith('.local') ||
    /^127\./.test(host) ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^169\.254\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
    host === '[::1]'
  ) {
    return false
  }
  return true
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      // Same-origin only — this is our reader, not an open proxy.
      'Cache-Control': 'public, max-age=300',
    },
  })
}

/** Drops the chrome, then keeps the paragraphs. Mirrors src/lib/extract.ts. */
function readableText(html) {
  let s = html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(script|style|noscript|svg|template)[\s\S]*?<\/\1>/gi, '')
    .replace(/<(nav|header|footer|aside|form)[\s\S]*?<\/\1>/gi, '')

  const titleMatch =
    s.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i) ||
    s.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  const title = titleMatch ? decode(titleMatch[1]).replace(/\s+/g, ' ').trim() : undefined

  // Block-level tags become paragraph breaks; everything else is stripped.
  s = s
    .replace(/<\/(p|div|section|article|li|h[1-6]|tr|blockquote)>/gi, '\n\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')

  const text = decode(s)
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .split('\n\n')
    .map((p) =>
      p
        .replace(/[ \t]+/g, ' ')
        // Stripping inline tags leaves gaps: "( IPO )", "[ 1 ]", "word ,".
        .replace(/\[\s*\d+\s*\]/g, '')
        .replace(/([([])\s+/g, '$1')
        .replace(/\s+([)\].,;:!?])/g, '$1')
        .replace(/\s{2,}/g, ' ')
        .trim(),
    )
    // Short fragments are menu items and bylines, not the article.
    .filter((p) => p.length > 40)
    .join('\n\n')
    .slice(0, MAX_CHARS)

  return { text, title }
}

function decode(s) {
  return s
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;|&apos;|&rsquo;|&lsquo;/gi, "'")
    .replace(/&ldquo;|&rdquo;/gi, '"')
    .replace(/&mdash;/gi, '—')
    .replace(/&ndash;/gi, '–')
    .replace(/&#8377;/g, '₹')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
}

export async function onRequestGet({ request }) {
  const target = new URL(request.url).searchParams.get('url')
  if (!target) return json({ error: 'No url given.' }, 400)
  if (!isPublicHttpUrl(target)) return json({ error: 'That address cannot be read.' }, 400)

  let res
  try {
    res = await fetch(target, {
      redirect: 'follow',
      headers: {
        // Some publishers serve an empty shell to an unrecognised agent.
        'User-Agent':
          'Mozilla/5.0 (compatible; MunshotContentReader/1.0; +https://news-letter-7jx.pages.dev)',
        Accept: 'text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-IN,en;q=0.9',
      },
      cf: { cacheTtl: 300, cacheEverything: true },
    })
  } catch {
    return json({ error: 'That page could not be reached.' }, 502)
  }

  if (!res.ok) return json({ error: `That page returned ${res.status}.` }, 502)

  const type = res.headers.get('content-type') ?? ''
  if (!/text\/html|text\/plain|application\/xhtml/i.test(type)) {
    return json({ error: `That link is ${type.split(';')[0] || 'not a web page'} — download it and drop the file instead.` }, 415)
  }

  const length = Number(res.headers.get('content-length') ?? 0)
  if (length > MAX_BYTES) return json({ error: 'That page is too large to read.' }, 413)

  const html = await res.text()
  if (html.length > MAX_BYTES) return json({ error: 'That page is too large to read.' }, 413)

  const { text, title } = /text\/plain/i.test(type)
    ? { text: html.slice(0, MAX_CHARS), title: undefined }
    : readableText(html)

  if (!text) return json({ error: 'No readable text on that page.' })
  return json({ text, title, url: res.url })
}
