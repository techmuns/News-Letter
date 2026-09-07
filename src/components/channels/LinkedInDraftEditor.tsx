import { useEffect, useRef, useState } from 'react'
import { type Campaign } from '../../types'
import { useStore } from '../../store/useStore'
import { Button } from '../Button'
import { MicroLabel } from '../MicroLabel'
import { LinkedInPost } from '../preview/LinkedInPost'
import { cn } from '../../lib/cn'
import { renderMarketCard, type MarketCardData, type Direction } from '../../lib/marketCard'

/** LinkedIn rejects posts past this length, so warn before Buffer does. */
const LINKEDIN_LIMIT = 3000

const fieldCls =
  'w-full rounded-lg border border-border bg-[rgba(255,255,255,0.02)] px-3 py-2 text-[14px] text-text ' +
  'placeholder:text-text-dim focus:outline-none focus-violet transition-colors'

/* ---- Unicode "fake bold" (LinkedIn has no real bold in captions) ---- */
function buildBoldMaps() {
  const fwd = new Map<string, string>()
  const rev = new Map<string, string>()
  const add = (from: number, to: number, base: number) => {
    for (let c = from; c <= to; c++) {
      const plain = String.fromCharCode(c)
      const bold = String.fromCodePoint(base + (c - from))
      fwd.set(plain, bold)
      rev.set(bold, plain)
    }
  }
  add(65, 90, 0x1d5d4) // A-Z → 𝗔-𝗭
  add(97, 122, 0x1d5ee) // a-z → 𝗮-𝘇
  add(48, 57, 0x1d7ec) // 0-9 → 𝟬-𝟵
  return { fwd, rev }
}
const { fwd: BOLD_FWD, rev: BOLD_REV } = buildBoldMaps()

function toBold(s: string): string {
  return Array.from(s)
    .map((ch) => BOLD_FWD.get(ch) ?? ch)
    .join('')
}
function toPlain(s: string): string {
  return Array.from(s)
    .map((ch) => BOLD_REV.get(ch) ?? ch)
    .join('')
}

/* ---- Market card defaults ---- */
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']
function todayLabel(): string {
  const d = new Date()
  return `${String(d.getDate()).padStart(2, '0')} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`
}

const NUM = '[0-9][0-9,]*\\.?[0-9]*'
/** The ~130-char stretch of copy starting at a keyword ("Nifty …"). */
function segmentAround(text: string, keyword: string): string {
  const i = text.toLowerCase().indexOf(keyword.toLowerCase())
  return i < 0 ? '' : text.slice(i, i + 130)
}
function looksDown(text: string): boolean {
  return /\b(fell|drop|lower|down|slid|slip|loss|declin|red|sink|slump|shed)/i.test(text)
}

/** Pull { value (index level), pts, pct, direction } out of a line like
    "Sensex closed 373.93 points (0.49%) lower at 76,570.35". The level is the
    number after "at"/"to"; the pts sit before "points"; the % before "%". */
function extractIndex(text: string, keyword: string, name: string): MarketCardData['indices'][number] {
  const seg = segmentAround(text, keyword)
  const pct = seg.match(new RegExp(`(${NUM})\\s*%`))?.[1] ?? ''
  const pts = seg.match(new RegExp(`(${NUM})\\s*(?:points|pts|point)`, 'i'))?.[1] ?? ''
  const level =
    seg.match(new RegExp(`\\b(?:at|to)\\s+(${NUM})`, 'i'))?.[1] ??
    (seg.match(new RegExp(NUM, 'g')) ?? [])
      .slice()
      .sort((a, b) => parseFloat(b.replace(/,/g, '')) - parseFloat(a.replace(/,/g, '')))[0] ??
    ''
  return { name, value: level, changePts: pts, changePct: pct, direction: looksDown(seg) ? 'down' : 'up' }
}

/** Seed the builder from the draft's copy so the numbers auto-fill. */
function seedMarketCard(campaign: Campaign): MarketCardData {
  const { headline, body } = campaign.linkedin.content
  const plainHead = toPlain(headline)
  const dash = plainHead.search(/[—–-]/)
  const lead = dash > 0 ? plainHead.slice(0, dash + 1).trim() : plainHead
  const accent = dash > 0 ? plainHead.slice(dash + 1).trim() : ''
  const text = toPlain(`${headline}\n${body}`)
  const fallbackDir: Direction = looksDown(text) ? 'down' : 'up'
  const nifty = extractIndex(text, 'nifty', 'NIFTY 50')
  const sensex = extractIndex(text, 'sensex', 'SENSEX')
  // If a keyword wasn't found the segment is empty → fall back to overall tone.
  if (!segmentAround(text, 'nifty')) nifty.direction = fallbackDir
  if (!segmentAround(text, 'sensex')) sensex.direction = fallbackDir
  // driver = first substantial body line
  const driver =
    toPlain(body)
      .split('\n')
      .map((l) => l.replace(/^[^\p{L}\p{N}]+/u, '').trim())
      .find((l) => l.length > 24) ?? ''
  return {
    date: todayLabel(),
    eyebrow: 'INDIAN EQUITIES · DAILY PULSE',
    headline: lead || 'Market close',
    accent,
    driver,
    indices: [nifty, sensex],
  }
}

