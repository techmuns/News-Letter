/* Hand-drawn variant of the Munshot market card — warm paper, handwritten
   fonts, sketchy rough.js boxes/arrows, highlighter accents. Same data as the
   sleek card, rendered on canvas so the PNG still exports for Buffer. */

import rough from 'roughjs'
import { type MarketCardData, type MarketIndex } from './marketCard'

const W = 1200
const H = 750
const PAD = 60

const PAPER = '#f7f1e3'
const INK = '#2c2a26'
const INK2 = '#5a5449'
const DOWN = '#d64545'
const UP = '#2f9e6f'
const HL_PINK = '#f7cddb'
const HL_GREEN = '#bfe8cf'
const RULE = 'rgba(120,110,90,0.10)'
const MARGIN = 'rgba(214,69,69,0.30)'

const CAVEAT = 'Caveat, "Comic Sans MS", cursive'
const KALAM = 'Kalam, "Comic Sans MS", cursive'

async function ensureFonts() {
  if (!('fonts' in document)) return
  try {
    await Promise.all([
      document.fonts.load('700 60px Caveat'),
      document.fonts.load('600 30px Caveat'),
      document.fonts.load('700 26px Kalam'),
      document.fonts.load('400 24px Kalam'),
    ])
    await document.fonts.ready
  } catch {
    /* fall back to cursive system font */
  }
}

function wrapTokens(
  ctx: CanvasRenderingContext2D,
  toks: { t: string; accent: boolean }[],
  maxWidth: number,
): { t: string; accent: boolean }[][] {
  const space = ctx.measureText(' ').width
  const rows: { t: string; accent: boolean }[][] = [[]]
  let w = 0
  for (const tok of toks) {
    const tw = ctx.measureText(tok.t).width
    if (w + tw > maxWidth && rows[rows.length - 1].length) {
      rows.push([tok])
      w = tw + space
    } else {
      rows[rows.length - 1].push(tok)
      w += tw + space
    }
  }
  return rows
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
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

// deterministic seed per card so the sketch doesn't jitter between renders
function seedFrom(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) & 0xffffffff
  return Math.abs(h) || 1
}

