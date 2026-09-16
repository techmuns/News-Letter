/* Munshot "Data Snapshot" card — an editorial research graphic modelled on a
   research-desk snapshot. A constant, confident FRAME (dark plum masthead with
   a spectrum accent, a finding as the headline, a "what the numbers say"
   sidebar that leads each point with a big colour-coded figure) wraps a CHART
   chosen to fit the story, so different topics produce visibly different posts:

     - bars     compare a few index moves (diverging from a centre axis)
     - trend    one to three series over time (a line chart with markers)
     - ranking  a sorted league table of movers (winners green, losers red)
     - stat     one dominant number with a label and a line of context

   An optional hero image turns the card into a collage (image + headline on the
   left, chart/takeaways on the right) in the vein of Thurro's photo posts.
   Rendered entirely on canvas so the PNG exports for hosting/Buffer.
   Landscape 1200×900. */

import { drawHeroScene } from './heroScenes'

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

export interface SnapTakeaway {
  tone: SnapTone
  figure?: string // optional BIG number that leads the point ("~91%", "2007")
  lead: string // bold label
  text: string // one sentence
}

export interface DataSnapshotData {
  date: string // "September 8, 2026"
  title: string // the finding — the big headline (ink)
  titleAccent?: string // optional tail rendered in plum (two-tone headline)
  subtitle: string // dataset / method line
  layout: SnapLayout
  bars: SnapBar[] // for 'bars' and 'ranking'
  series: SnapSeries[] // for 'trend'
  xLabels: string[] // optional x-axis labels for 'trend' (first & last shown)
  stat: SnapStat // for 'stat'
  takeaways: SnapTakeaway[] // up to 3
  watchNext: string // the "what to watch" line
  source: string // "exchange close data, 8 Sep 2026"
  hero?: string // optional uploaded hero image (data URL) → collage mode
  heroTheme?: string // optional built-in story-image theme → collage mode
}

const W = 1200
const H = 900
const PADX = 48
const MAST_H = 96

