/* PDF → text, entirely client-side via pdf.js. Dynamically imported from
   Studio so pdf.js is code-split out of the main bundle (only loaded the
   first time someone adds a PDF). */
import * as pdfjs from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl

/** Extract selectable text from a PDF File. Caps pages to keep it snappy. */
export async function extractPdfText(file: File, maxPages = 30): Promise<string> {
  const data = await file.arrayBuffer()
  const doc = await pdfjs.getDocument({ data }).promise
  const pages: string[] = []
  const n = Math.min(doc.numPages, maxPages)
  for (let p = 1; p <= n; p++) {
    const page = await doc.getPage(p)
    const content = await page.getTextContent()
    const text = content.items.map((it: any) => ('str' in it ? it.str : '')).join(' ')
    if (text.trim()) pages.push(text)
  }
  const joined = pages.join('\n\n').replace(/[ \t]+/g, ' ').trim()
  if (!joined) {
    throw new Error('No selectable text found in this PDF (it may be scanned images).')
  }
  return joined
}
