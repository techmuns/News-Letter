/* Built-in "story image" scenes for the Data Snapshot hero panel. Each theme
   renders a rich, on-brand backdrop (themed gradient + a large iconic motif +
   candlestick/particle texture + a bottom vignette for the headline echo) so
   ANY topic gets a relevant visual in one click — no external image tool.
   Drawn on canvas into whatever rect the card gives us. */

export interface HeroTheme {
  key: string
  label: string
}

export const HERO_THEMES: HeroTheme[] = [
  { key: 'gold', label: '🥇 Gold' },
  { key: 'oil', label: '🛢 Oil & energy' },
  { key: 'equities', label: '📈 Equities' },
  { key: 'rupee', label: '₹ Rupee' },
  { key: 'dollar', label: '$ Dollar / US' },
  { key: 'rates', label: '% Rates & bonds' },
  { key: 'crypto', label: '₿ Crypto' },
  { key: 'realty', label: '🏙 Real estate' },
]

interface Scene {
  bg: [string, string]
  glow: string
  metal: [string, string, string] // motif gradient (light, mid, dark)
  motif: 'bars' | 'droplet' | 'arrow' | 'buildings' | 'glyph'
  glyph?: string
  candles: 'up' | 'down' | 'none'
}

const SCENES: Record<string, Scene> = {
  gold: { bg: ['#4a3410', '#140d05'], glow: 'rgba(255,210,120,0.34)', metal: ['#ffe89a', '#e8b53a', '#7a4e00'], motif: 'bars', candles: 'up' },
  oil: { bg: ['#3a2410', '#0c0906'], glow: 'rgba(255,150,60,0.30)', metal: ['#ffcf8a', '#e0821f', '#5a2f06'], motif: 'droplet', candles: 'up' },
  equities: { bg: ['#241736', '#0d0918'], glow: 'rgba(160,140,245,0.32)', metal: ['#c9b6ff', '#8a6ce0', '#3f2870'], motif: 'arrow', candles: 'up' },
  rupee: { bg: ['#0f3a30', '#06140f'], glow: 'rgba(80,220,170,0.28)', metal: ['#b7f0d8', '#39b98a', '#0d5a44'], motif: 'glyph', glyph: '₹', candles: 'up' },
  dollar: { bg: ['#12233a', '#060d16'], glow: 'rgba(80,160,255,0.28)', metal: ['#bfe0ff', '#4a92e0', '#123a6a'], motif: 'glyph', glyph: '$', candles: 'down' },
  rates: { bg: ['#1a1a3a', '#0a0a18'], glow: 'rgba(140,150,255,0.28)', metal: ['#c6ccff', '#6a72d8', '#2a2f70'], motif: 'glyph', glyph: '%', candles: 'up' },
  crypto: { bg: ['#2a1636', '#100818'], glow: 'rgba(255,160,80,0.28)', metal: ['#ffd08a', '#f0821f', '#7a3a06'], motif: 'glyph', glyph: '₿', candles: 'up' },
  realty: { bg: ['#2a2410', '#100e08'], glow: 'rgba(230,200,110,0.26)', metal: ['#ffe9a6', '#d8a838', '#6a4e12'], motif: 'buildings', candles: 'none' },
}

function metalGrad(ctx: CanvasRenderingContext2D, m: [string, string, string], x: number, y: number, w: number, h: number) {
  const g = ctx.createLinearGradient(x, y, x + w * 0.3, y + h)
  g.addColorStop(0, m[0])
  g.addColorStop(0.5, m[1])
  g.addColorStop(1, m[2])
  return g
}

export function drawHeroScene(ctx: CanvasRenderingContext2D, key: string, x: number, y: number, w: number, h: number) {
  const s = SCENES[key] || SCENES.equities
  const cx = x + w / 2
  // background
  const bg = ctx.createRadialGradient(cx, y + h * 0.32, 30, cx, y + h * 0.42, h * 0.95)
  bg.addColorStop(0, s.bg[0])
  bg.addColorStop(1, s.bg[1])
  ctx.fillStyle = bg
  ctx.fillRect(x, y, w, h)
  const glow = ctx.createRadialGradient(cx, y - 30, 10, cx, y - 30, h * 0.85)
  glow.addColorStop(0, s.glow)
  glow.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = glow
  ctx.fillRect(x, y, w, h)

  // candlestick motif (faint), rising with a couple of red at the end
  if (s.candles !== 'none') {
    ctx.save()
    ctx.globalAlpha = 0.16
    const n = 9
    const cw = w / (n + 2)
    for (let i = 0; i < n; i++) {
      const bx = x + cw * (i + 1)
      const grow = s.candles === 'up' ? i : n - 1 - i
      const bh = 60 + grow * (h * 0.05)
      const by = y + h - 120 - bh
      const red = s.candles === 'up' ? i > n - 3 : i < 2
      ctx.fillStyle = red ? '#d64545' : s.metal[1]
      ctx.fillRect(bx, by, cw * 0.5, bh)
      ctx.fillStyle = 'rgba(255,255,255,0.28)'
      ctx.fillRect(bx + cw * 0.22, by - 14, cw * 0.06, bh + 28)
    }
    ctx.restore()
  }

  // motif
  const mx = cx
  const my = y + h * 0.44
  if (s.motif === 'bars') drawBars(ctx, mx, y + h - 120, s.metal)
  else if (s.motif === 'droplet') drawDroplet(ctx, mx, my, Math.min(w, h) * 0.3, s.metal)
  else if (s.motif === 'arrow') drawArrow(ctx, x, y, w, h, s.metal)
  else if (s.motif === 'buildings') drawBuildings(ctx, x, y, w, h, s.metal)
  else drawGlyph(ctx, s.glyph || '$', mx, my, Math.min(w, h) * 0.52, s.metal, s.glow)

  // sparkles
  ctx.fillStyle = 'rgba(255,240,200,0.85)'
  for (let i = 0; i < 34; i++) {
    const px = x + Math.random() * w
    const py = y + Math.random() * h * 0.7
    const r = Math.random() * 2 + 0.8
    ctx.beginPath()
    ctx.arc(px, py, r, 0, Math.PI * 2)
    ctx.fill()
  }
}

