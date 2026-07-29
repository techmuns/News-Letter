import { useState } from 'react'
import { useStore } from '../store/useStore'
import { PageHeader } from '../components/PageHeader'
import { MicroLabel } from '../components/MicroLabel'
import { Button } from '../components/Button'
import { DropZone } from '../components/workspace/DropZone'
import { PileItemCard } from '../components/workspace/PileItemCard'
import { CampaignsRail } from '../components/workspace/CampaignsRail'
import { IconSparkle, IconClose } from '../components/icons'

export function Workspace() {
  const items = useStore((s) => s.items)
  const campaigns = useStore((s) => s.campaigns)
  const generation = useStore((s) => s.generation)
  const turnIntoContent = useStore((s) => s.turnIntoContent)
  const clearGenerationError = useStore((s) => s.clearGenerationError)

  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [highlightId, setHighlightId] = useState<string | null>(null)

  const running = generation.status === 'running'

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  async function handleTurn() {
    if (selected.size === 0 || running) return
    const chosen = [...selected]
    const id = await turnIntoContent(chosen)
    if (!id) return // the error surfaces below; keep the selection so it can be retried
    setSelected(new Set())
    setHighlightId(id)
    window.setTimeout(() => setHighlightId(null), 4000)
  }

  return (
    <div>
      <PageHeader
        eyebrow="01"
        title="Workspace"
        subtitle="Drop raw material as it comes — PDFs, screenshots, a stray thought. Select a few pieces and turn them into content."
      />

      <DropZone />

      {generation.status === 'error' && (
        <div className="mt-4 flex items-start justify-between gap-4 rounded-xl border border-[rgba(255,120,120,0.3)] bg-[rgba(255,120,120,0.07)] px-4 py-3 animate-fade-up">
          <p className="text-[13px] leading-relaxed text-[#ffb4b4]">{generation.message}</p>
          <button
            type="button"
            onClick={clearGenerationError}
            aria-label="Dismiss error"
            className="mt-0.5 shrink-0 text-[#ffb4b4] transition-opacity hover:opacity-70"
          >
            <IconClose size={14} />
          </button>
        </div>
      )}

      <div className="mt-7 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_300px]">
        {/* The pile */}
        <section className="min-w-0">
          <div className="flex items-center justify-between">
            <MicroLabel>The pile</MicroLabel>
            {selected.size === 0 && items.length > 0 && (
              <MicroLabel className="text-text-dim">Select items to begin</MicroLabel>
            )}
          </div>

          {/* Selection action bar */}
          {selected.size > 0 && (
            <div className="glow-active mt-4 flex items-center justify-between gap-3 rounded-xl p-3 animate-fade-up">
              <span className="text-[13px] text-text-2">{selected.size} selected</span>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={running}
                  onClick={() => setSelected(new Set())}
                >
                  <IconClose size={14} /> Clear
                </Button>
                <Button variant="primary" size="sm" disabled={running} onClick={handleTurn}>
                  <IconSparkle size={15} />
                  {running ? 'Drafting…' : 'Turn into content'}
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
          <CampaignsRail
            campaigns={campaigns}
            highlightId={highlightId}
            generating={running}
          />
        </aside>
      </div>
    </div>
  )
}
