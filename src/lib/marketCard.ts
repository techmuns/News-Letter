/* Renders the Munshot "market card" — a colourful daily-close graphic (two
   index tiles with value, % pill and a trend sparkline, a driver strip and a
   headline) entirely on the client canvas. No external images, so the canvas
   never taints and the PNG exports for hosting/Buffer. Mirrors the approved
   design mockup. */

export type Direction = 'up' | 'down'

export interface MarketIndex {
  name: string // "NIFTY 50"
  value: string // "23,914.45" — shown exactly as typed
  changePct: string // "0.59" (no % sign)
  changePts: string // "141.35"
  direction: Direction
}

export interface MarketCardData {
  date: string // "05 SEP 2026"
  eyebrow: string // "INDIAN EQUITIES · DAILY PULSE"
  headline: string // white part of the title
  accent: string // coloured tail of the title
  driver: string // one-line "what moved it"
  indices: MarketIndex[] // 1 or 2
}

const W = 1080
const H = 1080
const PAD = 72

const UP = '#3fd89b'
const DOWN = '#fb7185'
const BRANDDOT = '#a896f7'
const VIOLET_BRIGHT = '#cabff8'
const TEXT2 = '#d8cff0'
const MUTED = '#9a8fc0'
const LINE = 'rgba(180,160,236,0.16)'

const SANS = '-apple-system, "Segoe UI", Roboto, Arial, sans-serif'
const MONO = 'ui-monospace, SFMono-Regular, Menlo, monospace'
const SERIF = 'Georgia, "Times New Roman", serif'

// Normalised sparkline shapes (y: 0 = top, 1 = bottom of the spark band).
const SPARK_DOWN = [0.31, 0.25, 0.42, 0.35, 0.54, 0.48, 0.67, 0.6, 0.81]
const SPARK_UP = [0.81, 0.72, 0.58, 0.64, 0.46, 0.52, 0.34, 0.4, 0.24]

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rad = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + rad, y)
  ctx.arcTo(x + w, y, x + w, y + h, rad)
  ctx.arcTo(x + w, y + h, x, y + h, rad)
  ctx.arcTo(x, y + h, x, y, rad)
  ctx.arcTo(x, y, x + w, y, rad)
  ctx.closePath()
}

function setSpacing(ctx: CanvasRenderingContext2D, px: number) {
  try {
    ;(ctx as unknown as { letterSpacing: string }).letterSpacing = `${px}px`
  } catch {
    /* older canvas — ignore */
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
    } else {
      line = test
    }
  }
  if (line) lines.push(line)
  return lines
}

function drawSparkline(
  ctx: CanvasRenderingContext2D,
  x: number,
  bottom: number,
  w: number,
  bandH: number,
  dir: Direction,
) {
  const ys = dir === 'up' ? SPARK_UP : SPARK_DOWN
  const color = dir === 'up' ? UP : DOWN
  const top = bottom - bandH
  const pts = ys.map((ny, i) => ({ x: x + (w * i) / (ys.length - 1), y: top + ny * bandH }))

  // area fill
  const grad = ctx.createLinearGradient(0, top, 0, bottom)
  grad.addColorStop(0, dir === 'up' ? 'rgba(63,216,155,0.26)' : 'rgba(251,113,133,0.26)')
  grad.addColorStop(1, dir === 'up' ? 'rgba(63,216,155,0)' : 'rgba(251,113,133,0)')
  ctx.beginPath()
  ctx.moveTo(pts[0].x, pts[0].y)
  for (const p of pts.slice(1)) ctx.lineTo(p.x, p.y)
  ctx.lineTo(x + w, bottom)
  ctx.lineTo(x, bottom)
  ctx.closePath()
  ctx.fillStyle = grad
  ctx.fill()

  // line
  ctx.beginPath()
  ctx.moveTo(pts[0].x, pts[0].y)
  for (const p of pts.slice(1)) ctx.lineTo(p.x, p.y)
  ctx.strokeStyle = color
  ctx.lineWidth = 3.5
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  ctx.stroke()
}

