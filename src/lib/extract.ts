/* ============================================================
   Reading what was actually provided.

   Before this module the app knew a PDF's filename and a link's
   host, and nothing else — so a post built from a 200-page DRHP
   said "Source: draft red herring prospectus.pdf" and stopped.
   The playbook (§6, §9) wants sourced figures and forbids
   inventing them, which is only possible if the document is read.

   So: PDFs are parsed to text in the browser (pdf.js), pasted
   articles are fetched and stripped to their readable body, and
   the extracted text is stored on the material. Everything the
   composer later quotes is a verbatim span of that text — nothing
   here paraphrases, because a paraphrase of a filing is a claim
   we can't source.
   ============================================================ */

/** What reading a file or a URL produced. */
export interface Extraction {
  /** the readable text, whitespace-normalised, empty when nothing could be read */
  text: string
  /** page count for PDFs, undefined otherwise */
  pages?: number
  /** the document's own title, when it declares one */
  title?: string
  /** why there is no text — shown to the author instead of failing silently */
  error?: string
}

const EMPTY: Extraction = { text: '' }

/**
 * Page break inside extracted PDF text. Kept so a quotation can cite the page
 * it came from — "p. 14" is what turns a figure into a sourced figure.
 */
export const PAGE_SEP = '\f'

/** Ligatures and PDF quirks that would otherwise show up mid-sentence. */
function normalise(raw: string): string {
  return raw
    .replace(/\r\n?/g, '\n')
    .replace(/­/g, '') // soft hyphen
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/ﬁ/g, 'fi')
    .replace(/ﬂ/g, 'fl')
    .replace(/ /g, ' ')
    // a hyphen at a line break is a split word, not punctuation
    .replace(/(\w)-\n(\w)/g, '$1$2')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/** How much text is worth keeping in memory (and in localStorage). */
const MAX_CHARS = 120_000

function cap(text: string): string {
  return text.length > MAX_CHARS ? text.slice(0, MAX_CHARS) : text
}

/* ---- PDF ---------------------------------------------------- */

/**
 * pdf.js is ~350 KB and only needed once a PDF is actually dropped, so it is
 * imported on demand rather than bundled into the initial load. The worker is
 * pointed at the same package copy so there is no CDN dependency at runtime.
 */
async function loadPdfjs() {
  const pdfjs = await import('pdfjs-dist')
  const workerUrl = (await import('pdfjs-dist/build/pdf.worker.mjs?url')).default
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl
  return pdfjs
}

/** Pages read before we stop — a 300-page prospectus does not need all of it. */
const MAX_PAGES = 40

export async function extractPdf(file: File): Promise<Extraction> {
  try {
    const pdfjs = await loadPdfjs()
    const data = new Uint8Array(await file.arrayBuffer())
    const doc = await pdfjs.getDocument({ data, isEvalSupported: false }).promise
    const limit = Math.min(doc.numPages, MAX_PAGES)
    const pages: string[] = []

    for (let i = 1; i <= limit; i++) {
      const page = await doc.getPage(i)
      const content = await page.getTextContent()
      // Each item is a positioned run; a run ending without a space is usually
      // mid-word, and hasEOL marks the end of a visual line.
      let line = ''
      const lines: string[] = []
      for (const item of content.items) {
        if (!('str' in item)) continue
        line += item.str
        if (item.hasEOL) {
          lines.push(line)
          line = ''
        }
      }
      if (line) lines.push(line)
      pages.push(lines.join('\n'))
      page.cleanup()
    }

    const meta = await doc.getMetadata().catch(() => null)
    const info = meta?.info as { Title?: string } | undefined
    await doc.destroy()

    // Pages are kept separated by a form feed so a quote can later cite the
    // page it came from — "p. 14" is the difference between a sourced figure
    // and an unsourced one.
    const text = cap(normalise(pages.join('\f')))
    if (!text) {
      return {
        text: '',
        pages: doc.numPages,
        error: 'No text layer — this looks like a scanned PDF.',
      }
    }
    return {
      text,
      pages: doc.numPages,
      ...(info?.Title?.trim() ? { title: info.Title.trim() } : {}),
    }
  } catch (err) {
    return { text: '', error: err instanceof Error ? err.message : 'Could not read this PDF.' }
  }
}

/* ---- Plain text files --------------------------------------- */

const TEXTUAL = /\.(txt|md|markdown|csv|tsv|json|html?|rtf)$/i

export function isTextual(file: File): boolean {
  return file.type.startsWith('text/') || TEXTUAL.test(file.name)
}

