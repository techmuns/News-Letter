/* Munshot "Data Snapshot" card — an editorial research graphic in the vein of a
   research-desk snapshot: a finding as the headline, a chart chosen to fit the
   story, and a "what the numbers say" sidebar of colour-coded takeaways + a
   "watch next" line. The FRAME (logo, sidebar, source line, palette) stays
   constant — that's the brand — while the CHART varies by layout so different
   topics produce visibly different posts:

     - bars     compare a few index moves (diverging from a centre axis)
     - trend    one to three series over time (a line chart)
     - ranking  a sorted league table of movers (winners green, losers red)
     - stat     one dominant number with a label and a line of context

   Rendered entirely on canvas so the PNG exports for hosting/Buffer.
   Landscape 1200×900, light/editorial look (white ground, plum accent). */

export type SnapTone = 'red' | 'green' | 'plum'
export type SnapLayout = 'bars' | 'trend' | 'ranking' | 'stat'

export interface SnapBar {
  name: string // "Dow Jones"
  sub: string // "52,786" (the level, shown small next to the name)
  pct: string // "-1.18" — signed, no % sign
}

export interface SnapSeries {
  name: string // "VinFast"
  color?: string // hex; defaults cycle through the palette
  points: number[] // the series values, oldest → newest
}

export interface SnapStat {
  value: string // "~91%" — the big number
  label: string // "priced-in odds of a 25bp hike"
  context: string // one supporting sentence
}

export interface DataSnapshotData {
  date: string // "September 8, 2026"
  title: string // the finding — the big headline
  subtitle: string // dataset / method line
  layout: SnapLayout
  bars: SnapBar[] // for 'bars' and 'ranking'
  series: SnapSeries[] // for 'trend'
  xLabels: string[] // optional x-axis labels for 'trend' (first & last shown)
  stat: SnapStat // for 'stat'
  takeaways: SnapTakeaway[] // up to 3
  watchNext: string // the "what to watch" line
  source: string // "exchange close data, 8 Sep 2026"
}

export interface SnapTakeaway {
  tone: SnapTone
  lead: string // bold coloured label
  text: string // one sentence
}

const W = 1200
const H = 900
const PADX = 56
const PADT = 52

const PAPER = '#fbfaf7'
const INK = '#221c2e'
const INK2 = '#5f596e'
const MUT = '#9a93a6'
const MUT2 = '#a49dad'
const PLUM = '#6d4aa8'
const GREEN = '#2f9e6f'
const RED = '#d64545'
const AMBER = '#c99a2e'
const BLUE = '#3f7cc0'

const SANS = '-apple-system, "Segoe UI", Roboto, Arial, sans-serif'

const TONE: Record<SnapTone, string> = { red: RED, green: GREEN, plum: PLUM }
const SERIES_COLORS = [PLUM, GREEN, AMBER, BLUE]

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rad = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2)
  ctx.beginPath()
  ctx.moveTo(x + rad, y)
  ctx.arcTo(x + w, y, x + w, y + h, rad)
  ctx.arcTo(x + w, y + h, x, y + h, rad)
  ctx.arcTo(x, y + h, x, y, rad)
  ctx.arcTo(x, y, x + w, y, rad)
  ctx.closePath()
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

function lerp(a: number, b: number, t: number): number {
  return Math.round(a + (b - a) * t)
}

/** Blend two hex colours (used to shade a bar by the size of its move). */
function mix(c1: string, c2: string, t: number): string {
  const rgb = (h: string) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]
  const [r1, g1, b1] = rgb(c1)
  const [r2, g2, b2] = rgb(c2)
  return `rgb(${lerp(r1, r2, t)},${lerp(g1, g2, t)},${lerp(b1, b2, t)})`
}

