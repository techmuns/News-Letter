/* Shared file-ingestion helpers — reading dropped/picked files into the
   plain { name, sizeLabel, imageUrl, extracted } shape the store expects. */

import { extractFile } from './extract'

/** Matches bare or protocol-prefixed URLs anywhere in a block of text. */
const URL_RE = /\b(?:https?:\/\/|www\.)[^\s<>"')]+/gi

/**
 * Pulls links out of written text. A note is often "here's the thing I read"
 * plus the URL, so the links are extracted as their own materials and the
 * remaining prose stays a note.
 */
export function extractUrls(text: string): string[] {
  const found = text.match(URL_RE) ?? []
  const seen = new Set<string>()
  return found
    .map((raw) => raw.replace(/[.,;:]+$/, ''))
    .map((raw) => (/^https?:\/\//i.test(raw) ? raw : `https://${raw}`))
    .filter((u) => (seen.has(u) ? false : (seen.add(u), true)))
}

/** The text with its URLs stripped out — what's left is the actual note. */
export function textWithoutUrls(text: string): string {
  return text.replace(URL_RE, '').replace(/[ \t]{2,}/g, ' ').trim()
}

export function formatBytes(n: number): string {
  if (!n) return ''
  const kb = n / 1024
  if (kb < 1024) return `${Math.max(1, Math.round(kb))} KB`
  return `${(kb / 1024).toFixed(1)} MB`
}

function fileToDataUrl(file: File): Promise<string | undefined> {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : undefined)
    reader.onerror = () => resolve(undefined)
    reader.readAsDataURL(file)
  })
}

/**
 * Longest edge an uploaded image is kept at.
 *
 * The vision model tiles an image and caps it around 2048px anyway, so anything
 * bigger costs upload time and tokens without adding a readable pixel. Below
 * this, dense body type in a report screenshot still survives — which is the
 * thing that must not be lost.
 */
const MAX_IMAGE_EDGE = 2048

/** Under this, the original file goes as-is — re-encoding could only lose text. */
const REENCODE_OVER_BYTES = 900_000

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = src
  })
}

/**
 * The image as it will be transmitted.
 *
 * A phone photo of a report is 12 MP and 6 MB; sent whole it is slow to upload,
 * expensive to read, and no more legible than the same page at 2048px. Small
 * images are left exactly as they were — a crisp PNG screenshot of a table is
 * the best input the model can get, and JPEG artefacts on 9px type are not
 * worth the saved bytes.
 */
async function readImageDataUrl(file: File): Promise<string | undefined> {
  if (!file.type.startsWith('image/')) return undefined
  const original = await fileToDataUrl(file)
  if (!original) return undefined
  // An animated GIF loses its animation through a canvas; it is also never a
  // document, so it is left alone.
  if (file.type === 'image/gif') return original

  const img = await loadImage(original)
  if (!img) return original
  const longest = Math.max(img.naturalWidth, img.naturalHeight)
  if (longest <= MAX_IMAGE_EDGE && file.size <= REENCODE_OVER_BYTES) return original

  const scale = Math.min(1, MAX_IMAGE_EDGE / longest)
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(img.naturalWidth * scale))
  canvas.height = Math.max(1, Math.round(img.naturalHeight * scale))
  const ctx = canvas.getContext('2d')
  if (!ctx) return original
  // A transparent PNG would otherwise composite to black and swallow the text.
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
  try {
    return canvas.toDataURL('image/jpeg', 0.9)
  } catch {
    // A cross-origin or otherwise tainted canvas can't be exported.
    return original
  }
}

export interface ReadFile {
  name: string
  sizeLabel: string
  imageUrl?: string
  /** the file's text, for the formats we can read (PDF, plain text) */
  extracted?: string
  /** page count, for a PDF */
  pages?: number
  /** rendered pages of a scanned PDF, to be read by the vision model */
  pageImages?: string[]
  /** why there is no text — an image has none, a scan has no text layer */
  readError?: string
}

/**
 * Reads dropped files properly: a PDF or text file is parsed to its actual text,
 * and an image is kept as the picture it is — at a size worth transmitting —
 * so the post can be written from what the document says rather than from its
 * filename. A scanned PDF comes back as rendered pages, which are read the same
 * way an uploaded screenshot is.
 */
export async function readFileList(fileList: FileList | null): Promise<ReadFile[]> {
  if (!fileList || fileList.length === 0) return []
  return Promise.all(
    Array.from(fileList).map(async (f) => {
      const [imageUrl, extraction] = await Promise.all([readImageDataUrl(f), extractFile(f)])
      return {
        name: f.name,
        sizeLabel: formatBytes(f.size),
        imageUrl,
        ...(extraction.text ? { extracted: extraction.text } : {}),
        ...(extraction.pages ? { pages: extraction.pages } : {}),
        ...(extraction.pageImages?.length ? { pageImages: extraction.pageImages } : {}),
        ...(extraction.error ? { readError: extraction.error } : {}),
      }
    }),
  )
}

/** True when this material carries pixels a vision model should look at. */
export function hasVisualContent(file: Pick<ReadFile, 'imageUrl' | 'pageImages'>): boolean {
  return !!file.imageUrl || !!file.pageImages?.length
}
