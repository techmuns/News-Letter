import { useEffect, useRef, useState } from 'react'
import { type Campaign } from '../../types'
import { useStore } from '../../store/useStore'
import { Button } from '../Button'
import { MicroLabel } from '../MicroLabel'
import { LinkedInPost } from '../preview/LinkedInPost'
import { cn } from '../../lib/cn'
import { renderMarketCard, type MarketCardData, type Direction } from '../../lib/marketCard'
import { renderExplainerCard, type ExplainerCardData } from '../../lib/explainerCard'
import { renderDataSnapshotCard, type DataSnapshotData, type SnapTone, type SnapLayout } from '../../lib/dataSnapshotCard'
import { seedMarketCard, seedDataSnapshot } from '../../lib/marketCardSeed'
import { toBold, toPlain, autoBoldBody } from '../../lib/unicodeBold'

type CardType = 'market' | 'explainer' | 'snapshot'

/** Seed the explainer builder from the draft's copy so it's half-filled. */
function seedExplainer(content: { headline: string; body: string }): ExplainerCardData {
  const points = toPlain(content.body)
    .split('\n')
    .map((l) => l.replace(/^[•\-*\s]*(?:\p{Extended_Pictographic}️?\s*)*/u, '').trim())
    .filter((l) => l.length > 12 && !l.startsWith('#') && !l.endsWith('?'))
    .slice(0, 3)
  return {
    eyebrow: 'MARKET BASICS',
    title: toPlain(content.headline) || 'Explainer',
    subtitle: '',
    points: points.length ? points : ['', '', ''],
    takeaway: '',
  }
}

/** LinkedIn rejects posts past this length, so warn before Buffer does. */
const LINKEDIN_LIMIT = 3000

