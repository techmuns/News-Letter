import { useMemo, useState } from 'react'
import { useStore } from '../store/useStore'
import { type WorkspaceItemType } from '../types'
import { MicroLabel } from '../components/MicroLabel'
import { Menu, MenuItem } from '../components/Menu'
import { DropZone } from '../components/workspace/DropZone'
import { PileRow } from '../components/workspace/PileRow'
import { ContentSettingsPanel } from '../components/workspace/ContentSettingsPanel'
import { WorkspaceIllustration } from '../components/workspace/WorkspaceIllustration'
import { IconChevronDown, IconFilter, IconArrowRight } from '../components/icons'

type SortMode = 'recent' | 'oldest'
type FilterMode = 'all' | WorkspaceItemType

const PAGE = 4

const SORT_LABEL: Record<SortMode, string> = { recent: 'Recent', oldest: 'Oldest' }
const FILTER_LABEL: Record<FilterMode, string> = {
  all: 'All types',
  pdf: 'PDFs',
  screenshot: 'Screenshots',
  note: 'Notes',
}

export function Workspace() {
  const items = useStore((s) => s.items)
  const removeItem = useStore((s) => s.removeItem)
  const turnIntoContent = useStore((s) => s.turnIntoContent)
  const brief = useStore((s) => s.brief)

  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [sort, setSort] = useState<SortMode>('recent')
  const [filter, setFilter] = useState<FilterMode>('all')
  const [showAll, setShowAll] = useState(false)
  const [feedback, setFeedback] = useState<{ text: string; ok: boolean } | null>(null)

  const filtered = useMemo(() => {
    const list = items
      .filter((it) => (filter === 'all' ? true : it.type === filter))
      .slice()
      .sort((a, b) => {
        const da = new Date(a.createdAt).getTime()
        const db = new Date(b.createdAt).getTime()
        return sort === 'recent' ? db - da : da - db
      })
    return list
  }, [items, filter, sort])

  const visible = showAll ? filtered : filtered.slice(0, PAGE)
  const hasMore = filtered.length > PAGE

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function handleRemove(id: string) {
    removeItem(id)
    setSelected((prev) => {
      if (!prev.has(id)) return prev
      const next = new Set(prev)
      next.delete(id)
      return next
    })
  }

  function handleGenerate() {
    if (selected.size === 0) {
      setFeedback({ text: 'Select one or more items from the pile first.', ok: false })
      window.setTimeout(() => setFeedback(null), 4000)
      return
    }
    const ids = items.filter((it) => selected.has(it.id)).map((it) => it.id)
    turnIntoContent(ids, brief)
    setSelected(new Set())
    setFeedback({ text: 'Draft campaign created — review it in Preview.', ok: true })
    window.setTimeout(() => setFeedback(null), 6000)
  }

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-10">
      {/* central workspace column */}
      <div className="min-w-0">
        <MicroLabel tone="violet" className="text-[11px]">
          01
        </MicroLabel>
        <h1 className="mt-2.5 font-display text-[34px] font-bold leading-[1.05] tracking-tight text-text md:text-[37px]">
          Workspace
        </h1>
        <p className="mt-3 max-w-[33rem] text-[15px] leading-relaxed text-text-2">
          Drop raw material as it comes — PDFs, screenshots, notes, links — and turn them into
          content.
        </p>

        <div className="mt-6">
          <DropZone />
        </div>

        {/* THE PILE */}
        <section className="mt-8">
          <div className="flex items-center justify-between gap-3">
            <MicroLabel>The pile</MicroLabel>
            <div className="flex items-center gap-2">
              <Menu
                align="right"
                trigger={
                  <span className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-[12.5px] text-text-2 transition-colors hover:border-border-strong hover:text-text">
                    {SORT_LABEL[sort]}
                    <IconChevronDown size={13} className="text-text-muted" />
                  </span>
                }
              >
                {(close) =>
                  (Object.keys(SORT_LABEL) as SortMode[]).map((m) => (
                    <MenuItem
                      key={m}
                      active={sort === m}
                      onClick={() => {
                        setSort(m)
                        close()
                      }}
                    >
                      {SORT_LABEL[m]}
                    </MenuItem>
                  ))
                }
              </Menu>

              <Menu
                align="right"
                trigger={
                  <span
                    className={
                      'relative grid h-[34px] w-[34px] place-items-center rounded-lg border bg-surface transition-colors ' +
                      (filter === 'all'
                        ? 'border-border text-text-muted hover:border-border-strong hover:text-text'
                        : 'border-[rgba(145,71,245,0.45)] text-violet')
                    }
                  >
                    <IconFilter size={15} />
                    {filter !== 'all' && (
                      <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-violet" />
                    )}
                  </span>
                }
              >
                {(close) =>
                  (Object.keys(FILTER_LABEL) as FilterMode[]).map((m) => (
                    <MenuItem
                      key={m}
                      active={filter === m}
                      onClick={() => {
                        setFilter(m)
                        setShowAll(false)
                        close()
                      }}
                    >
                      {FILTER_LABEL[m]}
                    </MenuItem>
                  ))
                }
              </Menu>
            </div>
          </div>

          <div className="mt-3 overflow-hidden rounded-panel border border-border bg-surface shadow-panel">
            {items.length === 0 ? (
              <div className="px-6 py-14 text-center">
                <p className="mx-auto max-w-[38ch] text-[13px] leading-relaxed text-text-muted">
                  Nothing here yet. Drop a PDF, a screenshot or a thought above to start the pile.
                </p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <p className="text-[13px] text-text-muted">
                  No {FILTER_LABEL[filter].toLowerCase()} in the pile yet.
                </p>
              </div>
            ) : (
              <>
                <div className="divide-y divide-border-soft">
                  {visible.map((item) => (
                    <PileRow
                      key={item.id}
                      item={item}
                      selected={selected.has(item.id)}
                      onToggle={() => toggle(item.id)}
                      onRemove={() => handleRemove(item.id)}
                    />
                  ))}
                </div>
                {hasMore && (
                  <button
                    type="button"
                    onClick={() => setShowAll((v) => !v)}
                    className="flex w-full items-center justify-center gap-1.5 border-t border-border-soft py-3.5 text-[12.5px] font-medium text-violet transition-colors hover:bg-surface-hover focus-violet"
                  >
                    {showAll ? 'Show less' : `View all files (${filtered.length})`}
                    <IconArrowRight size={14} />
                  </button>
                )}
              </>
            )}
          </div>
        </section>
      </div>

      {/* right column — illustration + content settings */}
      <aside className="flex flex-col gap-4 lg:sticky lg:top-0 lg:max-h-[calc(100vh-5.5rem)] lg:self-start lg:overflow-y-auto lg:pt-1 lg:pb-4">
        <WorkspaceIllustration />
        <ContentSettingsPanel
          selectedCount={selected.size}
          onGenerate={handleGenerate}
          feedback={feedback}
        />
      </aside>
    </div>
  )
}