function drawTile(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, idx: MarketIndex) {
  const up = idx.direction === 'up'
  const color = up ? UP : DOWN
  const ring = up ? 'rgba(63,216,155,0.34)' : 'rgba(251,113,133,0.34)'
  const pillBg = up ? 'rgba(63,216,155,0.12)' : 'rgba(251,113,133,0.12)'

  // panel
  const pg = ctx.createLinearGradient(0, y, 0, y + h)
  pg.addColorStop(0, 'rgba(255,255,255,0.05)')
  pg.addColorStop(1, 'rgba(255,255,255,0.015)')
  ctx.save()
  roundRect(ctx, x, y, w, h, 24)
  ctx.clip()
  ctx.fillStyle = pg
  ctx.fillRect(x, y, w, h)
  // sparkline sits inside, along the bottom
  drawSparkline(ctx, x, y + h, w, 118, idx.direction)
  ctx.restore()

  // ring
  roundRect(ctx, x + 0.75, y + 0.75, w - 1.5, h - 1.5, 24)
  ctx.strokeStyle = ring
  ctx.lineWidth = 1.5
  ctx.stroke()

  const ix = x + 34
  // index label
  ctx.textBaseline = 'alphabetic'
  setSpacing(ctx, 2)
  ctx.fillStyle = TEXT2
  ctx.font = `600 22px ${MONO}`
  ctx.fillText(idx.name.toUpperCase(), ix, y + 60)
  setSpacing(ctx, 0)

  // % pill (top-right)
  const arrow = up ? '▲' : '▼'
  const pillTxt = `${arrow} ${idx.changePct}%`
  ctx.font = `700 22px ${MONO}`
  const pw = ctx.measureText(pillTxt).width + 34
  const ph = 44
  const px = x + w - 34 - pw
  const py = y + 34
  roundRect(ctx, px, py, pw, ph, 22)
  ctx.fillStyle = pillBg
  ctx.fill()
  roundRect(ctx, px + 0.75, py + 0.75, pw - 1.5, ph - 1.5, 22)
  ctx.strokeStyle = ring
  ctx.lineWidth = 1
  ctx.stroke()
  ctx.fillStyle = color
  ctx.textBaseline = 'middle'
  ctx.fillText(pillTxt, px + 17, py + ph / 2 + 1)
  ctx.textBaseline = 'alphabetic'

  // big value
  ctx.fillStyle = '#ffffff'
  ctx.font = `800 68px ${SANS}`
  ctx.fillText(idx.value, ix, y + 158)

  // points change line: "▲ 141.35 pts lower" — arrow + number coloured/strong,
  // the trailing word muted. Advance a cursor so the segments never overlap.
  const cy = y + 202
  let cx = ix
  ctx.textBaseline = 'alphabetic'
  ctx.font = `700 23px ${SANS}`
  ctx.fillStyle = color
  const arrowSeg = `${arrow} `
  ctx.fillText(arrowSeg, cx, cy)
  cx += ctx.measureText(arrowSeg).width
  ctx.fillStyle = TEXT2
  const ptsSeg = `${idx.changePts} pts`
  ctx.fillText(ptsSeg, cx, cy)
  cx += ctx.measureText(ptsSeg).width
  ctx.font = `500 23px ${SANS}`
  ctx.fillStyle = MUTED
  ctx.fillText(up ? ' higher' : ' lower', cx, cy)
}