/**
 * The LinkedIn draft — previewed as it appears in-feed, or opened to hand-edit
 * the caption (with a Bold tool) and build the branded market card that goes
 * out as the post image.
 */
export function LinkedInDraftEditor({ campaign }: { campaign: Campaign }) {
  const setLinkedInText = useStore((s) => s.setLinkedInText)
  const setHeroImage = useStore((s) => s.setHeroImage)
  const setMarketCard = useStore((s) => s.setMarketCard)
  const { headline, body } = campaign.linkedin.content

  const [editing, setEditing] = useState(false)
  const [draftHeadline, setDraftHeadline] = useState(headline)
  const [draftBody, setDraftBody] = useState(body)
  const bodyRef = useRef<HTMLTextAreaElement>(null)

  const [mc, setMc] = useState<MarketCardData>(() => campaign.marketCard ?? seedMarketCard(campaign))
  const [cardUrl, setCardUrl] = useState<string | null>(campaign.heroImage ?? null)
  const [saved, setSaved] = useState(false)

  // Selecting a different draft (or regenerating it) must reset every field.
  useEffect(() => {
    setEditing(false)
    setDraftHeadline(headline)
    setDraftBody(body)
    setMc(campaign.marketCard ?? seedMarketCard(campaign))
    setCardUrl(campaign.heroImage ?? null)
    setSaved(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaign.id, headline, body])

  // Live card preview — re-render (debounced) whenever the inputs change.
  useEffect(() => {
    if (!editing) return
    let cancelled = false
    const t = setTimeout(() => {
      renderMarketCard(mc)
        .then((r) => {
          if (!cancelled) setCardUrl(r.dataUrl)
        })
        .catch(() => {})
    }, 250)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [mc, editing])

  const total = draftHeadline.trim().length + draftBody.trim().length + 2
  const overLimit = total > LINKEDIN_LIMIT
  const dirty = draftHeadline !== headline || draftBody !== body

  function saveText() {
    setLinkedInText(campaign.id, { headline: draftHeadline, body: draftBody })
  }

  /** Transform the current selection in the body textarea (bold / un-bold). */
  function transformSelection(fn: (s: string) => string) {
    const el = bodyRef.current
    if (!el) return
    const start = el.selectionStart
    const end = el.selectionEnd
    if (start === end) return
    const next = draftBody.slice(0, start) + fn(draftBody.slice(start, end)) + draftBody.slice(end)
    setDraftBody(next)
    // Restore the selection after React re-renders.
    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(start, start + fn(draftBody.slice(start, end)).length)
    })
  }

  function updateIndex(i: number, patch: Partial<MarketCardData['indices'][number]>) {
    setMc((m) => ({ ...m, indices: m.indices.map((idx, j) => (j === i ? { ...idx, ...patch } : idx)) }))
  }

  async function useCardAsImage() {
    try {
      const r = await renderMarketCard(mc)
      setHeroImage(campaign.id, r.dataUrl)
      setMarketCard(campaign.id, mc)
      setCardUrl(r.dataUrl)
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch {
      /* preview stays; publishing can still go text-only */
    }
  }

  if (!editing) {
    return (
      <div>
        <div className="mb-3 flex items-center justify-end">
          <Button variant="subtle" size="sm" onClick={() => setEditing(true)}>
            ✎ Edit post
          </Button>
        </div>
        <LinkedInPost
          content={campaign.linkedin.content}
          image={campaign.heroImage}
          topic={campaign.topic}
          // heroImage is already a fully rendered branded card. Without this the
          // preview would draw the branding template over it a second time.
          plainImage
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      {/* ---------- caption ---------- */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <MicroLabel tone="violet">Caption</MicroLabel>
          <span
            className={cn(
              'micro',
              overLimit ? 'text-[#f7a3a3]' : total > LINKEDIN_LIMIT * 0.9 ? 'text-[#f2c566]' : 'text-text-dim',
            )}
          >
            {total} / {LINKEDIN_LIMIT}
          </span>
        </div>

        <label className="flex flex-col gap-1.5">
          <MicroLabel className="text-text-dim">Hook (first line)</MicroLabel>
          <input
            className={fieldCls}
            value={draftHeadline}
            onChange={(e) => setDraftHeadline(e.target.value)}
            placeholder="The opening line that stops the scroll…"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between gap-2">
            <MicroLabel className="text-text-dim">Post body</MicroLabel>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => transformSelection(toBold)}
                title="Select text, then Bold it (LinkedIn fake-bold)"
                className="rounded-md border border-border px-2 py-1 text-[13px] font-bold text-text-2 transition-colors hover:border-border-strong hover:text-text"
              >
                𝗕
              </button>
              <button
                type="button"
                onClick={() => transformSelection(toPlain)}
                title="Remove bold from the selection"
                className="rounded-md border border-border px-2 py-1 text-[12px] text-text-dim transition-colors hover:border-border-strong hover:text-text-2"
              >
                un-bold
              </button>
            </div>
          </div>
          <textarea
            ref={bodyRef}
            className={cn(fieldCls, 'min-h-[280px] resize-y whitespace-pre-wrap leading-relaxed')}
            value={draftBody}
            onChange={(e) => setDraftBody(e.target.value)}
            placeholder="Bullets, closing line, hashtags…"
          />
        </label>

        <p className="text-[12.5px] leading-relaxed text-text-dim">
          Select the important words (a hook, an index name) and press <strong className="text-text-2">𝗕</strong> to
          bold them. Delete a bullet by deleting its line.
        </p>

        {overLimit && (
          <p className="text-[12.5px] leading-relaxed text-[#f7a3a3]">
            This is {total - LINKEDIN_LIMIT} characters over LinkedIn's {LINKEDIN_LIMIT}-character limit — trim it or
            the publish will be rejected.
          </p>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="primary" size="sm" onClick={saveText} disabled={!dirty}>
            Save caption
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setDraftHeadline(headline)
              setDraftBody(body)
            }}
          >
            {dirty ? 'Discard caption edits' : 'Caption saved'}
          </Button>
        </div>
      </div>

      {/* ---------- market card builder ---------- */}
      <div className="flex flex-col gap-3 border-t border-[rgba(255,255,255,0.07)] pt-5">
        <MicroLabel tone="violet">Post image · market card</MicroLabel>
        <p className="text-[12.5px] leading-relaxed text-text-dim">
          Type today's numbers — the card updates live. Then press <strong className="text-text-2">Use as post
          image</strong> to attach it to this post.
        </p>

        {cardUrl && (
          <img
            src={cardUrl}
            alt="Market card preview"
            className="w-full rounded-xl border border-border"
          />
        )}

        <div className="grid grid-cols-2 gap-2">
          <label className="col-span-2 flex flex-col gap-1">
            <MicroLabel className="text-text-dim">Date label</MicroLabel>
            <input className={fieldCls} value={mc.date} onChange={(e) => setMc((m) => ({ ...m, date: e.target.value }))} />
          </label>
          <label className="flex flex-col gap-1">
            <MicroLabel className="text-text-dim">Headline (white)</MicroLabel>
            <input
              className={fieldCls}
              value={mc.headline}
              onChange={(e) => setMc((m) => ({ ...m, headline: e.target.value }))}
            />
          </label>
          <label className="flex flex-col gap-1">
            <MicroLabel className="text-text-dim">Headline accent (coloured)</MicroLabel>
            <input
              className={fieldCls}
              value={mc.accent}
              onChange={(e) => setMc((m) => ({ ...m, accent: e.target.value }))}
            />
          </label>
        </div>

        {mc.indices.map((idx, i) => (
          <div key={i} className="rounded-lg border border-border p-3">
            <div className="mb-2 flex items-center justify-between">
              <input
                className="w-[45%] rounded-md border border-border bg-[rgba(255,255,255,0.02)] px-2 py-1 text-[13px] font-semibold text-text focus:outline-none focus-violet"
                value={idx.name}
                onChange={(e) => updateIndex(i, { name: e.target.value })}
              />
              <div className="flex overflow-hidden rounded-md border border-border">
                {(['up', 'down'] as Direction[]).map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => updateIndex(i, { direction: d })}
                    className={cn(
                      'px-3 py-1 text-[12.5px] font-semibold transition-colors',
                      idx.direction === d
                        ? d === 'up'
                          ? 'bg-[rgba(63,216,155,0.16)] text-[#5fe3b0]'
                          : 'bg-[rgba(251,113,133,0.16)] text-[#fb7185]'
                        : 'text-text-dim hover:text-text-2',
                    )}
                  >
                    {d === 'up' ? '▲ Up' : '▼ Down'}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <input
                className={cn(fieldCls, 'text-[13px]')}
                placeholder="Value"
                value={idx.value}
                onChange={(e) => updateIndex(i, { value: e.target.value })}
              />
              <input
                className={cn(fieldCls, 'text-[13px]')}
                placeholder="Pts move"
                value={idx.changePts}
                onChange={(e) => updateIndex(i, { changePts: e.target.value })}
              />
              <input
                className={cn(fieldCls, 'text-[13px]')}
                placeholder="% (no sign)"
                value={idx.changePct}
                onChange={(e) => updateIndex(i, { changePct: e.target.value })}
              />
            </div>
          </div>
        ))}

        <label className="flex flex-col gap-1">
          <MicroLabel className="text-text-dim">What moved it (one line)</MicroLabel>
          <textarea
            className={cn(fieldCls, 'min-h-[70px] resize-y leading-relaxed')}
            value={mc.driver}
            onChange={(e) => setMc((m) => ({ ...m, driver: e.target.value }))}
          />
        </label>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="primary" size="sm" onClick={useCardAsImage}>
            {saved ? '✓ Attached' : 'Use as post image'}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
            Done
          </Button>
        </div>
      </div>
    </div>
  )
}
