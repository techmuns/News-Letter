/* Renders a self-contained branded "headline card" to a PNG entirely on the
   client canvas — no external photo (so nothing taints the canvas / blocks
   export). Used as the auto-image for LinkedIn posts. */

export interface CardInput {
  headline: string
  topic?: string
}

const W = 1200
const H = 675

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let line = ''
  for (const word of words) {
    const test = line ? `${line} ${word}` : word
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line)
      line = word
    } else {
      line = test
    }
  }
  if (line) lines.push(line)
  return lines
}

export async function renderBrandedCard(input: CardInput): Promise<{ blob: Blob; dataUrl: string }> {
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas not supported')

  // background
  const g = ctx.createLinearGradient(0, 0, W, H)
  g.addColorStop(0, '#17131f')
  g.addColorStop(0.55, '#1e1930')
  g.addColorStop(1, '#2a2340')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)
  // soft violet glow, bottom-left
  const rg = ctx.createRadialGradient(140, H - 40, 30, 140, H - 40, 560)
  rg.addColorStop(0, 'rgba(157,140,245,0.22)')
  rg.addColorStop(1, 'rgba(157,140,245,0)')
  ctx.fillStyle = rg
  ctx.fillRect(0, 0, W, H)

  const PAD = 80

  // brand mark
  ctx.fillStyle = '#12101e'
  roundRect(ctx, PAD, PAD, 36, 36, 9)
  ctx.fill()
  ctx.strokeStyle = 'rgba(170,152,248,0.55)'
  ctx.lineWidth = 1.5
  roundRect(ctx, PAD, PAD, 36, 36, 9)
  ctx.stroke()
  ctx.fillStyle = '#a896f7'
  ctx.beginPath()
  ctx.arc(PAD + 18, PAD + 18, 5.5, 0, Math.PI * 2)
  ctx.fill()

  ctx.textBaseline = 'middle'
  try {
    ;(ctx as any).letterSpacing = '2px'
  } catch {
    /* older canvas */
  }
  ctx.fillStyle = '#cabff8'
  ctx.font = '600 21px ui-monospace, SFMono-Regular, Menlo, monospace'
  ctx.fillText('MUNSHOT INTELLIGENCE', PAD + 52, PAD + 19)
  try {
    ;(ctx as any).letterSpacing = '0px'
  } catch {
    /* noop */
  }

  // headline (shrink font if it would need many lines)
  const maxW = W - PAD * 2
  ctx.textBaseline = 'alphabetic'
  let size = 62
  let lines: string[] = []
  for (; size >= 40; size -= 4) {
    ctx.font = `700 ${size}px "Georgia", "Times New Roman", serif`
    lines = wrapLines(ctx, input.headline || 'Munshot market intelligence', maxW)
    if (lines.length <= 4) break
  }
  const lineHeight = Math.round(size * 1.16)
  const blockH = lines.length * lineHeight
  const topicH = input.topic ? 46 : 0
  let y = Math.round((H - blockH - topicH) / 2) + topicH + size * 0.5 + 30

  // topic eyebrow
  if (input.topic) {
    try {
      ;(ctx as any).letterSpacing = '2px'
    } catch {
      /* noop */
    }
    ctx.fillStyle = '#a896f7'
    ctx.font = '600 20px ui-monospace, SFMono-Regular, Menlo, monospace'
    ctx.fillText(input.topic.toUpperCase().slice(0, 42), PAD, y - blockH - 24)
    try {
      ;(ctx as any).letterSpacing = '0px'
    } catch {
      /* noop */
    }
  }

  // headline lines
  ctx.fillStyle = '#ffffff'
  ctx.font = `700 ${size}px "Georgia", "Times New Roman", serif`
  for (const line of lines) {
    ctx.fillText(line, PAD, y)
    y += lineHeight
  }

  // accent bar
  ctx.fillStyle = '#a896f7'
  roundRect(ctx, PAD, y - lineHeight + 22, 64, 5, 3)
  ctx.fill()

  // footer
  ctx.fillStyle = 'rgba(202,191,248,0.55)'
  ctx.font = '500 19px ui-monospace, SFMono-Regular, Menlo, monospace'
  ctx.textBaseline = 'alphabetic'
  ctx.fillText('munshot.io · market intelligence', PAD, H - PAD + 6)

  const dataUrl = canvas.toDataURL('image/png')
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Image export failed'))), 'image/png'),
  )
  return { blob, dataUrl }
}
