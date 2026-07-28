/* Shared file-ingestion helpers — reading dropped/picked files into the
   plain { name, sizeLabel, imageUrl } shape the store expects. */

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
}

export async function readFileList(fileList: FileList | null): Promise<ReadFile[]> {
  if (!fileList || fileList.length === 0) return []
  return Promise.all(
    Array.from(fileList).map(async (f) => ({
      name: f.name,
      sizeLabel: formatBytes(f.size),
      imageUrl: await readImageDataUrl(f),
    })),
  )
}
