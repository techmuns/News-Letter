import { useState } from 'react'
import { useStore } from '../store/useStore'
import { type GenerationBrief } from '../types'
import { PageHeader } from '../components/PageHeader'
import { MicroLabel } from '../components/MicroLabel'
import { Button } from '../components/Button'
import { DropZone } from '../components/workspace/DropZone'
import { PileItemCard } from '../components/workspace/PileItemCard'
import { CampaignsRail } from '../components/workspace/CampaignsRail'
import { BriefModal } from '../components/workspace/BriefModal'
import { IconSparkle, IconClose } from '../components/icons'

export function Workspace() {
  const items = useStore((s) => s.items)
  const campaigns = useStore((s) => s.campaigns)
  const turnIntoContent = useStore((s) => s.turnIntoContent)

  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [highlightId, setHighlightId] = useState<string | null>(null)
  const [briefOpen, setBriefOpen] = useState(false)

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const selectedItems = items.filter((it) => selected.has(it.id))

  function handleGenerate(brief: GenerationBrief) {
    if (selected.size === 0) return
    const id = turnIntoContent([...selected], brief)
    setSelected(new Set())
    setBriefOpen(false)
    setHighlightId(id)
    window.setTimeout(() => setHighlightId(null), 4000)
  }

  return (
    <div>
      <PageHeader
        eyebrow="01"
        title="Workspace"
        subtitle="The drafting desk. Drop raw material — PDFs, screenshots, a stray thought — select a few pieces, set a content brief, and generate one campaign across three channels."
      />

      <DropZone />

      <div className="mt-7 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_300px]">
        {/* The pile */}
        <section className="min-w-0">
          <div className="flex items-center justify-between">
            <MicroLabel>The pile</MicroLabel>
            {selected.size === 0 && (
              <MicroLabel className="text-text-dim">Select items to begin</MicroLabel>
            )}
          </div>

          {/* Selection action bar */}
          {selected.size > 0 && (
            <div className="glow-active mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl p-3 animate-fade-up">
              <span className="text-[13px] text-text-2">
                {selected.size} selected
                <span className="ml-2 text-text-dim">· set a brief, then generate</span>
              </span>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>
                  <IconClose size={14} /> Clear
                </Button>
                <Button variant="primary" size="sm" onClick={() => setBriefOpen(true)}>
                  <IconSparkle size={15} /> Turn into content
                </Button>
              </div>
            </div>
          )}

          {items.length === 0 ? (
            <div className="mt-4 rounded-panel border border-dashed border-border p-10 text-center">
              <p className="mx-auto max-w-[36ch] text-[13px] leading-relaxed text-text-muted">
                Nothing here yet. Drop a PDF, a screenshot or a thought above to start the pile.
              </p>
            </div>
          ) : (
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {items.map((item) => (
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

      <BriefModal
        open={briefOpen}
        items={selectedItems}
        onClose={() => setBriefOpen(false)}
        onGenerate={handleGenerate}
      />
    </div>
  )
}
