/* Hand-drawn "Explainer" card — a reusable notes-style teaching graphic
   (title, numbered points, a takeaway box) on warm paper with handwritten
   fonts and sketchy rough.js accents. Portrait 1080×1350. Same canvas approach
   as the market card, so the PNG exports for Buffer. */

import rough from 'roughjs'

export interface ExplainerCardData {
  eyebrow: string // "MARKET BASICS"
  title: string // "Meet India VIX"
  subtitle: string // one line under the title
  points: string[] // 2–4 numbered points
  takeaway: string // the one-line "remember this"
}

const W = 1080
const H = 1080
const PAD = 88

const PAPER = '#f7f1e3'
const INK = '#2c2a26'
const INK2 = '#5a5449'
const DOWN = '#d64545'
const HL_PINK = '#f7cddb'
const HL_YELLOW = '#ffe9a8'

const CAVEAT = 'Caveat, "Comic Sans MS", cursive'
const KALAM = 'Kalam, "Comic Sans MS", cursive'

async function ensureFonts() {
  if (!('fonts' in document)) return
  try {
    await Promise.all([
      document.fonts.load('700 80px Caveat'),
      document.fonts.load('600 30px Caveat'),
      document.fonts.load('700 34px Kalam'),
      document.fonts.load('400 33px Kalam'),
    ])
    await document.fonts.ready
  } catch {
    /* fall back to cursive */
  }
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let line = ''
  for (const word of words) {
    const test = line ? `${line} ${word}` : word
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line)
      line = word
    } else line = test
  }
  if (line) lines.push(line)
  return lines
}

export async function renderExplainerCard(data: ExplainerCardData): Promise<{ blob: Blob; dataUrl: string }> {
  await ensureFonts()
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas not supported')
  const rc = rough.canvas(canvas)
  const opt = (o: Record<string, unknown> = {}) => ({ roughness: 1.6, bowing: 1.3, stroke: INK, strokeWidth: 2.4, seed: 7, ...o })

  // paper + ruled lines + margin
  ctx.fillStyle = PAPER
  ctx.fillRect(0, 0, W, H)
  const g = ctx.createRadialGradient(W / 2, 0, 40, W / 2, 0, H)
  g.addColorStop(0, 'rgba(255,252,244,0.7)')
  g.addColorStop(1, 'rgba(239,231,211,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)
  ctx.strokeStyle = 'rgba(120,110,90,0.09)'
  ctx.lineWidth = 1
  for (let y = 132; y < H; y += 48) {
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(W, y)
    ctx.stroke()
  }
  ctx.strokeStyle = 'rgba(214,69,69,0.28)'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(52, 0)
  ctx.lineTo(52, H)
  ctx.stroke()

  // header
  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = INK
  ctx.font = `700 46px ${CAVEAT}`
  ctx.fillText('Munshot', PAD, 96)
  rc.line(PAD, 108, PAD + 140, 111, opt({ strokeWidth: 3 }))
  ctx.fillStyle = INK2
  ctx.font = `400 19px ${KALAM}`
  ctx.fillText('market intelligence', PAD, 130)
  // eyebrow (right)
  ctx.fillStyle = DOWN
  ctx.font = `700 30px ${CAVEAT}`
  const eb = data.eyebrow.toUpperCase()
  ctx.fillText(eb, W - PAD - ctx.measureText(eb).width, 96)

  // title
  const maxW = W - PAD * 2
  ctx.font = `700 80px ${CAVEAT}`
  const titleLines = wrap(ctx, data.title, maxW)
  let y = 232
  ctx.fillStyle = INK
  for (const ln of titleLines) {
    ctx.fillText(ln, PAD, y)
    y += 76
  }

  // subtitle with a soft pink highlight behind it
  ctx.font = `400 34px ${KALAM}`
  const subLines = wrap(ctx, data.subtitle, maxW)
  y += 6
  for (const ln of subLines) {
    const w = ctx.measureText(ln).width
    ctx.fillStyle = HL_PINK
    ctx.fillRect(PAD - 4, y - 30, Math.min(w + 8, maxW), 40)
    ctx.fillStyle = INK2
    ctx.fillText(ln, PAD, y)
    y += 44
  }

  // numbered points — spread to fill the space so a few short points don't
  // leave a big empty gap. gapExtra pads between points when content is light.
  const pts = data.points.filter((p) => p.trim()).slice(0, 4)
  y += 36
  const numW = 48
  // rough height each point will take, to decide spacing
  ctx.font = `400 34px ${KALAM}`
  const heights = pts.map((p) => Math.max(wrap(ctx, p, maxW - numW).length, 1) * 46)
  const used = heights.reduce((a, b) => a + b, 0)
  const boxReserve = 300 // takeaway + footer zone at the bottom
  const avail = H - y - boxReserve
  const gapExtra = pts.length > 1 ? Math.max(30, Math.min(90, (avail - used) / pts.length)) : 40
  pts.forEach((pt, i) => {
    ctx.fillStyle = DOWN
    ctx.font = `700 42px ${CAVEAT}`
    ctx.fillText(String(i + 1), PAD, y + 2)
    ctx.fillStyle = INK
    ctx.font = `400 34px ${KALAM}`
    const lines = wrap(ctx, pt, maxW - numW)
    lines.forEach((ln, j) => ctx.fillText(ln, PAD + numW, y + j * 46))
    y += lines.length * 46 + gapExtra
  })

  // takeaway box, anchored toward the bottom
  const boxTop = Math.max(y + 6, H - 250)
  const boxH = 108
  rc.rectangle(PAD, boxTop, maxW, boxH, opt({ strokeWidth: 2.4, roughness: 2, stroke: '#8a8574' }))
  ctx.fillStyle = HL_YELLOW
  // tiny "takeaway" tab
  ctx.font = `700 24px ${CAVEAT}`
  const tab = ' the takeaway '
  const tabW = ctx.measureText(tab).width
  ctx.fillRect(PAD + 24, boxTop - 16, tabW, 30)
  ctx.fillStyle = INK
  ctx.fillText(tab, PAD + 24, boxTop + 6)
  ctx.font = `700 40px ${CAVEAT}`
  const tkLines = wrap(ctx, data.takeaway, maxW - 60).slice(0, 2)
  let ty = boxTop + (boxH - (tkLines.length - 1) * 46) / 2 + 6
  for (const ln of tkLines) {
    ctx.fillText(ln, PAD + 30, ty)
    ty += 46
  }

  // footer
  const fy = H - 56
  ctx.fillStyle = INK
  ctx.font = `600 30px ${CAVEAT}`
  ctx.fillText('munshot.io · market basics', PAD, fy)
  rc.line(PAD, fy + 10, PAD + 180, fy + 13, opt({ stroke: '#8a8574', strokeWidth: 2 }))
  ctx.fillStyle = '#9a9384'
  ctx.font = `400 17px ${KALAM}`
  const disc = 'for information only · not investment advice'
  ctx.fillText(disc, W - PAD - ctx.measureText(disc).width, fy)

  const dataUrl = canvas.toDataURL('image/png')
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Image export failed'))), 'image/png'),
  )
  return { blob, dataUrl }
}
