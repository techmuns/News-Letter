/* Branded Daily Pulse images, rendered on the client canvas (no external photo,
   so nothing taints the canvas / blocks export). Two layouts, both from OUR
   /api/daily-pulse feed:

     • renderGainersLosersCard — a Top Gainers / Top Losers card built from the
       13 holdings' 1-day moves (mirrors the "End of Day Market Summary" card).
     • renderIndexBoardCard — an index board (Nifty, Sensex, S&P, Nasdaq) with
       level + % + sparkline (mirrors the "Morning Markets update" board).

   Same output contract as src/lib/brandedImage.ts: { blob, dataUrl }. */
import type { PulseItem } from './api'

export type PulseImageStyle = 'gainers' | 'index'

const W = 1200
const H = 675
const PAD = 64

const UP = '#54d98c'
const DOWN = '#f7a3a3'
const VIOLET = '#a896f7'
const INK = '#ffffff'
const MUTE = 'rgba(202,191,248,0.62)'

const MONO = 'ui-monospace, SFMono-Regular, Menlo, monospace'
const SANS = "system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"

/* ---- shared drawing helpers -------------------------------------------- */

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + rr, y)
  ctx.arcTo(x + w, y, x + w, y + h, rr)
  ctx.arcTo(x + w, y + h, x, y + h, rr)
  ctx.arcTo(x, y + h, x, y, rr)
  ctx.arcTo(x, y, x + w, y, rr)
  ctx.closePath()
}

function setSpacing(ctx: CanvasRenderingContext2D, px: string) {
  try {
    ;(ctx as any).letterSpacing = px
  } catch {
    /* older canvas */
  }
}

function newCanvas(): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas not supported')
  return { canvas, ctx }
}

function paintBackground(ctx: CanvasRenderingContext2D) {
  const g = ctx.createLinearGradient(0, 0, W, H)
  g.addColorStop(0, '#17131f')
  g.addColorStop(0.55, '#1e1930')
  g.addColorStop(1, '#2a2340')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)
  const rg = ctx.createRadialGradient(W - 160, 90, 30, W - 160, 90, 620)
  rg.addColorStop(0, 'rgba(157,140,245,0.20)')
  rg.addColorStop(1, 'rgba(157,140,245,0)')
  ctx.fillStyle = rg
  ctx.fillRect(0, 0, W, H)
}

/** Header block: brand mark, eyebrow, title, right-aligned date. Returns the y
    baseline where body content can begin. */
function paintHeader(ctx: CanvasRenderingContext2D, title: string, dateLabel: string): number {
  // brand mark
  ctx.fillStyle = '#12101e'
  roundRect(ctx, PAD, PAD, 34, 34, 9)
  ctx.fill()
  ctx.strokeStyle = 'rgba(170,152,248,0.55)'
  ctx.lineWidth = 1.5
  roundRect(ctx, PAD, PAD, 34, 34, 9)
  ctx.stroke()
  ctx.fillStyle = VIOLET
  ctx.beginPath()
  ctx.arc(PAD + 17, PAD + 17, 5, 0, Math.PI * 2)
  ctx.fill()

  ctx.textBaseline = 'middle'
  setSpacing(ctx, '2px')
  ctx.fillStyle = '#cabff8'
  ctx.font = `600 18px ${MONO}`
  ctx.fillText('MUNSHOT · DAILY PULSE', PAD + 48, PAD + 17)
  setSpacing(ctx, '0px')

  // date, right-aligned on the brand row
  if (dateLabel) {
    ctx.textAlign = 'right'
    ctx.fillStyle = MUTE
    ctx.font = `500 17px ${MONO}`
    ctx.fillText(dateLabel, W - PAD, PAD + 17)
    ctx.textAlign = 'left'
  }

  // title
  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = INK
  ctx.font = `700 44px ${SANS}`
  ctx.fillText(title, PAD, PAD + 92)

  // accent underline
  ctx.fillStyle = VIOLET
  roundRect(ctx, PAD, PAD + 108, 58, 5, 3)
  ctx.fill()

  return PAD + 150
}

function paintFooter(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = MUTE
  ctx.font = `500 17px ${MONO}`
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
  ctx.fillText('munshot.io · market intelligence', PAD, H - 34)
}