function drawGlyph(
  ctx: CanvasRenderingContext2D,
  glyph: string,
  cx: number,
  cy: number,
  size: number,
  metal: [string, string, string],
  glow: string,
) {
  ctx.save()
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = `800 ${size}px -apple-system, "Segoe UI", Roboto, Arial, sans-serif`
  ctx.shadowColor = glow
  ctx.shadowBlur = 40
  ctx.fillStyle = metalGrad(ctx, metal, cx - size / 2, cy - size / 2, size, size)
  ctx.fillText(glyph, cx, cy)
  ctx.restore()
}

function drawBars(ctx: CanvasRenderingContext2D, cx: number, base: number, metal: [string, string, string]) {
  const bw = 150
  const bh = 74
  const one = (bx: number, by: number) => {
    const tw = bw * 0.7
    ctx.beginPath()
    ctx.moveTo(bx - tw / 2, by)
    ctx.lineTo(bx + tw / 2, by)
    ctx.lineTo(bx + bw / 2, by + 18)
    ctx.lineTo(bx - bw / 2, by + 18)
    ctx.closePath()
    ctx.fillStyle = metal[0]
    ctx.fill()
    ctx.beginPath()
    ctx.moveTo(bx - bw / 2, by + 18)
    ctx.lineTo(bx + bw / 2, by + 18)
    ctx.lineTo(bx + bw / 2, by + bh)
    ctx.lineTo(bx - bw / 2, by + bh)
    ctx.closePath()
    ctx.fillStyle = metalGrad(ctx, metal, bx - bw / 2, by, bw, bh)
    ctx.fill()
    ctx.fillStyle = 'rgba(255,255,255,0.32)'
    ctx.fillRect(bx - bw / 2 + 8, by + 24, bw * 0.16, bh - 30)
  }
  one(cx - 88, base)
  one(cx + 88, base)
  one(cx, base - bh - 10)
}

function drawDroplet(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, metal: [string, string, string]) {
  ctx.save()
  ctx.beginPath()
  ctx.moveTo(cx, cy - r * 1.3)
  ctx.bezierCurveTo(cx + r, cy - r * 0.2, cx + r, cy + r * 0.7, cx, cy + r)
  ctx.bezierCurveTo(cx - r, cy + r * 0.7, cx - r, cy - r * 0.2, cx, cy - r * 1.3)
  ctx.closePath()
  ctx.shadowColor = 'rgba(255,150,60,0.4)'
  ctx.shadowBlur = 40
  ctx.fillStyle = metalGrad(ctx, metal, cx - r, cy - r * 1.3, r * 2, r * 2.3)
  ctx.fill()
  ctx.shadowBlur = 0
  ctx.fillStyle = 'rgba(255,255,255,0.35)'
  ctx.beginPath()
  ctx.ellipse(cx - r * 0.35, cy - r * 0.1, r * 0.16, r * 0.3, -0.4, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

function drawArrow(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, metal: [string, string, string]) {
  ctx.save()
  ctx.strokeStyle = metalGrad(ctx, metal, x, y, w, h)
  ctx.lineWidth = 16
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  ctx.shadowColor = 'rgba(160,140,245,0.5)'
  ctx.shadowBlur = 30
  const pts = [
    [x + w * 0.14, y + h * 0.72],
    [x + w * 0.38, y + h * 0.5],
    [x + w * 0.56, y + h * 0.6],
    [x + w * 0.86, y + h * 0.26],
  ]
  ctx.beginPath()
  ctx.moveTo(pts[0][0], pts[0][1])
  for (const p of pts.slice(1)) ctx.lineTo(p[0], p[1])
  ctx.stroke()
  // arrowhead
  const [ax, ay] = pts[pts.length - 1]
  ctx.beginPath()
  ctx.moveTo(ax, ay)
  ctx.lineTo(ax - w * 0.11, ay + 4)
  ctx.moveTo(ax, ay)
  ctx.lineTo(ax - 6, ay + h * 0.13)
  ctx.stroke()
  ctx.restore()
}

function drawBuildings(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, metal: [string, string, string]) {
  const base = y + h - 110
  const cols = 6
  const cw = w / (cols + 1)
  for (let i = 0; i < cols; i++) {
    const bx = x + cw * (i + 0.7)
    const bh = 120 + Math.abs(((i % 3) - 1)) * 130 + (i % 2) * 60
    ctx.fillStyle = metalGrad(ctx, metal, bx, base - bh, cw * 0.8, bh)
    ctx.fillRect(bx, base - bh, cw * 0.8, bh)
    // windows
    ctx.fillStyle = 'rgba(255,255,255,0.22)'
    for (let wy = base - bh + 16; wy < base - 12; wy += 26) {
      for (let wx = bx + 8; wx < bx + cw * 0.8 - 8; wx += 20) {
        ctx.fillRect(wx, wy, 9, 12)
      }
    }
  }
}
