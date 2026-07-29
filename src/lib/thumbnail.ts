/**
 * Downscales an image file to a small data URL for display in the pile.
 *
 * The full-resolution original is kept in IndexedDB and sent to the model;
 * this is only what the UI renders, so it stays small enough to live in
 * localStorage alongside the rest of the item metadata.
 */
const MAX_EDGE = 320
const QUALITY = 0.72

export function makeThumbnail(file: File): Promise<string | undefined> {
  if (!file.type.startsWith('image/')) return Promise.resolve(undefined)

  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const img = new Image()

    img.onload = () => {
      URL.revokeObjectURL(url)
      const scale = Math.min(1, MAX_EDGE / Math.max(img.width, img.height))
      const w = Math.max(1, Math.round(img.width * scale))
      const h = Math.max(1, Math.round(img.height * scale))

      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')
      if (!ctx) return resolve(undefined)

      ctx.drawImage(img, 0, 0, w, h)
      try {
        resolve(canvas.toDataURL('image/jpeg', QUALITY))
      } catch {
        // Tainted canvas or unsupported type — the pile just shows no preview.
        resolve(undefined)
      }
    }

    img.onerror = () => {
      URL.revokeObjectURL(url)
      resolve(undefined)
    }

    img.src = url
  })
}