/** hex → rgba string at the given alpha (for gradient fills). */
function rgba(hex: string, a: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${a})`
}

/** Draw text with per-character letter-spacing (canvas letterSpacing is patchy). */
function drawTracked(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, sp: number) {
  let cx = x
  for (const ch of text) {
    ctx.fillText(ch, cx, y)
    cx += ctx.measureText(ch).width + sp
  }
}

// ---------------------------------------------------------------------------
// chart layouts — each fills the left column (x, y, w, h)
// ---------------------------------------------------------------------------

function drawBars(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, bars: SnapBar[]) {
  const rows = bars.slice(0, 5)
  const maxAbs = Math.max(...rows.map((b) => Math.abs(parseFloat(b.pct) || 0)), 0.01)
  const trackH = 26
  const labelGap = 9
  const labelH = 24
  const blockH = labelH + labelGap + trackH
  const step = rows.length > 1 ? Math.min(96, (h - blockH) / (rows.length - 1)) : 0
  const startY = y + (h - (blockH + step * (rows.length - 1))) / 2
  const cxAxis = x + w / 2
  const maxHalf = (w / 2) * 0.9
  rows.forEach((b, i) => {
    const ry = startY + i * step
    const num = parseFloat(b.pct) || 0
    const flat = Math.abs(num) < 0.15
    const t = Math.abs(num) / maxAbs
    const col = flat ? AMBER : num < 0 ? mix('#eab8b8', '#d64545', t) : mix('#a6d8bf', '#2f9e6f', t)
    ctx.textBaseline = 'alphabetic'
    ctx.font = `800 20px ${SANS}`
    ctx.fillStyle = INK
    ctx.fillText(b.name, x, ry + 18)
    const nmW = ctx.measureText(b.name).width
    ctx.font = `600 14px ${SANS}`
    ctx.fillStyle = MUT
    ctx.fillText(b.sub, x + nmW + 10, ry + 18)
    ctx.font = `800 20px ${SANS}`
    ctx.fillStyle = flat ? AMBER : num < 0 ? RED : GREEN
    const sign = num < 0 ? '−' : '+'
    ctx.textAlign = 'right'
    ctx.fillText(`${sign}${Math.abs(num).toFixed(2)}%`, x + w, ry + 18)
    ctx.textAlign = 'left'
    const trackY = ry + labelH + labelGap
    roundRect(ctx, x, trackY, w, trackH, 7)
    ctx.fillStyle = '#f0edf5'
    ctx.fill()
    const half = Math.max(t * maxHalf, flat ? 7 : 10)
    if (num < 0 || flat) roundRect(ctx, cxAxis - half, trackY, half, trackH, 7)
    else roundRect(ctx, cxAxis, trackY, half, trackH, 7)
    ctx.fillStyle = col
    ctx.fill()
    ctx.strokeStyle = '#cfc9db'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(cxAxis, trackY - 6)
    ctx.lineTo(cxAxis, trackY + trackH + 6)
    ctx.stroke()
    if (flat) {
      ctx.font = `600 12px ${SANS}`
      ctx.fillStyle = MUT2
      ctx.textAlign = 'center'
      ctx.fillText('flat', cxAxis, trackY + trackH + 24)
      ctx.textAlign = 'left'
    }
  })
}

function drawRanking(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, bars: SnapBar[]) {
  const rows = bars
    .filter((b) => b.name.trim())
    .slice(0, 6)
    .sort((a, b) => (parseFloat(b.pct) || 0) - (parseFloat(a.pct) || 0))
  const maxAbs = Math.max(...rows.map((b) => Math.abs(parseFloat(b.pct) || 0)), 0.01)
  const barH = 22
  const rowH = Math.min(74, (h - barH) / Math.max(rows.length - 1, 1))
  const startY = y + (h - (barH + rowH * (rows.length - 1))) / 2
  const labelW = 150
  const trackX = x + labelW
  const trackW = w - labelW - 78
  rows.forEach((b, i) => {
    const ry = startY + i * rowH
    const num = parseFloat(b.pct) || 0
    const up = num >= 0
    const col = up ? GREEN : RED
    ctx.textBaseline = 'middle'
    ctx.font = `800 18px ${SANS}`
    ctx.fillStyle = INK
    // truncate long names to the label column
    let nm = b.name
    while (ctx.measureText(nm).width > labelW - 14 && nm.length > 3) nm = nm.slice(0, -1)
    if (nm !== b.name) nm = nm.slice(0, -1) + '…'
    ctx.fillText(nm, x, ry + barH / 2)
    // track baseline
    ctx.fillStyle = '#f0edf5'
    roundRect(ctx, trackX, ry, trackW, barH, 7)
    ctx.fill()
    const len = Math.max((Math.abs(num) / maxAbs) * trackW, 8)
    ctx.fillStyle = col
    roundRect(ctx, trackX, ry, len, barH, 7)
    ctx.fill()
    ctx.font = `800 17px ${SANS}`
    ctx.fillStyle = col
    ctx.textAlign = 'left'
    ctx.fillText(`${up ? '+' : '−'}${Math.abs(num).toFixed(2)}%`, trackX + trackW + 12, ry + barH / 2)
  })
  ctx.textBaseline = 'alphabetic'
  ctx.textAlign = 'left'
}

function drawTrend(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  series: SnapSeries[],
  xLabels: string[],
) {
  const lines = series.filter((s) => s.points.length >= 2).slice(0, 3)
  if (!lines.length) return
  const all = lines.flatMap((s) => s.points)
  let min = Math.min(...all)
  let max = Math.max(...all)
  if (max === min) {
    max += 1
    min -= 1
  }
  const pad = (max - min) * 0.12
  min -= pad
  max += pad
  const plotX = x + 8
  const plotW = w - 8 - 66 // room for end labels
  const plotTop = y + 10
  const plotBot = y + h - 30
  const mapX = (i: number, n: number) => plotX + (plotW * i) / (n - 1)
  const mapY = (v: number) => plotBot - ((v - min) / (max - min)) * (plotBot - plotTop)

  // faint gridlines
  ctx.strokeStyle = '#eee9f2'
  ctx.lineWidth = 1
  for (let g = 0; g <= 3; g++) {
    const gy = plotTop + ((plotBot - plotTop) * g) / 3
    ctx.beginPath()
    ctx.moveTo(plotX, gy)
    ctx.lineTo(plotX + plotW, gy)
    ctx.stroke()
  }

  lines.forEach((s, si) => {
    const color = s.color || SERIES_COLORS[si % SERIES_COLORS.length]
    const n = s.points.length
    const pts = s.points.map((v, i) => ({ x: mapX(i, n), y: mapY(v) }))
    // gradient fill under the primary line only
    if (si === 0) {
      const grad = ctx.createLinearGradient(0, plotTop, 0, plotBot)
      grad.addColorStop(0, rgba(color, 0.16))
      grad.addColorStop(1, rgba(color, 0))
      ctx.beginPath()
      ctx.moveTo(pts[0].x, pts[0].y)
      for (const p of pts.slice(1)) ctx.lineTo(p.x, p.y)
      ctx.lineTo(pts[pts.length - 1].x, plotBot)
      ctx.lineTo(pts[0].x, plotBot)
      ctx.closePath()
      ctx.fillStyle = grad
      ctx.fill()
    }
    ctx.beginPath()
    ctx.moveTo(pts[0].x, pts[0].y)
    for (const p of pts.slice(1)) ctx.lineTo(p.x, p.y)
    ctx.strokeStyle = color
    ctx.lineWidth = 3.5
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'
    ctx.stroke()
    // end dot
    const last = pts[pts.length - 1]
    ctx.beginPath()
    ctx.arc(last.x, last.y, 5, 0, Math.PI * 2)
    ctx.fillStyle = color
    ctx.fill()
    // series name at the end of the line
    ctx.font = `800 15px ${SANS}`
    ctx.fillStyle = color
    ctx.textBaseline = 'middle'
    ctx.fillText(s.name, last.x + 10, last.y)
  })
  ctx.textBaseline = 'alphabetic'

  // x labels (first & last)
  if (xLabels.length) {
    ctx.font = `600 13px ${SANS}`
    ctx.fillStyle = MUT2
    ctx.textAlign = 'left'
    ctx.fillText(xLabels[0], plotX, plotBot + 22)
    if (xLabels.length > 1) {
      ctx.textAlign = 'right'
      ctx.fillText(xLabels[xLabels.length - 1], plotX + plotW, plotBot + 22)
      ctx.textAlign = 'left'
    }
  }
}

function drawStat(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, stat: SnapStat) {
  const cx = x + w / 2
  const cy = y + h / 2
  // label above (centred; small letter-spacing baked into the string)
  ctx.textAlign = 'center'
  ctx.font = `700 16px ${SANS}`
  ctx.fillStyle = MUT
  const lbl = (stat.label || '').toUpperCase().split('').join(' ')
  ctx.fillText(lbl, cx, cy - 92)
  // big value — shrink to fit the column
  let size = 132
  do {
    ctx.font = `800 ${size}px ${SANS}`
    if (ctx.measureText(stat.value).width <= w - 20) break
    size -= 4
  } while (size > 48)
  ctx.font = `800 ${size}px ${SANS}`
  ctx.fillStyle = PLUM
  ctx.textBaseline = 'middle'
  ctx.fillText(stat.value, cx, cy - 6)
  ctx.textBaseline = 'alphabetic'
  // context below, wrapped
  ctx.font = `500 19px ${SANS}`
  ctx.fillStyle = INK2
  const ctxLines = wrap(ctx, stat.context, w - 30).slice(0, 3)
  let ly = cy + 66
  for (const ln of ctxLines) {
    ctx.fillText(ln, cx, ly)
    ly += 26
  }
  ctx.textAlign = 'left'
}

// ---------------------------------------------------------------------------

export async function renderDataSnapshotCard(d: DataSnapshotData): Promise<{ blob: Blob; dataUrl: string }> {
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas not supported')

  ctx.fillStyle = PAPER
  ctx.fillRect(0, 0, W, H)
  ctx.textBaseline = 'alphabetic'
  ctx.textAlign = 'left'

  // ---- header (shared frame) ----
  const lg = 34
  const ly = PADT
  const grad = ctx.createLinearGradient(PADX, ly, PADX + lg, ly + lg)
  grad.addColorStop(0, '#6d4aa8')
  grad.addColorStop(1, '#a896f7')
  roundRect(ctx, PADX, ly, lg, lg, 9)
  ctx.fillStyle = grad
  ctx.fill()
  const hx = PADX + lg + 12
  ctx.font = `800 26px ${SANS}`
  ctx.fillStyle = INK
  ctx.fillText('Mun', hx, ly + 26)
  const mw = ctx.measureText('Mun').width
  ctx.fillStyle = PLUM
  ctx.fillText('shot', hx + mw, ly + 26)
  const sw = ctx.measureText('shot').width
  ctx.fillText('Data Snapshot', hx + mw + sw + 16, ly + 26)
  ctx.textAlign = 'right'
  ctx.font = `700 15px ${SANS}`
  ctx.fillStyle = '#8a8398'
  ctx.fillText(d.date, W - PADX, ly + 14)
  ctx.font = `600 13px ${SANS}`
  ctx.fillStyle = MUT2
  ctx.fillText('One chart that matters.', W - PADX, ly + 34)
  ctx.textAlign = 'left'

  // ---- title + subtitle ----
  const maxW = W - PADX * 2
  ctx.font = `800 44px ${SANS}`
  const titleLines = wrap(ctx, d.title, maxW)
  let ty = PADT + 34 + 42
  ctx.fillStyle = INK
  for (const ln of titleLines) {
    ctx.fillText(ln, PADX, ty)
    ty += 50
  }
  ctx.font = `500 16px ${SANS}`
  ctx.fillStyle = '#7a7488'
  ty += 2
  for (const ln of wrap(ctx, d.subtitle, maxW)) {
    ctx.fillText(ln, PADX, ty)
    ty += 22
  }

  // ---- body split ----
  const bodyTop = ty + 30
  const footY = H - 52
  const bodyBot = footY - 46
  const gap = 38
  const sideW = 450
  const chartW = maxW - gap - sideW
  const chartX = PADX
  const sideX = PADX + chartW + gap
  const chartH = bodyBot - bodyTop

  // ---- chart (varies by layout) ----
  if (d.layout === 'trend') drawTrend(ctx, chartX, bodyTop, chartW, chartH, d.series, d.xLabels)
  else if (d.layout === 'ranking') drawRanking(ctx, chartX, bodyTop, chartW, chartH, d.bars)
  else if (d.layout === 'stat') drawStat(ctx, chartX, bodyTop, chartW, chartH, d.stat)
  else drawBars(ctx, chartX, bodyTop, chartW, chartH, d.bars)

  // ---- sidebar card (shared frame) ----
  const cardTop = bodyTop
  const cardH = bodyBot - bodyTop
  ctx.save()
  ctx.shadowColor = 'rgba(80,60,120,0.10)'
  ctx.shadowBlur = 30
  ctx.shadowOffsetY = 8
  roundRect(ctx, sideX, cardTop, sideW, cardH, 16)
  ctx.fillStyle = '#ffffff'
  ctx.fill()
  ctx.restore()
  roundRect(ctx, sideX + 0.5, cardTop + 0.5, sideW - 1, cardH - 1, 16)
  ctx.strokeStyle = '#ece8f2'
  ctx.lineWidth = 1
  ctx.stroke()

  const six = sideX + 28
  const siw = sideW - 56
  ctx.font = `800 13px ${SANS}`
  ctx.fillStyle = MUT
  drawTracked(ctx, 'WHAT THE NUMBERS SAY', six, cardTop + 40, 1.5)

  let sy = cardTop + 40 + 34
  for (const tk of d.takeaways.filter((t) => t.lead.trim() || t.text.trim()).slice(0, 3)) {
    const col = TONE[tk.tone] || PLUM
    ctx.font = `800 19px ${SANS}`
    ctx.fillStyle = col
    const leadY = sy + 4
    ctx.fillText(tk.lead, six + 16, leadY)
    ctx.font = `400 15px ${SANS}`
    ctx.fillStyle = INK2
    let lyy = leadY + 24
    for (const ln of wrap(ctx, tk.text, siw - 16)) {
      ctx.fillText(ln, six + 16, lyy)
      lyy += 21
    }
    const blockBottom = lyy - 21 + 6
    ctx.fillStyle = col
    ctx.fillRect(six, sy - 12, 4, blockBottom - (sy - 12))
    sy = blockBottom + 22
  }

  if (d.watchNext.trim()) {
    const wnTop = cardTop + cardH - 92
    ctx.strokeStyle = '#e2ddec'
    ctx.lineWidth = 1
    ctx.setLineDash([4, 4])
    ctx.beginPath()
    ctx.moveTo(six, wnTop)
    ctx.lineTo(six + siw, wnTop)
    ctx.stroke()
    ctx.setLineDash([])
    ctx.font = `800 12px ${SANS}`
    ctx.fillStyle = MUT
    drawTracked(ctx, 'WATCH NEXT', six, wnTop + 24, 1.3)
    ctx.font = `italic 400 14.5px ${SANS}`
    ctx.fillStyle = '#6f697e'
    let wy = wnTop + 46
    for (const ln of wrap(ctx, d.watchNext, siw).slice(0, 2)) {
      ctx.fillText(ln, six, wy)
      wy += 20
    }
  }

  // ---- footer (shared frame) ----
  ctx.strokeStyle = '#ebe7f0'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(PADX, footY - 24)
  ctx.lineTo(W - PADX, footY - 24)
  ctx.stroke()
  const pre = `Source: ${d.source} · compiled by `
  ctx.font = `500 13px ${SANS}`
  ctx.fillStyle = MUT2
  ctx.fillText(pre, PADX, footY)
  const pw = ctx.measureText(pre).width
  ctx.font = `700 13px ${SANS}`
  ctx.fillStyle = PLUM
  ctx.fillText('Munshot', PADX + pw, footY)
  ctx.font = `500 13px ${SANS}`
  ctx.fillStyle = MUT2
  ctx.textAlign = 'right'
  ctx.fillText('munshot.io · for information only, not investment advice', W - PADX, footY)
  ctx.textAlign = 'left'

  const dataUrl = canvas.toDataURL('image/png')
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Image export failed'))), 'image/png'),
  )
  return { blob, dataUrl }
}