const PAPER = '#faf7f2'
const INK = '#1c1726'
const INK2 = '#5a5468'
const MUT = '#8c84a0'
const MUT2 = '#a49bb3'
const PLUM = '#6d4aa8'
const PLUM_D = '#3f2870'
const GREEN = '#1f9d63'
const RED = '#cf3030'
const AMBER = '#c2921f'
const BLUE = '#2f6fb0'

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
function mix(c1: string, c2: string, t: number): string {
  const rgb = (h: string) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]
  const [r1, g1, b1] = rgb(c1)
  const [r2, g2, b2] = rgb(c2)
  return `rgb(${lerp(r1, r2, t)},${lerp(g1, g2, t)},${lerp(b1, b2, t)})`
}
function rgba(hex: string, a: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${a})`
}
function drawTracked(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, sp: number) {
  let cx = x
  for (const ch of text) {
    ctx.fillText(ch, cx, y)
    cx += ctx.measureText(ch).width + sp
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('image load failed'))
    img.src = src
  })
}

/** Draw an image cover-fit into a rounded rect (like CSS object-fit: cover). */
function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number) {
  const ir = img.width / img.height
  const r = w / h
  let sx = 0
  let sy = 0
  let sw = img.width
  let sh = img.height
  if (ir > r) {
    sw = img.height * r
    sx = (img.width - sw) / 2
  } else {
    sh = img.width / r
    sy = (img.height - sh) / 2
  }
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h)
}

// ---------------------------------------------------------------------------
// chart layouts — each fills the given column (x, y, w, h)
// ---------------------------------------------------------------------------

function drawBars(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, bars: SnapBar[]) {
  const rows = bars.filter((b) => b.name.trim()).slice(0, 5)
  if (!rows.length) return
  const maxAbs = Math.max(...rows.map((b) => Math.abs(parseFloat(b.pct) || 0)), 0.01)
  const trackH = 32
  const labelGap = 11
  const labelH = 26
  const blockH = labelH + labelGap + trackH
  const step = rows.length > 1 ? Math.min(104, (h - blockH) / (rows.length - 1)) : 0
  const startY = y + (h - (blockH + step * (rows.length - 1))) / 2
  const cxAxis = x + w / 2
  const maxHalf = (w / 2) * 0.9
  rows.forEach((b, i) => {
    const ry = startY + i * step
    const num = parseFloat(b.pct) || 0
    const flat = Math.abs(num) < 0.15
    const t = Math.abs(num) / maxAbs
    const base = flat ? AMBER : num < 0 ? RED : GREEN
    ctx.textBaseline = 'alphabetic'
    ctx.font = `800 22px ${SANS}`
    ctx.fillStyle = INK
    ctx.fillText(b.name, x, ry + 20)
    const nmW = ctx.measureText(b.name).width
    if (b.sub.trim()) {
      ctx.font = `600 14px ${SANS}`
      ctx.fillStyle = MUT2
      ctx.fillText(b.sub, x + nmW + 11, ry + 20)
    }
    ctx.font = `900 23px ${SANS}`
    ctx.fillStyle = base
    const sign = num < 0 ? '−' : '+'
    ctx.textAlign = 'right'
    ctx.fillText(`${sign}${Math.abs(num).toFixed(2)}%`, x + w, ry + 20)
    ctx.textAlign = 'left'
    const trackY = ry + labelH + labelGap
    roundRect(ctx, x, trackY, w, trackH, 9)
    ctx.fillStyle = '#efe9f4'
    ctx.fill()
    const half = Math.max(t * maxHalf, flat ? 8 : 12)
    const gx0 = num < 0 || flat ? cxAxis - half : cxAxis
    const grad = ctx.createLinearGradient(gx0, 0, gx0 + half, 0)
    if (num < 0 || flat) {
      grad.addColorStop(0, mix(base, '#ffffff', 0.34))
      grad.addColorStop(1, base)
      roundRect(ctx, cxAxis - half, trackY, half, trackH, 9)
    } else {
      grad.addColorStop(0, base)
      grad.addColorStop(1, mix(base, '#ffffff', 0.28))
      roundRect(ctx, cxAxis, trackY, half, trackH, 9)
    }
    ctx.fillStyle = grad
    ctx.fill()
    ctx.strokeStyle = '#c8c0da'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(cxAxis, trackY - 7)
    ctx.lineTo(cxAxis, trackY + trackH + 7)
    ctx.stroke()
    if (flat) {
      ctx.font = `700 12px ${SANS}`
      ctx.fillStyle = MUT2
      ctx.textAlign = 'center'
      ctx.fillText('flat', cxAxis, trackY + trackH + 25)
      ctx.textAlign = 'left'
    }
  })
}

function drawRanking(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, bars: SnapBar[]) {
  const rows = bars
    .filter((b) => b.name.trim())
    .slice(0, 6)
    .sort((a, b) => (parseFloat(b.pct) || 0) - (parseFloat(a.pct) || 0))
  if (!rows.length) return
  const maxAbs = Math.max(...rows.map((b) => Math.abs(parseFloat(b.pct) || 0)), 0.01)
  const barH = 26
  const rowH = Math.min(80, (h - barH) / Math.max(rows.length - 1, 1))
  const startY = y + (h - (barH + rowH * (rows.length - 1))) / 2
  const labelW = 156
  const trackX = x + labelW
  const trackW = w - labelW - 84
  rows.forEach((b, i) => {
    const ry = startY + i * rowH
    const num = parseFloat(b.pct) || 0
    const up = num >= 0
    const base = up ? GREEN : RED
    ctx.textBaseline = 'middle'
    ctx.font = `800 19px ${SANS}`
    ctx.fillStyle = INK
    let nm = b.name
    while (ctx.measureText(nm).width > labelW - 14 && nm.length > 3) nm = nm.slice(0, -1)
    if (nm !== b.name) nm = nm.slice(0, -1) + '…'
    ctx.fillText(nm, x, ry + barH / 2)
    ctx.fillStyle = '#efe9f4'
    roundRect(ctx, trackX, ry, trackW, barH, 8)
    ctx.fill()
    const len = Math.max((Math.abs(num) / maxAbs) * trackW, 10)
    const grad = ctx.createLinearGradient(trackX, 0, trackX + len, 0)
    grad.addColorStop(0, base)
    grad.addColorStop(1, mix(base, '#ffffff', 0.3))
    ctx.fillStyle = grad
    roundRect(ctx, trackX, ry, len, barH, 8)
    ctx.fill()
    ctx.font = `900 18px ${SANS}`
    ctx.fillStyle = base
    ctx.textAlign = 'left'
    ctx.fillText(`${up ? '+' : '−'}${Math.abs(num).toFixed(2)}%`, trackX + trackW + 14, ry + barH / 2)
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
  const plotX = x + 6
  const plotW = w - 6 - 72
  const plotTop = y + 12
  const plotBot = y + h - 30
  const mapX = (i: number, n: number) => plotX + (plotW * i) / (n - 1)
  const mapY = (v: number) => plotBot - ((v - min) / (max - min)) * (plotBot - plotTop)

  ctx.strokeStyle = '#ebe5f1'
  ctx.lineWidth = 1
  for (let g = 0; g <= 3; g++) {
    const gy = plotTop + ((plotBot - plotTop) * g) / 3
    ctx.beginPath()
    ctx.moveTo(plotX, gy)
    ctx.lineTo(plotX + plotW, gy)
    ctx.stroke()
  }

  lines.forEach((s, si) => {
    const color = s.color && s.color.trim() ? s.color : SERIES_COLORS[si % SERIES_COLORS.length]
    const n = s.points.length
    const pts = s.points.map((v, i) => ({ x: mapX(i, n), y: mapY(v) }))
    if (si === 0) {
      const grad = ctx.createLinearGradient(0, plotTop, 0, plotBot)
      grad.addColorStop(0, rgba(color, 0.2))
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
    ctx.lineWidth = 4
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'
    ctx.stroke()
    // markers on every point
    for (const p of pts) {
      ctx.beginPath()
      ctx.arc(p.x, p.y, 4, 0, Math.PI * 2)
      ctx.fillStyle = PAPER
      ctx.fill()
      ctx.lineWidth = 2.5
      ctx.strokeStyle = color
      ctx.stroke()
    }
    const last = pts[pts.length - 1]
    ctx.beginPath()
    ctx.arc(last.x, last.y, 6, 0, Math.PI * 2)
    ctx.fillStyle = color
    ctx.fill()
    ctx.font = `800 15px ${SANS}`
    ctx.fillStyle = color
    ctx.textBaseline = 'middle'
    ctx.fillText(s.name, last.x + 12, last.y)
  })
  ctx.textBaseline = 'alphabetic'

  if (xLabels.length) {
    ctx.font = `700 13px ${SANS}`
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
  // a soft tinted panel so the number sits on something, not empty cream
  const panelH = Math.min(h, 300)
  const panelY = y + (h - panelH) / 2
  roundRect(ctx, x, panelY, w, panelH, 20)
  const pg = ctx.createLinearGradient(x, panelY, x, panelY + panelH)
  pg.addColorStop(0, rgba(PLUM, 0.08))
  pg.addColorStop(1, rgba(PLUM, 0.02))
  ctx.fillStyle = pg
  ctx.fill()
  const cx = x + w / 2
  const cy = panelY + panelH / 2
  ctx.textAlign = 'center'
  ctx.font = `800 15px ${SANS}`
  ctx.fillStyle = MUT
  ctx.fillText((stat.label || '').toUpperCase().split('').join(' '), cx, cy - 74)
  let size = 128
  do {
    ctx.font = `900 ${size}px ${SANS}`
    if (ctx.measureText(stat.value).width <= w - 40) break
    size -= 4
  } while (size > 44)
  ctx.font = `900 ${size}px ${SANS}`
  ctx.fillStyle = PLUM
  ctx.textBaseline = 'middle'
  ctx.fillText(stat.value, cx, cy)
  ctx.textBaseline = 'alphabetic'
  ctx.font = `500 18px ${SANS}`
  ctx.fillStyle = INK2
  let ly = cy + 62
  for (const ln of wrap(ctx, stat.context, w - 60).slice(0, 3)) {
    ctx.fillText(ln, cx, ly)
    ly += 25
  }
  ctx.textAlign = 'left'
}

function dispatchChart(
  ctx: CanvasRenderingContext2D,
  d: DataSnapshotData,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  if (d.layout === 'trend') drawTrend(ctx, x, y, w, h, d.series, d.xLabels)
  else if (d.layout === 'ranking') drawRanking(ctx, x, y, w, h, d.bars)
  else if (d.layout === 'stat') drawStat(ctx, x, y, w, h, d.stat)
  else drawBars(ctx, x, y, w, h, d.bars)
}

// ---------------------------------------------------------------------------
// shared frame pieces
// ---------------------------------------------------------------------------

function drawMasthead(ctx: CanvasRenderingContext2D, date: string) {
  const g = ctx.createLinearGradient(0, 0, W, MAST_H)
  g.addColorStop(0, '#241736')
  g.addColorStop(0.55, PLUM_D)
  g.addColorStop(1, '#573a8f')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, MAST_H)
  // spectrum accent strip
  const s = ctx.createLinearGradient(0, 0, W, 0)
  s.addColorStop(0, '#f0b429')
  s.addColorStop(0.4, '#e0557a')
  s.addColorStop(0.75, '#a896f7')
  s.addColorStop(1, '#3fd89b')
  ctx.fillStyle = s
  ctx.fillRect(0, MAST_H - 4, W, 4)
  // logo
  const lg = 40
  const ly = (MAST_H - lg) / 2 - 2
  const lgrad = ctx.createLinearGradient(PADX, ly, PADX + lg, ly + lg)
  lgrad.addColorStop(0, '#7d5bc0')
  lgrad.addColorStop(1, '#c9b6ff')
  roundRect(ctx, PADX, ly, lg, lg, 11)
  ctx.fillStyle = lgrad
  ctx.fill()
  const tx = PADX + lg + 14
  ctx.textBaseline = 'alphabetic'
  ctx.font = `800 27px ${SANS}`
  ctx.fillStyle = '#ffffff'
  ctx.fillText('Munshot', tx, MAST_H / 2 - 2)
  ctx.font = `800 14px ${SANS}`
  ctx.fillStyle = '#c9b6ff'
  drawTracked(ctx, 'DATA SNAPSHOT', tx, MAST_H / 2 + 22, 3)
  // right
  ctx.textAlign = 'right'
  ctx.font = `700 16px ${SANS}`
  ctx.fillStyle = '#d9ccf5'
  ctx.fillText(date, W - PADX, MAST_H / 2 - 2)
  ctx.font = `600 12.5px ${SANS}`
  ctx.fillStyle = '#a892d8'
  ctx.fillText('One chart that matters.', W - PADX, MAST_H / 2 + 20)
  ctx.textAlign = 'left'
}

function drawTexture(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = rgba(PLUM, 0.05)
  for (let yy = MAST_H + 16; yy < H; yy += 22) {
    for (let xx = 14; xx < W; xx += 22) {
      ctx.beginPath()
      ctx.arc(xx, yy, 1.1, 0, Math.PI * 2)
      ctx.fill()
    }
  }
}

/** Two-tone headline (ink + plum tail), token-wrapped. Returns the baseline y
    after the last line. */
function drawTitle(ctx: CanvasRenderingContext2D, d: DataSnapshotData, x: number, top: number, maxW: number): number {
  type Tok = { t: string; accent: boolean }
  const toks: Tok[] = [
    ...d.title.split(/\s+/).filter(Boolean).map((t) => ({ t, accent: false })),
    ...(d.titleAccent || '').split(/\s+/).filter(Boolean).map((t) => ({ t, accent: true })),
  ]
  const size = 45
  ctx.font = `800 ${size}px ${SANS}`
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
  const lineH = Math.round(size * 1.08)
  let ty = top + size
  for (const row of rows) {
    let tx = x
    for (const tok of row) {
      ctx.fillStyle = tok.accent ? PLUM : INK
      ctx.fillText(tok.t, tx, ty)
      tx += ctx.measureText(tok.t).width + space
    }
    ty += lineH
  }
  return ty - lineH
}

function drawSidebar(
  ctx: CanvasRenderingContext2D,
  d: DataSnapshotData,
  x: number,
  top: number,
  w: number,
  h: number,
) {
  ctx.save()
  ctx.shadowColor = 'rgba(60,40,110,0.13)'
  ctx.shadowBlur = 40
  ctx.shadowOffsetY = 16
  roundRect(ctx, x, top, w, h, 18)
  ctx.fillStyle = '#ffffff'
  ctx.fill()
  ctx.restore()
  roundRect(ctx, x + 0.5, top + 0.5, w - 1, h - 1, 18)
  ctx.strokeStyle = '#efeaf5'
  ctx.lineWidth = 1
  ctx.stroke()
  // top accent bar
  const ax = x + 28
  const aw = w - 56
  const ag = ctx.createLinearGradient(ax, 0, ax + aw, 0)
  ag.addColorStop(0, PLUM)
  ag.addColorStop(1, '#a896f7')
  ctx.fillStyle = ag
  roundRect(ctx, ax, top, aw, 5, 3)
  ctx.fill()

  const six = x + 28
  const siw = w - 56
  ctx.textBaseline = 'alphabetic'
  ctx.font = `900 13px ${SANS}`
  ctx.fillStyle = MUT
  drawTracked(ctx, 'WHAT THE NUMBERS SAY', six, top + 46, 1.6)

  let sy = top + 46 + 30
  for (const tk of d.takeaways.filter((t) => t.lead.trim() || t.text.trim() || (t.figure || '').trim()).slice(0, 3)) {
    const col = TONE[tk.tone] || PLUM
    const blockTop = sy
    let cy = sy
    if ((tk.figure || '').trim()) {
      ctx.font = `900 33px ${SANS}`
      ctx.fillStyle = col
      ctx.fillText(tk.figure as string, six + 16, cy + 26)
      cy += 40
    }
    if (tk.lead.trim()) {
      ctx.font = `800 16px ${SANS}`
      ctx.fillStyle = INK
      ctx.fillText(tk.lead, six + 16, cy + 14)
      cy += 22
    }
    if (tk.text.trim()) {
      ctx.font = `400 14.5px ${SANS}`
      ctx.fillStyle = INK2
      let lyy = cy + 12
      for (const ln of wrap(ctx, tk.text, siw - 16)) {
        ctx.fillText(ln, six + 16, lyy)
        lyy += 20
      }
      cy = lyy - 20
    }
    const blockBottom = cy + 8
    ctx.fillStyle = col
    roundRect(ctx, six, blockTop - 6, 5, blockBottom - (blockTop - 6), 2.5)
    ctx.fill()
    sy = blockBottom + 20
  }

  if (d.watchNext.trim()) {
    const wnTop = top + h - 92
    ctx.strokeStyle = '#e3ddec'
    ctx.lineWidth = 1
    ctx.setLineDash([4, 4])
    ctx.beginPath()
    ctx.moveTo(six, wnTop)
    ctx.lineTo(six + siw, wnTop)
    ctx.stroke()
    ctx.setLineDash([])
    ctx.font = `900 12px ${SANS}`
    ctx.fillStyle = MUT
    drawTracked(ctx, 'WATCH NEXT', six, wnTop + 24, 1.4)
    ctx.font = `italic 400 14.5px ${SANS}`
    ctx.fillStyle = '#655f73'
    let wy = wnTop + 46
    for (const ln of wrap(ctx, d.watchNext, siw).slice(0, 2)) {
      ctx.fillText(ln, six, wy)
      wy += 20
    }
  }
}

function drawFooter(ctx: CanvasRenderingContext2D, d: DataSnapshotData) {
  const footY = H - 34
  ctx.strokeStyle = '#e9e3f0'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(PADX, footY - 20)
  ctx.lineTo(W - PADX, footY - 20)
  ctx.stroke()
  const pre = `Source: ${d.source} · compiled by `
  ctx.font = `600 13px ${SANS}`
  ctx.fillStyle = MUT2
  ctx.fillText(pre, PADX, footY)
  const pw = ctx.measureText(pre).width
  ctx.font = `800 13px ${SANS}`
  ctx.fillStyle = PLUM
  ctx.fillText('Munshot', PADX + pw, footY)
  ctx.font = `600 13px ${SANS}`
  ctx.fillStyle = MUT2
  ctx.textAlign = 'right'
  ctx.fillText('munshot.io · not investment advice', W - PADX, footY)
  ctx.textAlign = 'left'
}

// ---------------------------------------------------------------------------

export async function renderDataSnapshotCard(d: DataSnapshotData): Promise<{ blob: Blob; dataUrl: string }> {
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas not supported')

  const hero = (d.hero || '').trim()
  let heroImg: HTMLImageElement | null = null
  if (hero) {
    try {
      heroImg = await loadImage(hero)
    } catch {
      heroImg = null
    }
  }

  // background + texture
  ctx.fillStyle = PAPER
  ctx.fillRect(0, 0, W, H)
  drawTexture(ctx)
  drawMasthead(ctx, d.date)

  const maxW = W - PADX * 2
  ctx.textAlign = 'left'
  const titleBottom = drawTitle(ctx, d, PADX, MAST_H + 30, maxW)
  ctx.font = `500 16.5px ${SANS}`
  ctx.fillStyle = '#6b6478'
  let sy = titleBottom + 30
  for (const ln of wrap(ctx, d.subtitle, maxW)) {
    ctx.fillText(ln, PADX, sy)
    sy += 22
  }

  const bodyTop = sy + 20
  const bodyBot = H - 68
  const bodyH = bodyBot - bodyTop

  const scene = (d.heroTheme || '').trim()
  if (heroImg || scene) {
    // ---- collage: hero visual (left) + figure sidebar (right) ----
    // The image is the visual, so the chart is omitted here (Thurro's
    // "hero + key takeaways" shape); the sidebar gets the full height.
    const heroW = maxW * 0.48
    const gap = 32
    const rightX = PADX + heroW + gap
    const rightW = maxW - heroW - gap
    ctx.save()
    roundRect(ctx, PADX, bodyTop, heroW, bodyH, 18)
    ctx.clip()
    if (heroImg) drawCover(ctx, heroImg, PADX, bodyTop, heroW, bodyH)
    else drawHeroScene(ctx, scene, PADX, bodyTop, heroW, bodyH)
    const scrim = ctx.createLinearGradient(0, bodyTop + bodyH - 180, 0, bodyTop + bodyH)
    scrim.addColorStop(0, 'rgba(20,12,32,0)')
    scrim.addColorStop(1, 'rgba(20,12,32,0.86)')
    ctx.fillStyle = scrim
    ctx.fillRect(PADX, bodyTop + bodyH - 180, heroW, 180)
    ctx.textBaseline = 'alphabetic'
    ctx.font = `800 19px ${SANS}`
    ctx.fillStyle = '#f2ecfb'
    const echo = wrap(ctx, (d.title + ' ' + (d.titleAccent || '')).trim().toUpperCase(), heroW - 48).slice(0, 3)
    let ey = bodyTop + bodyH - 28 - (echo.length - 1) * 26
    for (const ln of echo) {
      ctx.fillText(ln, PADX + 24, ey)
      ey += 26
    }
    ctx.restore()
    roundRect(ctx, PADX + 0.5, bodyTop + 0.5, heroW - 1, bodyH - 1, 18)
    ctx.strokeStyle = 'rgba(0,0,0,0.12)'
    ctx.lineWidth = 1
    ctx.stroke()
    drawSidebar(ctx, d, rightX, bodyTop, rightW, bodyH)
  } else {
    // ---- standard: chart (left) + sidebar (right) ----
    const gap = 34
    const sideW = 446
    const chartW = maxW - gap - sideW
    const chartX = PADX
    const sideX = PADX + chartW + gap
    dispatchChart(ctx, d, chartX, bodyTop, chartW, bodyH)
    drawSidebar(ctx, d, sideX, bodyTop, sideW, bodyH)
  }

  drawFooter(ctx, d)

  const dataUrl = canvas.toDataURL('image/png')
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Image export failed'))), 'image/png'),
  )
  return { blob, dataUrl }
}