const fieldCls =
  'w-full rounded-lg border border-border bg-[rgba(255,255,255,0.02)] px-3 py-2 text-[14px] text-text ' +
  'placeholder:text-text-dim focus:outline-none focus-violet transition-colors'

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

  const [mc, setMc] = useState<MarketCardData>(() => campaign.marketCard ?? seedMarketCard(campaign.linkedin.content))
  const [cardType, setCardType] = useState<CardType>('market')
  const [ex, setEx] = useState<ExplainerCardData>(() => seedExplainer(campaign.linkedin.content))
  const [ds, setDs] = useState<DataSnapshotData>(() => seedDataSnapshot(campaign.linkedin.content))
  const [cardUrl, setCardUrl] = useState<string | null>(campaign.heroImage ?? null)
  const [saved, setSaved] = useState(false)

  // Selecting a different draft (or regenerating it) must reset every field.
  useEffect(() => {
    setEditing(false)
    setDraftHeadline(headline)
    setDraftBody(body)
    setMc(campaign.marketCard ?? seedMarketCard(campaign.linkedin.content))
    setEx(seedExplainer(campaign.linkedin.content))
    setDs(seedDataSnapshot(campaign.linkedin.content))
    setCardType('market')
    setCardUrl(campaign.heroImage ?? null)
    setSaved(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaign.id, headline, body])

  // Live card preview — re-render (debounced) whenever the inputs change.
  useEffect(() => {
    if (!editing) return
    let cancelled = false
    const t = setTimeout(() => {
      const render =
        cardType === 'explainer'
          ? renderExplainerCard(ex)
          : cardType === 'snapshot'
            ? renderDataSnapshotCard(ds)
            : renderMarketCard(mc)
      render.then((r) => !cancelled && setCardUrl(r.dataUrl)).catch(() => {})
    }, 250)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [mc, ex, ds, cardType, editing])

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

  /** One-click styling: bold the whole hook, and the lead of each body line. */
  function autoBold() {
    setDraftHeadline(toBold(toPlain(draftHeadline)))
    setDraftBody(autoBoldBody(draftBody))
  }

  /** Un-bold: just the selection if there is one, otherwise strip ALL bold from
      the hook and body — a one-click undo for Auto-bold. */
  function unbold() {
    const el = bodyRef.current
    if (el && el.selectionStart !== el.selectionEnd) {
      transformSelection(toPlain)
    } else {
      setDraftHeadline(toPlain(draftHeadline))
      setDraftBody(toPlain(draftBody))
    }
  }

  function updateIndex(i: number, patch: Partial<MarketCardData['indices'][number]>) {
    setMc((m) => ({ ...m, indices: m.indices.map((idx, j) => (j === i ? { ...idx, ...patch } : idx)) }))
  }

  async function useCardAsImage() {
    try {
      const r =
        cardType === 'explainer'
          ? await renderExplainerCard(ex)
          : cardType === 'snapshot'
            ? await renderDataSnapshotCard(ds)
            : await renderMarketCard(mc)
      setHeroImage(campaign.id, r.dataUrl)
      if (cardType === 'market') setMarketCard(campaign.id, mc)
      setCardUrl(r.dataUrl)
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch {
      /* preview stays; publishing can still go text-only */
    }
  }

  function updatePoint(i: number, val: string) {
    setEx((e) => ({ ...e, points: e.points.map((p, j) => (j === i ? val : p)) }))
  }

  function updateBar(i: number, patch: Partial<DataSnapshotData['bars'][number]>) {
    setDs((d) => ({ ...d, bars: d.bars.map((b, j) => (j === i ? { ...b, ...patch } : b)) }))
  }
  function updateTakeaway(i: number, patch: Partial<DataSnapshotData['takeaways'][number]>) {
    setDs((d) => ({ ...d, takeaways: d.takeaways.map((t, j) => (j === i ? { ...t, ...patch } : t)) }))
  }
  function updateSeries(i: number, patch: Partial<DataSnapshotData['series'][number]>) {
    setDs((d) => ({ ...d, series: d.series.map((s, j) => (j === i ? { ...s, ...patch } : s)) }))
  }
  const parsePoints = (s: string): number[] =>
    s.split(/[,\s]+/).map((n) => parseFloat(n)).filter((n) => !Number.isNaN(n))
  function onHeroFile(file: File | undefined) {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setDs((v) => ({ ...v, hero: String(reader.result || '') }))
    reader.readAsDataURL(file)
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
                onClick={autoBold}
                title="Bold the hook and each line's lead word automatically"
                className="rounded-md border border-[rgba(160,140,220,0.28)] bg-[rgba(160,140,220,0.1)] px-2 py-1 text-[12px] font-semibold text-violet transition-colors hover:bg-[rgba(160,140,220,0.16)]"
              >
                ✨ Auto-bold
              </button>
              <button
                type="button"
                onClick={() => transformSelection(toBold)}
                title="Select text, then Bold just that (LinkedIn fake-bold)"
                className="rounded-md border border-border px-2 py-1 text-[13px] font-bold text-text-2 transition-colors hover:border-border-strong hover:text-text"
              >
                𝗕
              </button>
              <button
                type="button"
                onClick={unbold}
                title="Remove bold — the selection, or ALL of it if nothing is selected (undo Auto-bold)"
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
          <strong className="text-text-2">✨ Auto-bold</strong> bolds the hook and each line's lead word in one click.
          Select words + <strong className="text-text-2">𝗕</strong> bolds just those. <strong className="text-text-2">un-bold</strong>{' '}
          with nothing selected removes <em>all</em> bold — a one-click undo.
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

      {/* ---------- post image builder ---------- */}
      <div className="flex flex-col gap-3 border-t border-[rgba(255,255,255,0.07)] pt-5">
        <div className="flex items-center justify-between gap-3">
          <MicroLabel tone="violet">Post image</MicroLabel>
          <div className="flex overflow-hidden rounded-lg border border-border text-[12.5px]">
            {(['market', 'snapshot', 'explainer'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setCardType(t)}
                className={cn(
                  'px-3 py-1 font-semibold transition-colors',
                  cardType === t ? 'bg-[rgba(160,140,220,0.18)] text-violet' : 'text-text-dim hover:text-text-2',
                )}
              >
                {t === 'market' ? '📊 Market card' : t === 'snapshot' ? '📈 Data Snapshot' : '🎓 Explainer'}
              </button>
            ))}
          </div>
        </div>

        {cardType === 'market' && (
          <div className="flex items-center justify-end">
            <div className="flex overflow-hidden rounded-lg border border-border text-[12.5px]">
              {(['sleek', 'hand'] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setMc((m) => ({ ...m, style: s }))}
                  className={cn(
                    'px-3 py-1 font-semibold transition-colors',
                    (mc.style ?? 'sleek') === s
                      ? 'bg-[rgba(160,140,220,0.18)] text-violet'
                      : 'text-text-dim hover:text-text-2',
                  )}
                >
                  {s === 'sleek' ? 'Sleek' : '✍️ Hand-drawn'}
                </button>
              ))}
            </div>
          </div>
        )}

        <p className="text-[12.5px] leading-relaxed text-text-dim">
          {cardType === 'market'
            ? 'Type today’s numbers — the card updates live. Then press Use as post image.'
            : cardType === 'snapshot'
              ? 'A Thurro-style research card: a finding as the headline, index bars, and colour-coded takeaways. Fill the fields — it updates live. Then press Use as post image.'
              : 'Write a title, a few points, and a takeaway — the explainer card updates live. Then press Use as post image.'}
        </p>

        {cardUrl && (
          <img src={cardUrl} alt="Post image preview" className="w-full rounded-xl border border-border" />
        )}

        {cardType === 'explainer' && (
          <div className="flex flex-col gap-2">
            <div className="grid grid-cols-2 gap-2">
              <label className="flex flex-col gap-1">
                <MicroLabel className="text-text-dim">Eyebrow</MicroLabel>
                <input className={fieldCls} value={ex.eyebrow} onChange={(e) => setEx((v) => ({ ...v, eyebrow: e.target.value }))} />
              </label>
              <label className="flex flex-col gap-1">
                <MicroLabel className="text-text-dim">Title</MicroLabel>
                <input className={fieldCls} value={ex.title} onChange={(e) => setEx((v) => ({ ...v, title: e.target.value }))} />
              </label>
            </div>
            <label className="flex flex-col gap-1">
              <MicroLabel className="text-text-dim">Subtitle (one line)</MicroLabel>
              <input className={fieldCls} value={ex.subtitle} onChange={(e) => setEx((v) => ({ ...v, subtitle: e.target.value }))} />
            </label>
            {ex.points.map((p, i) => (
              <label key={i} className="flex flex-col gap-1">
                <MicroLabel className="text-text-dim">Point {i + 1}</MicroLabel>
                <textarea
                  className={cn(fieldCls, 'min-h-[52px] resize-y leading-relaxed')}
                  value={p}
                  onChange={(e) => updatePoint(i, e.target.value)}
                />
              </label>
            ))}
            {ex.points.length < 4 && (
              <button
                type="button"
                onClick={() => setEx((v) => ({ ...v, points: [...v.points, ''] }))}
                className="self-start text-[12.5px] text-violet hover:underline"
              >
                + add a point
              </button>
            )}
            <label className="flex flex-col gap-1">
              <MicroLabel className="text-text-dim">The takeaway (one line)</MicroLabel>
              <input className={fieldCls} value={ex.takeaway} onChange={(e) => setEx((v) => ({ ...v, takeaway: e.target.value }))} />
            </label>
          </div>
        )}

        {cardType === 'snapshot' && (
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-2">
              <label className="flex flex-col gap-1">
                <MicroLabel className="text-text-dim">Date label</MicroLabel>
                <input className={fieldCls} value={ds.date} onChange={(e) => setDs((v) => ({ ...v, date: e.target.value }))} />
              </label>
              <label className="flex flex-col gap-1">
                <MicroLabel className="text-text-dim">Source line</MicroLabel>
                <input className={fieldCls} value={ds.source} onChange={(e) => setDs((v) => ({ ...v, source: e.target.value }))} />
              </label>
            </div>
            <label className="flex flex-col gap-1">
              <MicroLabel className="text-text-dim">Headline — the finding (not the topic)</MicroLabel>
              <textarea
                className={cn(fieldCls, 'min-h-[52px] resize-y leading-relaxed')}
                value={ds.title}
                onChange={(e) => setDs((v) => ({ ...v, title: e.target.value }))}
                placeholder="The bond market"
              />
            </label>
            <label className="flex flex-col gap-1">
              <MicroLabel className="text-text-dim">Headline accent (plum tail, optional)</MicroLabel>
              <input
                className={fieldCls}
                value={ds.titleAccent ?? ''}
                onChange={(e) => setDs((v) => ({ ...v, titleAccent: e.target.value }))}
                placeholder="decided before the Fed did"
              />
            </label>
            <label className="flex flex-col gap-1">
              <MicroLabel className="text-text-dim">Subtitle — dataset / method</MicroLabel>
              <input
                className={fieldCls}
                value={ds.subtitle}
                onChange={(e) => setDs((v) => ({ ...v, subtitle: e.target.value }))}
                placeholder="One-day index moves · 8 Sep 2026 close · % change."
              />
            </label>

            <div className="flex flex-col gap-1.5 rounded-lg border border-dashed border-border p-3">
              <div className="flex items-center justify-between gap-2">
                <MicroLabel className="text-text-dim">Hero image (optional — collage look)</MicroLabel>
                {ds.hero ? (
                  <button
                    type="button"
                    onClick={() => setDs((v) => ({ ...v, hero: '' }))}
                    className="text-[12px] text-text-dim hover:text-[#fb7185]"
                  >
                    remove
                  </button>
                ) : null}
              </div>
              <div className="flex items-center gap-3">
                {ds.hero ? (
                  <img src={ds.hero} alt="Hero" className="h-14 w-20 rounded-md border border-border object-cover" />
                ) : null}
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => onHeroFile(e.target.files?.[0])}
                  className="text-[12px] text-text-dim file:mr-2 file:rounded-md file:border file:border-border file:bg-[rgba(160,140,220,0.1)] file:px-2 file:py-1 file:text-[12px] file:font-semibold file:text-violet"
                />
              </div>
              <p className="text-[11.5px] leading-relaxed text-text-dim">
                Add a photo/illustration (make one in any AI image tool) and the card becomes a collage — image + headline on the left, chart
                and takeaways on the right, like Thurro's hero posts. Leave empty for the standard chart card.
              </p>
            </div>

            <div className="flex flex-col gap-1.5">
              <MicroLabel className="text-text-dim">Chart type</MicroLabel>
              <div className="grid grid-cols-4 overflow-hidden rounded-lg border border-border text-[12px]">
                {(['bars', 'trend', 'ranking', 'stat'] as SnapLayout[]).map((l) => (
                  <button
                    key={l}
                    type="button"
                    onClick={() => setDs((v) => ({ ...v, layout: l }))}
                    className={cn(
                      'px-2 py-1.5 font-semibold transition-colors',
                      ds.layout === l ? 'bg-[rgba(160,140,220,0.18)] text-violet' : 'text-text-dim hover:text-text-2',
                    )}
                  >
                    {l === 'bars' ? '⇄ Bars' : l === 'trend' ? '📈 Trend' : l === 'ranking' ? '🏆 Ranking' : '# Big stat'}
                  </button>
                ))}
              </div>
              <p className="text-[11.5px] leading-relaxed text-text-dim">
                Pick the shape that fits the story so no two posts look alike — <strong className="text-text-2">Bars</strong> to compare a few
                moves, <strong className="text-text-2">Trend</strong> for something over time, <strong className="text-text-2">Ranking</strong> for
                winners vs losers, <strong className="text-text-2">Big stat</strong> for one striking number.
              </p>
            </div>

            {(ds.layout === 'bars' || ds.layout === 'ranking') && (
            <>
            <MicroLabel className="text-text-dim">
              {ds.layout === 'ranking' ? 'Rows (name · sub · % — auto-sorted)' : 'Bars (index · level · % move)'}
            </MicroLabel>
            {ds.bars.map((b, i) => (
              <div key={i} className="grid grid-cols-[1fr_1fr_84px_auto] items-center gap-2">
                <input
                  className={cn(fieldCls, 'text-[13px]')}
                  placeholder="Dow Jones"
                  value={b.name}
                  onChange={(e) => updateBar(i, { name: e.target.value })}
                />
                <input
                  className={cn(fieldCls, 'text-[13px]')}
                  placeholder="52,786"
                  value={b.sub}
                  onChange={(e) => updateBar(i, { sub: e.target.value })}
                />
                <input
                  className={cn(fieldCls, 'text-[13px]')}
                  placeholder="-1.18"
                  value={b.pct}
                  onChange={(e) => updateBar(i, { pct: e.target.value })}
                />
                <button
                  type="button"
                  onClick={() => setDs((v) => ({ ...v, bars: v.bars.filter((_, j) => j !== i) }))}
                  className="px-2 text-[16px] leading-none text-text-dim hover:text-[#fb7185]"
                  title="Remove this bar"
                >
                  ×
                </button>
              </div>
            ))}
            {ds.bars.length < 6 && (
              <button
                type="button"
                onClick={() => setDs((v) => ({ ...v, bars: [...v.bars, { name: '', sub: '', pct: '' }] }))}
                className="self-start text-[12.5px] text-violet hover:underline"
              >
                + add a row
              </button>
            )}
            <p className="text-[12px] leading-relaxed text-text-dim">
              % is signed — <strong className="text-text-2">-1.18</strong> for a fall, <strong className="text-text-2">0.4</strong> for a rise.
              {ds.layout === 'ranking'
                ? ' Rows auto-sort best → worst; green for gains, red for falls.'
                : ' Under ±0.15% renders amber as “flat”. Bars auto-scale to the biggest mover.'}
            </p>
            </>
            )}

            {ds.layout === 'trend' && (
            <>
            <MicroLabel className="text-text-dim">Lines (name · values over time)</MicroLabel>
            {ds.series.map((s, i) => (
              <div key={i} className="flex flex-col gap-1.5 rounded-lg border border-border p-3">
                <div className="flex items-center gap-2">
                  <input
                    className={cn(fieldCls, 'flex-1 text-[13px] font-semibold')}
                    placeholder="Line name (e.g. VinFast)"
                    value={s.name}
                    onChange={(e) => updateSeries(i, { name: e.target.value })}
                  />
                  {ds.series.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setDs((v) => ({ ...v, series: v.series.filter((_, j) => j !== i) }))}
                      className="px-2 text-[16px] leading-none text-text-dim hover:text-[#fb7185]"
                      title="Remove this line"
                    >
                      ×
                    </button>
                  )}
                </div>
                <input
                  className={cn(fieldCls, 'text-[13px]')}
                  placeholder="Values, comma-separated: 6, 14, 31, 45, 51, 77, 91"
                  defaultValue={s.points.join(', ')}
                  onChange={(e) => updateSeries(i, { points: parsePoints(e.target.value) })}
                />
              </div>
            ))}
            {ds.series.length < 3 && (
              <button
                type="button"
                onClick={() => setDs((v) => ({ ...v, series: [...v.series, { name: '', color: '', points: [] }] }))}
                className="self-start text-[12.5px] text-violet hover:underline"
              >
                + add a line
              </button>
            )}
            <label className="flex flex-col gap-1">
              <MicroLabel className="text-text-dim">X-axis labels (first &amp; last, comma-separated)</MicroLabel>
              <input
                className={cn(fieldCls, 'text-[13px]')}
                placeholder="Sep 25, Jun 26"
                defaultValue={ds.xLabels.join(', ')}
                onChange={(e) => setDs((v) => ({ ...v, xLabels: e.target.value.split(',').map((x) => x.trim()).filter(Boolean) }))}
              />
            </label>
            <p className="text-[12px] leading-relaxed text-text-dim">
              Each line needs 2+ values. All lines share one scale, so use the same units. The first line gets the shaded fill.
            </p>
            </>
            )}

            {ds.layout === 'stat' && (
            <div className="flex flex-col gap-2">
              <label className="flex flex-col gap-1">
                <MicroLabel className="text-text-dim">The big number</MicroLabel>
                <input
                  className={cn(fieldCls, 'text-[15px] font-semibold')}
                  placeholder="~91%"
                  value={ds.stat.value}
                  onChange={(e) => setDs((v) => ({ ...v, stat: { ...v.stat, value: e.target.value } }))}
                />
              </label>
              <label className="flex flex-col gap-1">
                <MicroLabel className="text-text-dim">Label (what it is)</MicroLabel>
                <input
                  className={fieldCls}
                  placeholder="priced-in odds of a 25bp hike"
                  value={ds.stat.label}
                  onChange={(e) => setDs((v) => ({ ...v, stat: { ...v.stat, label: e.target.value } }))}
                />
              </label>
              <label className="flex flex-col gap-1">
                <MicroLabel className="text-text-dim">Context (one line)</MicroLabel>
                <textarea
                  className={cn(fieldCls, 'min-h-[52px] resize-y leading-relaxed')}
                  placeholder="The first US rate rise since 2023, near-fully expected by markets."
                  value={ds.stat.context}
                  onChange={(e) => setDs((v) => ({ ...v, stat: { ...v.stat, context: e.target.value } }))}
                />
              </label>
            </div>
            )}

            <MicroLabel className="text-text-dim">What the numbers say (up to 3)</MicroLabel>
            {ds.takeaways.map((t, i) => (
              <div key={i} className="rounded-lg border border-border p-3">
                <div className="mb-2 flex items-center gap-2">
                  <div className="flex overflow-hidden rounded-md border border-border">
                    {(['red', 'green', 'plum'] as SnapTone[]).map((tone) => (
                      <button
                        key={tone}
                        type="button"
                        onClick={() => updateTakeaway(i, { tone })}
                        className={cn(
                          'px-2.5 py-1 text-[12px] font-semibold capitalize transition-colors',
                          t.tone === tone
                            ? tone === 'red'
                              ? 'bg-[rgba(214,69,69,0.16)] text-[#fb7185]'
                              : tone === 'green'
                                ? 'bg-[rgba(47,158,111,0.16)] text-[#5fe3b0]'
                                : 'bg-[rgba(160,140,220,0.18)] text-violet'
                            : 'text-text-dim hover:text-text-2',
                        )}
                      >
                        {tone}
                      </button>
                    ))}
                  </div>
                  <input
                    className={cn(fieldCls, 'w-[92px] text-[13px] font-bold')}
                    placeholder="~91%"
                    title="Big figure — the number this point leads with"
                    value={t.figure ?? ''}
                    onChange={(e) => updateTakeaway(i, { figure: e.target.value })}
                  />
                  <input
                    className={cn(fieldCls, 'flex-1 text-[13px] font-semibold')}
                    placeholder="Bold lead label"
                    value={t.lead}
                    onChange={(e) => updateTakeaway(i, { lead: e.target.value })}
                  />
                </div>
                <textarea
                  className={cn(fieldCls, 'min-h-[52px] resize-y text-[13px] leading-relaxed')}
                  placeholder="One sentence with the number and why it matters."
                  value={t.text}
                  onChange={(e) => updateTakeaway(i, { text: e.target.value })}
                />
              </div>
            ))}
            {ds.takeaways.length < 3 && (
              <button
                type="button"
                onClick={() => setDs((v) => ({ ...v, takeaways: [...v.takeaways, { tone: 'plum', lead: '', text: '' }] }))}
                className="self-start text-[12.5px] text-violet hover:underline"
              >
                + add a takeaway
              </button>
            )}

            <label className="flex flex-col gap-1">
              <MicroLabel className="text-text-dim">Watch next (one line, optional)</MicroLabel>
              <textarea
                className={cn(fieldCls, 'min-h-[52px] resize-y leading-relaxed')}
                value={ds.watchNext}
                onChange={(e) => setDs((v) => ({ ...v, watchNext: e.target.value }))}
                placeholder="A US inflation print lands this week…"
              />
            </label>
          </div>
        )}

        {cardType === 'market' && (
        <div className="flex flex-col gap-3">
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
        </div>
        )}

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