export async function renderMarketCardHand(data: MarketCardData): Promise<{ blob: Blob; dataUrl: string }> {
  await ensureFonts()
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas not supported')
  const rc = rough.canvas(canvas)
  const seed = seedFrom(data.headline + data.accent + data.date)
  const opt = (o: Record<string, unknown> = {}) => ({ roughness: 1.8, bowing: 1.4, stroke: INK, strokeWidth: 2.4, seed, ...o })

  // paper
  ctx.fillStyle = PAPER
  ctx.fillRect(0, 0, W, H)
  // soft top glow
  const g = ctx.createRadialGradient(W / 2, 0, 40, W / 2, 0, H)
  g.addColorStop(0, 'rgba(255,252,244,0.7)')
  g.addColorStop(1, 'rgba(239,231,211,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)
  // ruled lines
  ctx.strokeStyle = RULE
  ctx.lineWidth = 1
  for (let y = 96; y < H; y += 47) {
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(W, y)
    ctx.stroke()
  }
  // red margin
  ctx.strokeStyle = MARGIN
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(44, 0)
  ctx.lineTo(44, H)
  ctx.stroke()

  const overallUp = data.indices.filter((i) => i.direction === 'up').length >= data.indices.length / 2 &&
    data.indices.some((i) => i.direction === 'up')
  const hlColor = overallUp ? HL_GREEN : HL_PINK

  // ---- header ----
  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = INK
  ctx.font = `700 42px ${CAVEAT}`
  ctx.fillText('Munshot', PAD + 18, PAD + 34)
  rc.line(PAD + 18, PAD + 44, PAD + 150, PAD + 47, opt({ strokeWidth: 3 }))
  ctx.fillStyle = INK2
  ctx.font = `400 17px ${KALAM}`
  ctx.fillText('market intelligence', PAD + 18, PAD + 66)
  // date (right)
  ctx.font = `600 30px ${CAVEAT}`
  ctx.fillStyle = INK2
  const dtxt = data.date
  ctx.fillText(dtxt, W - PAD - ctx.measureText(dtxt).width, PAD + 34)

  // ---- eyebrow ----
  ctx.fillStyle = DOWN
  ctx.font = `700 22px ${CAVEAT}`
  ctx.fillText(data.eyebrow, PAD + 18, PAD + 104)

  // ---- title with highlighter behind accent words ----
  const titleSize = 48
  ctx.font = `700 ${titleSize}px ${CAVEAT}`
  const maxW = W - PAD * 2 - 18
  const toks = [
    ...data.headline.split(/\s+/).filter(Boolean).map((t) => ({ t, accent: false })),
    ...data.accent.split(/\s+/).filter(Boolean).map((t) => ({ t, accent: true })),
  ]
  const rows = wrapTokens(ctx, toks, maxW)
  const space = ctx.measureText(' ').width
  const lineH = 54
  // clear gap below the eyebrow (its baseline is at PAD+104) so the title's
  // highlight never touches it
  let ty = PAD + 178
  for (const row of rows) {
    let x = PAD + 18
    // highlight pass — one continuous swipe across the contiguous accent run,
    // not a block per word (looks like a real highlighter).
    let hlStart = -1
    let hlEnd = -1
    for (const tok of row) {
      const tw = ctx.measureText(tok.t).width
      if (tok.accent) {
        if (hlStart < 0) hlStart = x
        hlEnd = x + tw
      }
      x += tw + space
    }
    if (hlStart >= 0) {
      ctx.fillStyle = hlColor
      ctx.fillRect(hlStart - 5, ty - 38, hlEnd - hlStart + 10, 48)
    }
    // text pass
    x = PAD + 18
    ctx.fillStyle = INK
    for (const tok of row) {
      ctx.fillText(tok.t, x, ty)
      x += ctx.measureText(tok.t).width + space
    }
    ty += lineH
  }

  // ---- tiles ----
  const tilesTop = Math.max(ty + 16, 300)
  const gap = 30
  const tileW = data.indices.length >= 2 ? (maxW - gap) / 2 : maxW
  const tileH = 220
  data.indices.slice(0, 2).forEach((idx, i) => {
    const x = PAD + 18 + i * (tileW + gap)
    drawHandTile(ctx, rc, opt, x, tilesTop, tileW, tileH, idx)
  })

  // ---- driver ----
  const dTop = tilesTop + tileH + 22
  rc.rectangle(PAD + 18, dTop, maxW, 86, opt({ strokeWidth: 2, roughness: 2.4, stroke: '#8a8574' }))
  ctx.fillStyle = DOWN
  ctx.font = `700 28px ${CAVEAT}`
  const tag = 'what moved it →'
  ctx.fillText(tag, PAD + 34, dTop + 40)
  const tagW = ctx.measureText(tag).width
  ctx.fillStyle = INK2
  ctx.font = `400 23px ${KALAM}`
  const dLines = wrapText(ctx, data.driver, maxW - tagW - 60).slice(0, 2)
  let dy = dTop + 40
  const dx = PAD + 34 + tagW + 14
  dLines.forEach((ln, i) => {
    ctx.fillText(ln, i === 0 ? dx : PAD + 34, dy)
    dy += 30
  })

  // ---- footer ----
  const fy = H - PAD + 4
  ctx.fillStyle = INK
  ctx.font = `600 26px ${CAVEAT}`
  ctx.fillText('munshot.io · daily market pulse', PAD + 18, fy)
  rc.line(PAD + 18, fy + 8, PAD + 190, fy + 11, opt({ stroke: '#8a8574', strokeWidth: 2 }))
  ctx.fillStyle = '#9a9384'
  ctx.font = `400 15px ${KALAM}`
  const disc = 'for information only · not investment advice'
  ctx.fillText(disc, W - PAD - ctx.measureText(disc).width, fy)

  const dataUrl = canvas.toDataURL('image/png')
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Image export failed'))), 'image/png'),
  )
  return { blob, dataUrl }
}

function drawHandTile(
  ctx: CanvasRenderingContext2D,
  rc: ReturnType<typeof rough.canvas>,
  opt: (o?: Record<string, unknown>) => Record<string, unknown>,
  x: number,
  y: number,
  w: number,
  h: number,
  idx: MarketIndex,
) {
  const up = idx.direction === 'up'
  const color = up ? UP : DOWN
  rc.rectangle(x, y, w, h, opt({ strokeWidth: 2.6, roughness: 2.1 }))

  const ix = x + 26
  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = INK
  ctx.font = `700 34px ${CAVEAT}`
  ctx.fillText(idx.name, ix, y + 48)

  // value
  ctx.font = `700 60px ${KALAM}`
  ctx.fillStyle = INK
  ctx.fillText(idx.value, ix, y + 122)

  // change line
  ctx.font = `700 25px ${KALAM}`
  ctx.fillStyle = color
  ctx.fillText(`${up ? '↑' : '↓'} ${idx.changePts} pts ${up ? 'higher' : 'lower'}`, ix, y + 168)

  // % pill text (top-right)
  ctx.font = `700 26px ${KALAM}`
  ctx.fillStyle = color
  const pill = `${up ? '▲' : '▼'} ${idx.changePct}%`
  ctx.fillText(pill, x + w - 26 - ctx.measureText(pill).width, y + 44)

  // hand-drawn arrow near the pill
  const ax = x + w - 46
  const ay = y + 62
  rc.line(ax, ay, ax, ay + 46, opt({ stroke: color, strokeWidth: 3 }))
  if (up) {
    rc.line(ax, ay, ax - 11, ay + 13, opt({ stroke: color, strokeWidth: 3 }))
    rc.line(ax, ay, ax + 11, ay + 13, opt({ stroke: color, strokeWidth: 3 }))
  } else {
    rc.line(ax, ay + 46, ax - 11, ay + 33, opt({ stroke: color, strokeWidth: 3 }))
    rc.line(ax, ay + 46, ax + 11, ay + 33, opt({ stroke: color, strokeWidth: 3 }))
  }
}
