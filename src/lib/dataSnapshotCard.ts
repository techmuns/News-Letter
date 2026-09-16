/* Munshot "Data Snapshot" card — an editorial chart graphic in the vein of a
   research-desk snapshot: a finding as the headline, a horizontal bar chart of
   index moves (the visual IS the argument), and a "what the numbers say"
   sidebar of colour-coded takeaways + a "watch next" line. Light/editorial
   look (white ground, plum accent), rendered entirely on canvas so the PNG
   exports for hosting/Buffer. Landscape 1200×900. */

export type SnapTone = 'red' | 'green' | 'plum'

export interface SnapBar {
  name: string // "Dow Jones"
  sub: string // "52,786" (the level, shown small next to the name)
  pct: string // "-1.18" — signed, no % sign
}

export interface SnapTakeaway {
  tone: SnapTone
  lead: string // bold coloured label
  text: string // one sentence
}

export interface DataSnapshotData {
  date: string // "September 8, 2026"
  title: string // the finding — the big headline
  subtitle: string // dataset / method line
  bars: SnapBar[] // 2–5 index rows
  takeaways: SnapTakeaway[] // up to 3
  watchNext: string // the "what to watch" line
  source: string // "exchange close data, 8 Sep 2026"
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

const SANS = '-apple-system, "Segoe UI", Roboto, Arial, sans-serif'

const TONE: Record<SnapTone, string> = { red: RED, green: GREEN, plum: PLUM }

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

/** Draw text with per-character letter-spacing (canvas letterSpacing is patchy). */
function drawTracked(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, sp: number) {
  let cx = x
  for (const ch of text) {
    ctx.fillText(ch, cx, y)
    cx += ctx.measureText(ch).width + sp
  }
}

export async function renderDataSnapshotCard(d: DataSnapshotData): Promise<{ blob: Blob; dataUrl: string }> {
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas not supported')

  ctx.fillStyle = PAPER
  ctx.fillRect(0, 0, W, H)
  ctx.textBaseline = 'alphabetic'

  // ---- header ----
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
  // right column: date + tagline
  ctx.textAlign = 'right'
  ctx.font = `700 15px ${SANS}`
  ctx.fillStyle = '#8a8398'
  ctx.fillText(d.date, W - PADX, ly + 14)
  ctx.font = `600 13px ${SANS}`
  ctx.fillStyle = MUT2
  ctx.fillText('One chart that matters.', W - PADX, ly + 34)
  ctx.textAlign = 'left'

  // ---- title (the finding) ----
  const maxW = W - PADX * 2
  ctx.font = `800 44px ${SANS}`
  const titleLines = wrap(ctx, d.title, maxW)
  let ty = PADT + 34 + 42
  ctx.fillStyle = INK
  for (const ln of titleLines) {
    ctx.fillText(ln, PADX, ty)
    ty += 50
  }
  // subtitle
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

  // ---- bars ----
  const bars = d.bars.slice(0, 5)
  const maxAbs = Math.max(...bars.map((b) => Math.abs(parseFloat(b.pct) || 0)), 0.01)
  const trackH = 26
  const labelGap = 9
  const labelH = 24
  const blockH = labelH + labelGap + trackH
  const avail = bodyBot - bodyTop
  const step = bars.length > 1 ? Math.min(96, (avail - blockH) / (bars.length - 1)) : 0
  const startY = bodyTop + (avail - (blockH + step * (bars.length - 1))) / 2
  const cxAxis = chartX + chartW / 2
  const maxHalf = (chartW / 2) * 0.9
  bars.forEach((b, i) => {
    const y = startY + i * step
    const num = parseFloat(b.pct) || 0
    const flat = Math.abs(num) < 0.15
    const t = Math.abs(num) / maxAbs
    const col = flat ? AMBER : num < 0 ? mix('#eab8b8', '#d64545', t) : mix('#a6d8bf', '#2f9e6f', t)

    // label row: name + level, then % on the right
    ctx.textBaseline = 'alphabetic'
    ctx.font = `800 20px ${SANS}`
    ctx.fillStyle = INK
    ctx.fillText(b.name, chartX, y + 18)
    const nmW = ctx.measureText(b.name).width
    ctx.font = `600 14px ${SANS}`
    ctx.fillStyle = MUT
    ctx.fillText(b.sub, chartX + nmW + 10, y + 18)
    ctx.font = `800 20px ${SANS}`
    ctx.fillStyle = flat ? AMBER : num < 0 ? RED : GREEN
    const sign = num < 0 ? '−' : '+'
    const pctTxt = `${sign}${Math.abs(num).toFixed(2)}%`
    ctx.textAlign = 'right'
    ctx.fillText(pctTxt, chartX + chartW, y + 18)
    ctx.textAlign = 'left'

    // track + fill from the centre axis
    const trackY = y + labelH + labelGap
    roundRect(ctx, chartX, trackY, chartW, trackH, 7)
    ctx.fillStyle = '#f0edf5'
    ctx.fill()
    const half = Math.max(t * maxHalf, flat ? 7 : 10)
    if (num < 0 || flat) {
      roundRect(ctx, cxAxis - half, trackY, half, trackH, 7)
    } else {
      roundRect(ctx, cxAxis, trackY, half, trackH, 7)
    }
    ctx.fillStyle = col
    ctx.fill()
    // centre axis
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

  // ---- sidebar card ----
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
  for (const tk of d.takeaways.slice(0, 3)) {
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
    // colour-coded left border, sized to the block
    ctx.fillStyle = col
    ctx.fillRect(six, sy - 12, 4, blockBottom - (sy - 12))
    sy = blockBottom + 22
  }

  // watch next, pinned near the bottom of the card
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

  // ---- footer ----
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
