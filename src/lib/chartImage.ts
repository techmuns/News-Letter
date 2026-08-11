/* "Chart of the Day" — a branded, cross-market performance chart rendered on the
   client canvas from OUR /api/daily-pulse feed. A diverging horizontal bar chart
   of the day's 1-day % moves across indices, commodities and FX, so the whole
   market reads in one glance. Same output contract as pulseImage.ts / brandedImage.ts:
   { blob, dataUrl }. Self-contained (no external image → nothing taints the canvas). */
import type { PulseItem } from './api'

const W = 1200
const H = 675
const PAD = 64

const UP = '#54d98c'
const DOWN = '#f7a3a3'
const VIOLET = '#a896f7'
const INK = '#ffffff'
const MUTE = 'rgba(202,191,248,0.62)'
const AXIS = 'rgba(255,255,255,0.16)'

const MONO = 'ui-monospace, SFMono-Regular, Menlo, monospace'
const SANS = "system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2)
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

function paintHeader(ctx: CanvasRenderingContext2D, title: string, dateLabel: string): number {
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

  if (dateLabel) {
    ctx.textAlign = 'right'
    ctx.fillStyle = MUTE
    ctx.font = `500 17px ${MONO}`
    ctx.fillText(dateLabel, W - PAD, PAD + 17)
    ctx.textAlign = 'left'
  }

  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = INK
  ctx.font = `700 44px ${SANS}`
  ctx.fillText(title, PAD, PAD + 92)

  ctx.fillStyle = VIOLET
  roundRect(ctx, PAD, PAD + 108, 58, 5, 3)
  ctx.fill()

  return PAD + 150
}

function paintFooter(ctx: CanvasRenderingContext2D, note: string) {
  ctx.fillStyle = MUTE
  ctx.font = `500 17px ${MONO}`
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
  ctx.fillText('munshot.io · market intelligence', PAD, H - 34)
  if (note) {
    ctx.textAlign = 'right'
    ctx.fillText(note, W - PAD, H - 34)
    ctx.textAlign = 'left'
  }
}

const pctText = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(n).toFixed(2)}%`

async function exportCanvas(canvas: HTMLCanvasElement): Promise<{ blob: Blob; dataUrl: string }> {
  const dataUrl = canvas.toDataURL('image/png')
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Image export failed'))), 'image/png'),
  )
  return { blob, dataUrl }
}

/** A macro cross-section for the chart: indices, then commodities, then FX.
    Holdings are left out to keep it a market-wide read (capped at `n` rows). */
export function pickChartItems(items: PulseItem[], n = 7): PulseItem[] {
  const order: PulseItem['group'][] = ['index', 'commodity', 'currency']
  const picked: PulseItem[] = []
  for (const g of order) for (const it of items) if (it.group === g) picked.push(it)
  return picked.slice(0, n)
}

/** Diverging horizontal bar chart of 1-day % moves. */
export async function renderChartOfDay(
  items: PulseItem[],
  opts?: { dateLabel?: string; title?: string },
): Promise<{ blob: Blob; dataUrl: string }> {
  const { canvas, ctx } = newCanvas()
  paintBackground(ctx)
  const top = paintHeader(ctx, opts?.title || 'Chart of the Day', opts?.dateLabel || '')

  const rows = pickChartItems(items, 7)
  const footerY = H - 78
  const areaH = footerY - top
  const n = Math.max(rows.length, 1)
  const stride = areaH / n
  const barH = Math.min(30, stride * 0.46)

  // layout columns: name label | plot area (diverging from a center axis)
  const labelW = 300
  const plotX = PAD + labelW
  const plotW = W - PAD - plotX
  const zeroX = plotX + plotW / 2
  const halfW = plotW / 2 - 96 // room for the % label past each bar tip
  const maxAbs = Math.max(0.5, ...rows.map((it) => Math.abs(it.d1)))

  // zero axis
  ctx.strokeStyle = AXIS
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.moveTo(zeroX, top - 6)
  ctx.lineTo(zeroX, footerY)
  ctx.stroke()
  ctx.fillStyle = MUTE
  ctx.font = `500 14px ${MONO}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  ctx.fillText('0%', zeroX, footerY + 22)

  for (let i = 0; i < rows.length; i++) {
    const it = rows[i]
    const cy = top + stride * i + stride / 2
    const positive = it.d1 >= 0
    const color = it.d1 > 0 ? UP : it.d1 < 0 ? DOWN : MUTE
    const w = (Math.abs(it.d1) / maxAbs) * halfW

    // name (left column, right-aligned to the axis gutter)
    ctx.fillStyle = INK
    ctx.font = `600 22px ${SANS}`
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    let name = it.name
    const nameMax = labelW - 8
    if (ctx.measureText(name).width > nameMax) {
      while (ctx.measureText(name + '…').width > nameMax && name.length > 3) name = name.slice(0, -1)
      name = name.replace(/[\s&·,/-]+$/, '') + '…'
    }
    ctx.fillText(name, PAD, cy)

    // bar (diverging from the zero axis)
    const bx = positive ? zeroX : zeroX - w
    ctx.fillStyle = color
    roundRect(ctx, bx, cy - barH / 2, positive ? w : w, barH, 6)
    // ensure a visible sliver even for ~0 moves
    if (w < 3) {
      ctx.fillRect(positive ? zeroX : zeroX - 3, cy - barH / 2, 3, barH)
    } else {
      ctx.fill()
    }

    // % value just past the bar tip, on the outer side
    ctx.fillStyle = color
    ctx.font = `700 18px ${MONO}`
    ctx.textBaseline = 'middle'
    if (positive) {
      ctx.textAlign = 'left'
      ctx.fillText(pctText(it.d1), zeroX + Math.max(w, 3) + 12, cy)
    } else {
      ctx.textAlign = 'right'
      ctx.fillText(pctText(it.d1), zeroX - Math.max(w, 3) - 12, cy)
    }
  }

  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
  paintFooter(ctx, '1-day % change')
  return exportCanvas(canvas)
}