export async function renderMarketCard(data: MarketCardData): Promise<{ blob: Blob; dataUrl: string }> {
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas not supported')

  // background
  const bg = ctx.createLinearGradient(0, 0, W * 0.6, H)
  bg.addColorStop(0, '#151020')
  bg.addColorStop(0.52, '#1d1630')
  bg.addColorStop(1, '#251c3c')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, W, H)
  const glow1 = ctx.createRadialGradient(W * 0.12, H * 0.08, 20, W * 0.12, H * 0.08, 640)
  glow1.addColorStop(0, 'rgba(157,140,245,0.20)')
  glow1.addColorStop(1, 'rgba(157,140,245,0)')
  ctx.fillStyle = glow1
  ctx.fillRect(0, 0, W, H)
  const glow2 = ctx.createRadialGradient(W, H, 20, W, H, 700)
  glow2.addColorStop(0, 'rgba(120,70,120,0.20)')
  glow2.addColorStop(1, 'rgba(120,70,120,0)')
  ctx.fillStyle = glow2
  ctx.fillRect(0, 0, W, H)

  // ---- header ----
  // brand mark
  roundRect(ctx, PAD, PAD, 52, 52, 14)
  ctx.fillStyle = '#100d1c'
  ctx.fill()
  roundRect(ctx, PAD, PAD, 52, 52, 14)
  ctx.strokeStyle = 'rgba(170,152,248,0.5)'
  ctx.lineWidth = 1.5
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(PAD + 26, PAD + 26, 7.5, 0, Math.PI * 2)
  ctx.fillStyle = BRANDDOT
  ctx.fill()

  ctx.textBaseline = 'middle'
  setSpacing(ctx, 2.5)
  ctx.fillStyle = VIOLET_BRIGHT
  ctx.font = `700 22px ${MONO}`
  ctx.fillText('MUNSHOT INTELLIGENCE', PAD + 68, PAD + 27)

  // date pill (right)
  setSpacing(ctx, 2)
  ctx.font = `500 19px ${MONO}`
  const dtxt = data.date.toUpperCase()
  const dtW = ctx.measureText(dtxt).width + 44
  const dpx = W - PAD - dtW
  roundRect(ctx, dpx, PAD + 4, dtW, 44, 22)
  ctx.fillStyle = 'rgba(255,255,255,0.03)'
  ctx.fill()
  roundRect(ctx, dpx, PAD + 4, dtW, 44, 22)
  ctx.strokeStyle = LINE
  ctx.lineWidth = 1
  ctx.stroke()
  ctx.fillStyle = TEXT2
  ctx.fillText(dtxt, dpx + 22, PAD + 27)
  setSpacing(ctx, 0)
  ctx.textBaseline = 'alphabetic'

  // ---- eyebrow ----
  setSpacing(ctx, 3)
  ctx.fillStyle = BRANDDOT
  ctx.font = `600 20px ${MONO}`
  ctx.fillText(data.eyebrow.toUpperCase(), PAD, PAD + 130)
  setSpacing(ctx, 0)

  // ---- title (white lead + coloured accent, wrapped as one flow) ----
  const ups = data.indices.filter((i) => i.direction === 'up').length
  const downs = data.indices.length - ups
  const overall = ups >= downs ? UP : DOWN

  ctx.font = `700 62px ${SERIF}`
  const maxW = W - PAD * 2
  // Tokenise into words tagged white/accent so wrapping keeps colours.
  type Tok = { t: string; accent: boolean }
  const toks: Tok[] = [
    ...data.headline.split(/\s+/).filter(Boolean).map((t) => ({ t, accent: false })),
    ...data.accent.split(/\s+/).filter(Boolean).map((t) => ({ t, accent: true })),
  ]
  const space = ctx.measureText(' ').width
  const rows: Tok[][] = [[]]
  let rowW = 0
  for (const tok of toks) {
    const tw = ctx.measureText(tok.t).width
    if (rowW + tw > maxW && rows[rows.length - 1].length) {
      rows.push([tok])
      rowW = tw + space
    } else {
      rows[rows.length - 1].push(tok)
      rowW += tw + space
    }
  }
  const lineH = 72
  let ty = PAD + 130 + 74
  for (const row of rows) {
    let tx = PAD
    for (const tok of row) {
      ctx.fillStyle = tok.accent ? overall : '#ffffff'
      ctx.fillText(tok.t, tx, ty)
      tx += ctx.measureText(tok.t).width + space
    }
    ty += lineH
  }

  // ---- index tiles ----
  const tilesTop = ty + 26
  const gap = 28
  const n = Math.min(data.indices.length, 2)
  const tileW = n === 2 ? (maxW - gap) / 2 : maxW
  const tileH = 320
  data.indices.slice(0, 2).forEach((idx, i) => {
    drawTile(ctx, PAD + i * (tileW + gap), tilesTop, tileW, tileH, idx)
  })

  // ---- driver strip ----
  const dTop = tilesTop + tileH + 36
  const dPadX = 30
  const tagTxt = 'WHAT MOVED IT'
  ctx.font = `700 18px ${MONO}`
  setSpacing(ctx, 2)
  const tagW = ctx.measureText(tagTxt).width + 28
  setSpacing(ctx, 0)
  const txtX = PAD + dPadX + tagW + 8
  const txtMaxW = W - PAD - dPadX - (txtX - PAD)
  ctx.font = `500 26px ${SANS}`
  const dLines = wrap(ctx, data.driver, txtMaxW)
  const dLineH = 37
  const dBoxH = Math.max(96, dLines.length * dLineH + 44)
  roundRect(ctx, PAD, dTop, maxW, dBoxH, 20)
  ctx.fillStyle = 'rgba(255,255,255,0.03)'
  ctx.fill()
  roundRect(ctx, PAD + 0.5, dTop + 0.5, maxW - 1, dBoxH - 1, 20)
  ctx.strokeStyle = LINE
  ctx.lineWidth = 1
  ctx.stroke()
  // tag
  setSpacing(ctx, 2)
  ctx.fillStyle = BRANDDOT
  ctx.font = `700 18px ${MONO}`
  ctx.fillText(tagTxt, PAD + dPadX, dTop + 34)
  setSpacing(ctx, 0)
  // text
  ctx.fillStyle = TEXT2
  ctx.font = `500 26px ${SANS}`
  let dy = dTop + 34
  for (const ln of dLines) {
    ctx.fillText(ln, txtX, dy)
    dy += dLineH
  }

  // ---- footer ----
  const fy = H - PAD - 8
  ctx.strokeStyle = LINE
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(PAD, fy - 34)
  ctx.lineTo(W - PAD, fy - 34)
  ctx.stroke()
  setSpacing(ctx, 1.5)
  ctx.fillStyle = VIOLET_BRIGHT
  ctx.font = `600 20px ${MONO}`
  ctx.fillText('munshot.io · market intelligence', PAD, fy)
  setSpacing(ctx, 1)
  ctx.fillStyle = MUTED
  ctx.font = `400 16px ${MONO}`
  const disc = 'FOR INFORMATION ONLY · NOT INVESTMENT ADVICE'
  ctx.fillText(disc, W - PAD - ctx.measureText(disc).width, fy)
  setSpacing(ctx, 0)

  const dataUrl = canvas.toDataURL('image/png')
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Image export failed'))), 'image/png'),
  )
  return { blob, dataUrl }
}