const pctText = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(n).toFixed(2)}%`
const money = (n: number, cur: string) =>
  `${cur}${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
const plain = (n: number) => n.toLocaleString('en-IN', { maximumFractionDigits: 2 })

/** Absolute 1-day change implied by the % move and current level. */
function absChange(it: PulseItem): number {
  const prev = it.current / (1 + it.d1 / 100)
  return it.current - prev
}

/** A small initials chip, like a company logo placeholder. */
function paintChip(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, label: string, tint: string) {
  ctx.fillStyle = 'rgba(255,255,255,0.06)'
  roundRect(ctx, x, y, size, size, 9)
  ctx.fill()
  ctx.strokeStyle = tint
  ctx.lineWidth = 1.25
  roundRect(ctx, x, y, size, size, 9)
  ctx.stroke()
  ctx.fillStyle = tint
  ctx.font = `700 ${Math.round(size * 0.42)}px ${SANS}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(label.slice(0, 2).toUpperCase(), x + size / 2, y + size / 2 + 1)
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
}

function paintSparkline(
  ctx: CanvasRenderingContext2D,
  points: number[],
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
) {
  if (!points || points.length < 2) return
  const min = Math.min(...points)
  const max = Math.max(...points)
  const span = max - min || 1
  ctx.beginPath()
  points.forEach((p, i) => {
    const px = x + (i / (points.length - 1)) * w
    const py = y + h - ((p - min) / span) * h
    if (i === 0) ctx.moveTo(px, py)
    else ctx.lineTo(px, py)
  })
  ctx.strokeStyle = color
  ctx.lineWidth = 2.4
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  ctx.stroke()
}

async function exportCanvas(canvas: HTMLCanvasElement): Promise<{ blob: Blob; dataUrl: string }> {
  const dataUrl = canvas.toDataURL('image/png')
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Image export failed'))), 'image/png'),
  )
  return { blob, dataUrl }
}

/* ---- card 1: Top Gainers / Top Losers (from holdings) ------------------ */

export function pickGainersLosers(items: PulseItem[], n = 3): { gainers: PulseItem[]; losers: PulseItem[] } {
  const holdings = items.filter((it) => it.group === 'holding').slice().sort((a, b) => b.d1 - a.d1)
  const gainers = holdings.filter((h) => h.d1 > 0).slice(0, n)
  const losers = holdings
    .filter((h) => h.d1 < 0)
    .slice(-n)
    .reverse()
  return { gainers, losers }
}

export async function renderGainersLosersCard(
  items: PulseItem[],
  opts?: { dateLabel?: string; currency?: string },
): Promise<{ blob: Blob; dataUrl: string }> {
  const { canvas, ctx } = newCanvas()
  const cur = opts?.currency ?? '₹'
  paintBackground(ctx)
  const top = paintHeader(ctx, 'Holdings — Gainers & Losers', opts?.dateLabel || '')

  const { gainers, losers } = pickGainersLosers(items, 3)
  const colGap = 40
  const colW = (W - PAD * 2 - colGap) / 2
  const rowH = 96
  const rowGap = 14

  const column = (x: number, heading: string, tint: string, rows: PulseItem[], empty: string) => {
    ctx.fillStyle = tint
    setSpacing(ctx, '1.5px')
    ctx.font = `700 16px ${MONO}`
    ctx.textBaseline = 'alphabetic'
    ctx.fillText(heading.toUpperCase(), x + 4, top + 6)
    setSpacing(ctx, '0px')

    let y = top + 22
    if (!rows.length) {
      ctx.fillStyle = 'rgba(255,255,255,0.04)'
      roundRect(ctx, x, y, colW, rowH, 14)
      ctx.fill()
      ctx.fillStyle = MUTE
      ctx.font = `500 20px ${SANS}`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(empty, x + colW / 2, y + rowH / 2)
      ctx.textAlign = 'left'
      ctx.textBaseline = 'alphabetic'
      return
    }
    for (const it of rows) {
      // row card
      ctx.fillStyle = 'rgba(255,255,255,0.045)'
      roundRect(ctx, x, y, colW, rowH, 14)
      ctx.fill()

      paintChip(ctx, x + 18, y + rowH / 2 - 22, 44, it.name, tint)

      // name + sector
      ctx.fillStyle = INK
      ctx.font = `600 24px ${SANS}`
      ctx.textBaseline = 'alphabetic'
      const nameMax = colW - 210
      let name = it.name
      if (ctx.measureText(name).width > nameMax) {
        while (ctx.measureText(name + '…').width > nameMax && name.length > 3) name = name.slice(0, -1)
        name = name.replace(/[\s&·,-]+$/, '') + '…'
      }
      ctx.fillText(name, x + 78, y + 40)
      ctx.fillStyle = MUTE
      ctx.font = `500 15px ${MONO}`
      ctx.fillText(`${(it.sector || 'Holding').toUpperCase()} · ${it.ticker}`, x + 78, y + 66)

      // price + change (right-aligned)
      const rx = x + colW - 20
      ctx.textAlign = 'right'
      ctx.fillStyle = INK
      ctx.font = `700 24px ${SANS}`
      ctx.fillText(money(it.current, cur), rx, y + 40)
      const c = it.d1 > 0 ? UP : it.d1 < 0 ? DOWN : MUTE
      ctx.fillStyle = c
      ctx.font = `700 17px ${MONO}`
      const abs = absChange(it)
      const absTxt = `${abs >= 0 ? '+' : '−'}${cur}${plain(Math.abs(abs))}`
      ctx.fillText(`${pctText(it.d1)}   ${absTxt}`, rx, y + 66)
      ctx.textAlign = 'left'

      y += rowH + rowGap
    }
  }

  column(PAD, 'Top Gainers', UP, gainers, 'No gainers today')
  column(PAD + colW + colGap, 'Top Losers', DOWN, losers, 'No decliners today')

  paintFooter(ctx)
  return exportCanvas(canvas)
}

/* ---- card 2: index board ----------------------------------------------- */

const INDEX_ORDER = ['i-nifty', 'i-sensex', 'i-spx', 'i-nasdaq']

export function pickIndexBoard(items: PulseItem[], n = 4): PulseItem[] {
  const indices = items.filter((it) => it.group === 'index')
  const preferred = INDEX_ORDER.map((id) => indices.find((it) => it.id === id)).filter(Boolean) as PulseItem[]
  const rest = indices.filter((it) => !INDEX_ORDER.includes(it.id))
  return [...preferred, ...rest].slice(0, n)
}

export async function renderIndexBoardCard(
  items: PulseItem[],
  opts?: { dateLabel?: string },
): Promise<{ blob: Blob; dataUrl: string }> {
  const { canvas, ctx } = newCanvas()
  paintBackground(ctx)
  const top = paintHeader(ctx, 'Markets at a Glance', opts?.dateLabel || '')

  const rows = pickIndexBoard(items, 4)
  const areaH = H - top - 90
  const rowH = Math.min(112, (areaH - 3 * 14) / Math.max(rows.length, 1))
  const rowGap = 14
  let y = top

  for (const it of rows) {
    ctx.fillStyle = 'rgba(255,255,255,0.045)'
    roundRect(ctx, PAD, y, W - PAD * 2, rowH, 16)
    ctx.fill()

    const cy = y + rowH / 2
    // name + ticker
    ctx.fillStyle = INK
    ctx.font = `600 27px ${SANS}`
    ctx.textBaseline = 'middle'
    ctx.fillText(it.name, PAD + 28, cy - 12)
    ctx.fillStyle = MUTE
    ctx.font = `500 15px ${MONO}`
    ctx.fillText((it.ticker || 'INDEX').toUpperCase(), PAD + 28, cy + 16)

    const color = it.d1 > 0 ? UP : it.d1 < 0 ? DOWN : MUTE

    // sparkline (center-right)
    const sparkW = 190
    const sparkX = W - PAD - 470
    paintSparkline(ctx, it.spark, sparkX, cy - 22, sparkW, 44, color)

    // level + %
    const rx = W - PAD - 28
    ctx.textAlign = 'right'
    ctx.fillStyle = INK
    ctx.font = `700 30px ${SANS}`
    ctx.fillText(plain(it.current), rx, cy - 10)
    ctx.fillStyle = color
    ctx.font = `700 19px ${MONO}`
    ctx.fillText(pctText(it.d1), rx, cy + 18)
    ctx.textAlign = 'left'

    y += rowH + rowGap
  }

  ctx.textBaseline = 'alphabetic'
  paintFooter(ctx)
  return exportCanvas(canvas)
}

export async function renderPulseImage(
  style: PulseImageStyle,
  items: PulseItem[],
  opts?: { dateLabel?: string },
): Promise<{ blob: Blob; dataUrl: string }> {
  return style === 'index' ? renderIndexBoardCard(items, opts) : renderGainersLosersCard(items, opts)
}
