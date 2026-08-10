/* Client-side ingestion helpers for the Studio pile. */

export interface DownscaledImage {
  /** base64 with NO `data:` prefix — the shape the vision API wants */
  base64: string
  mediaType: string
}

/** Read an image File, downscale it (keeps the request + localStorage small),
    and return JPEG base64. ~1200px keeps a screenshot legible for the model. */
export async function fileToDownscaledImage(
  file: File,
  maxSide = 1200,
  quality = 0.82,
): Promise<DownscaledImage> {
  const dataUrl: string = await new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result))
    r.onerror = () => reject(new Error('Could not read the image file.'))
    r.readAsDataURL(file)
  })
  const img: HTMLImageElement = await new Promise((resolve, reject) => {
    const im = new Image()
    im.onload = () => resolve(im)
    im.onerror = () => reject(new Error('Could not decode the image.'))
    im.src = dataUrl
  })
  const scale = Math.min(1, maxSide / Math.max(img.width, img.height))
  const w = Math.max(1, Math.round(img.width * scale))
  const h = Math.max(1, Math.round(img.height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas not supported in this browser.')
  ctx.drawImage(img, 0, 0, w, h)
  const out = canvas.toDataURL('image/jpeg', quality)
  return { base64: out.split(',')[1] || '', mediaType: 'image/jpeg' }
}
