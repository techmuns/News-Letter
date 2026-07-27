/* Shared file-ingestion helpers — reading dropped/picked files into the
   plain { name, sizeLabel, imageUrl } shape the store expects. */

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
