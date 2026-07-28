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

function readImageDataUrl(file: File): Promise<string | undefined> {
  if (!file.type.startsWith('image/')) return Promise.resolve(undefined)
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : undefined)
    reader.onerror = () => resolve(undefined)
    reader.readAsDataURL(file)
  })
}

export interface ReadFile {
  name: string
  sizeLabel: string
  imageUrl?: string
  /** the file's text, for the formats we can read (PDF, plain text) */
  extracted?: string
  /** page count, for a PDF */
  pages?: number
  /** why there is no text — an image has none, a scan has no text layer */
  readError?: string
}

/**
 * Reads dropped files properly: an image becomes a thumbnail, and a PDF or text
 * file is parsed to its actual text so the post can be written from what the
 * document says rather than from its filename.
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
        ...(extraction.error ? { readError: extraction.error } : {}),
      }
    }),
  )
}