export async function extractTextFile(file: File): Promise<Extraction> {
  try {
    const raw = await file.text()
    // An .html export is still an article — strip it the same way a URL is.
    const text = /<\/?[a-z][\s\S]*>/i.test(raw.slice(0, 2000))
      ? stripHtml(raw).text
      : normalise(raw)
    return text ? { text: cap(text) } : { text: '', error: 'File is empty.' }
  } catch (err) {
    return { text: '', error: err instanceof Error ? err.message : 'Could not read this file.' }
  }
}

/* ---- Articles behind a URL ---------------------------------- */

/**
 * Pulls the readable body out of an HTML page.
 *
 * Not a full readability port: script/style/nav/footer are dropped, then the
 * densest block-level container wins. That is enough for a news article or a
 * filing page, and when it isn't the author sees the text we got and can
 * correct it — which is the same contract as every other material here.
 */
export function stripHtml(html: string): { text: string; title?: string } {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  doc
    .querySelectorAll('script, style, noscript, svg, nav, header, footer, aside, form, iframe')
    .forEach((el) => el.remove())

  const title =
    doc.querySelector('meta[property="og:title"]')?.getAttribute('content')?.trim() ||
    doc.querySelector('title')?.textContent?.trim() ||
    undefined

  // Citation markers and the gaps left where inline tags used to be: dropping
  // an <a> leaves "( IPO )" and "word ," behind, which reads as a typo in a quote.
  const clean = (t: string) =>
    t
      .replace(/\s+/g, ' ')
      .replace(/\[\s*\d+\s*\]/g, '')
      .replace(/([([])\s+/g, '$1')
      .replace(/\s+([)\].,;:!?])/g, '$1')
      .replace(/\s{2,}/g, ' ')
      .trim()

  const candidates = Array.from(doc.querySelectorAll('article, main, [role="main"], .article-body, #content, body'))
  let best = ''
  for (const el of candidates) {
    const paras = Array.from(el.querySelectorAll('p, li, h2, h3'))
      .map((p) => clean(p.textContent ?? ''))
      .filter((t) => t.length > 40)
    const joined = paras.join('\n\n')
    if (joined.length > best.length) best = joined
  }
  if (!best) best = clean(doc.body?.textContent ?? '')

  return { text: normalise(best), ...(title ? { title } : {}) }
}

/**
 * Fetches a pasted article.
 *
 * A browser cannot read most sites directly — no CORS header means no body, no
 * matter how public the page is. So the request goes through /api/read, a Pages
 * Function on our own origin that fetches server-side. When that route isn't
 * deployed (plain `vite dev`), a direct fetch is tried as a fallback and will
 * work for CORS-open sources.
 */
export async function extractUrl(url: string, signal?: AbortSignal): Promise<Extraction> {
  const viaProxy = async (): Promise<Extraction> => {
    const res = await fetch(`/api/read?url=${encodeURIComponent(url)}`, { signal })
    if (!res.ok) throw new Error(`reader returned ${res.status}`)
    const data = (await res.json()) as { text?: string; title?: string; error?: string }
    if (data.error) return { text: '', error: data.error }
    return { text: cap(normalise(data.text ?? '')), ...(data.title ? { title: data.title } : {}) }
  }

  const direct = async (): Promise<Extraction> => {
    const res = await fetch(url, { signal, redirect: 'follow' })
    if (!res.ok) throw new Error(`page returned ${res.status}`)
    const { text, title } = stripHtml(await res.text())
    return { text: cap(text), ...(title ? { title } : {}) }
  }

  try {
    const viaOurs = await viaProxy()
    if (viaOurs.text) return viaOurs
    // The proxy answered but had nothing — try the page itself before giving up.
    try {
      const d = await direct()
      if (d.text) return d
    } catch {
      /* fall through to the proxy's own explanation */
    }
    return viaOurs.error ? viaOurs : { text: '', error: 'No readable text on that page.' }
  } catch {
    try {
      return await direct()
    } catch (err) {
      return {
        text: '',
        error:
          err instanceof Error && err.name === 'AbortError'
            ? 'Reading was cancelled.'
            : "Couldn't read that page from the browser — it blocks cross-origin reads.",
      }
    }
  }
}

/** Dispatch for a dropped file. Images have no text to read. */
export async function extractFile(file: File): Promise<Extraction> {
  if (/\.pdf$/i.test(file.name) || file.type === 'application/pdf') return extractPdf(file)
  if (isTextual(file)) return extractTextFile(file)
  return EMPTY
}
