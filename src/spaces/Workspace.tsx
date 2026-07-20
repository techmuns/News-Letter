import { useMemo, useState } from 'react'
import { useStore } from '../store/useStore'
import { type WorkspaceItemType } from '../types'
import { cn } from '../lib/cn'
import { PageHeader } from '../components/PageHeader'
import { MicroLabel } from '../components/MicroLabel'
import { Button } from '../components/Button'
import { DropZone } from '../components/workspace/DropZone'
import { PileItemCard } from '../components/workspace/PileItemCard'
import { CampaignsRail } from '../components/workspace/CampaignsRail'
import { IconSparkle, IconClose } from '../components/icons'

type Filter = 'all' | WorkspaceItemType

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'pdf', label: 'PDFs' },
  { key: 'screenshot', label: 'Screenshots' },
  { key: 'note', label: 'Notes' },
]

export function Workspace() {
  const items = useStore((s) => s.items)
  const campaigns = useStore((s) => s.campaigns)
  const turnIntoContent = useStore((s) => s.turnIntoContent)

  const [filter, setFilter] = useState<Filter>('all')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [highlightId, setHighlightId] = useState<string | null>(null)

  const counts = useMemo(() => {
    const c: Record<Filter, number> = { all: items.length, pdf: 0, screenshot: 0, note: 0 }
    for (const it of items) c[it.type] += 1
    return c
  }, [items])

  const filtered = useMemo(
    () => (filter === 'all' ? items : items.filter((i) => i.type === filter)),
    [items, filter],
  )

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function handleTurn() {
    if (selected.size === 0) return
    const id = turnIntoContent([...selected])
    setSelected(new Set())
    setHighlightId(id)
    window.setTimeout(() => setHighlightId(null), 4000)
  }

  return (
    <div>
      <PageHeader
        eyebrow="01 · Workspace"
        title="The workspace"
        subtitle="A shared desk for raw material. Drop PDFs, screenshots and stray thoughts as they come — then select what belongs together and turn the pile into linked content."
      />

      <DropZone />

      <div className="mt-7 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_330px]">
        {/* The pile */}
        <section className="min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              {FILTERS.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setFilter(f.key)}
                  className={cn(
                    'rounded-full border px-3 py-1.5 transition-all duration-[350ms] ease-premium',
                    filter === f.key
                      ? 'border-glow bg-[rgba(157,140,245,0.08)] text-violet'
                      : 'border-border text-text-muted hover:text-text-2 hover:border-border-strong',
                  )}
                >
                  <span className="micro">
                    {f.label}
                    <span className="ml-1.5 text-text-dim">{counts[f.key]}</span>
                  </span>
                </button>
              ))}
            </div>
            <MicroLabel>The pile · newest first</MicroLabel>
          </div>

          {/* Selection action bar */}
          {selected.size > 0 && (
            <div className="glow-active mt-4 flex items-center justify-between gap-3 rounded-xl p-3 animate-fade-up">
              <div className="flex items-center gap-2.5">
                <span className="grid h-6 min-w-6 place-items-center rounded-full bg-violet px-1.5 font-display text-[12px] font-bold text-[#12101e]">
                  {selected.size}
                </span>
                <span className="text-[13px] text-text-2">
                  item{selected.size > 1 ? 's' : ''} selected
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>
                  <IconClose size={14} /> Clear
                </Button>
                <Button variant="primary" size="sm" onClick={handleTurn}>
                  <IconSparkle size={15} /> Turn into content
                </Button>
              </div>
            </div>
          )}

          {/* Grid */}
          {filtered.length === 0 ? (
            <div className="mt-4 rounded-panel border border-dashed border-border p-10 text-center">
              <MicroLabel>The pile is empty</MicroLabel>
              <p className="mx-auto mt-3 max-w-[36ch] text-[13px] leading-relaxed text-text-muted">
                Nothing here yet. Drop a PDF, a screenshot or a thought above to start the pile.
              </p>
            </div>
          ) : (
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {filtered.map((item) => (
                <PileItemCard
                  key={item.id}
                  item={item}
                  selected={selected.has(item.id)}
                  onToggle={() => toggle(item.id)}
                />
              ))}
            </div>
          )}
        </section>

        {/* Campaigns rail — the bridge to the channel spaces */}
        <aside className="lg:sticky lg:top-20 lg:self-start">
          <CampaignsRail campaigns={campaigns} highlightId={highlightId} />
        </aside>
      </div>
    </div>
  )
}
