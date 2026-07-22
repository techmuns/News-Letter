import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore'
import { type WorkspaceItemType } from '../types'
import { previewPath } from '../lib/routes'
import { cn } from '../lib/cn'
import {
  defaultSelectionForMix,
  sourceLabels,
  mixById,
} from '../data/sources'
import { MicroLabel } from '../components/MicroLabel'
import { Segmented } from '../components/Segmented'
import { Menu, MenuItem } from '../components/Menu'
import { DropZone } from '../components/workspace/DropZone'
import { PileRow } from '../components/workspace/PileRow'
import { SourcePicker } from '../components/workspace/SourcePicker'
import { DraftEditor } from '../components/workspace/DraftEditor'
import { ContentSettingsPanel } from '../components/workspace/ContentSettingsPanel'
import { WorkspaceIllustration } from '../components/workspace/WorkspaceIllustration'
import {
  IconChevronDown,
  IconFilter,
  IconArrowRight,
  IconUpload,
  IconSparkle,
} from '../components/icons'

type Mode = 'manual' | 'auto'
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
  const generateDraft = useStore((s) => s.generateDraft)
  const regenerateDraft = useStore((s) => s.regenerateDraft)
  const commitDraft = useStore((s) => s.commitDraft)
  const discardDraft = useStore((s) => s.discardDraft)
  const draftId = useStore((s) => s.draftId)
  const draft = useStore((s) => s.campaigns.find((c) => c.id === s.draftId) ?? null)
  const navigate = useNavigate()

  const [mode, setMode] = useState<Mode>('manual')
  // manual pile selection
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [sort, setSort] = useState<SortMode>('recent')
  const [filter, setFilter] = useState<FilterMode>('all')
  const [showAll, setShowAll] = useState(false)
  // automatic generator selection
  const [mix, setMix] = useState('linkedin')
  const [autoSelected, setAutoSelected] = useState<Set<string>>(
    () => new Set(defaultSelectionForMix('linkedin')),
  )
  // when a draft exists, inputs collapse — this reopens them to change sources
  const [inputsOpen, setInputsOpen] = useState(false)
  const [feedback, setFeedback] = useState<{ text: string; ok: boolean } | null>(null)

  const filtered = useMemo(() => {
    return items
      .filter((it) => (filter === 'all' ? true : it.type === filter))
      .slice()
      .sort((a, b) => {
        const da = new Date(a.createdAt).getTime()
        const db = new Date(b.createdAt).getTime()
        return sort === 'recent' ? db - da : da - db
      })
  }, [items, filter, sort])

  const visible = showAll ? filtered : filtered.slice(0, PAGE)
  const hasMore = filtered.length > PAGE

  function flash(text: string, ok: boolean) {
    setFeedback({ text, ok })
    window.setTimeout(() => setFeedback(null), 5000)
  }

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

  function toggleSource(id: string) {
    setAutoSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function setGroup(ids: string[], select: boolean) {
    setAutoSelected((prev) => {
      const next = new Set(prev)
      ids.forEach((id) => (select ? next.add(id) : next.delete(id)))
      return next
    })
  }

  function changeMix(id: string) {
    setMix(id)
    setAutoSelected(new Set(defaultSelectionForMix(id)))
  }

  // The generation input for the current mode.
  function currentInput() {
    if (mode === 'manual') {
      const ids = items.filter((it) => selected.has(it.id)).map((it) => it.id)
      const labels = items.filter((it) => selected.has(it.id)).map((it) => it.title)
      return { sourceMode: 'manual' as const, sourceItemIds: ids, sourceLabels: labels }
    }
    return { sourceMode: 'auto' as const, sourceLabels: sourceLabels(autoSelected) }
  }

  const canGenerate = mode === 'manual' ? selected.size > 0 : autoSelected.size > 0

  function handleGenerate() {
    if (!canGenerate) {
      flash(
        mode === 'manual'
          ? 'Select one or more items from the pile first.'
          : 'Select at least one source to generate from.',
        false,
      )
      return
    }
    generateDraft(currentInput())
    setInputsOpen(false)
    setFeedback(null)
  }

  function handleRegenerate() {
    regenerateDraft(currentInput())
  }

  function handleContinue() {
    const id = commitDraft()
    if (id) navigate(previewPath(id))
  }

  function handleDiscard() {
    discardDraft()
    setInputsOpen(false)
  }

  const showInputs = !draftId || inputsOpen
  const autoCount = autoSelected.size
  const selCount = mode === 'manual' ? selected.size : autoCount

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
          Start from your own material or from continuously monitored sources — then generate,
          refine and preview content without leaving this page.
        </p>

        {/* two input modes */}
        <div className="mt-6">
          <Segmented
            value={mode}
            onChange={(m) => setMode(m)}
            options={[
              { value: 'manual', label: 'Upload / Manual' },
              { value: 'auto', label: 'Automatic Generator' },
            ]}
          />
        </div>

        {/* when a draft exists, inputs collapse into a summary bar */}
        {draftId && (
          <button
            type="button"
            onClick={() => setInputsOpen((o) => !o)}
            className="mt-4 flex w-full items-center justify-between gap-3 rounded-xl border border-border bg-surface px-4 py-3 text-left transition-colors hover:border-border-strong"
          >
            <span className="flex items-center gap-2.5">
              {mode === 'auto' ? (
                <IconSparkle size={14} className="text-violet" />
              ) : (
                <IconUpload size={14} className="text-violet" />
              )}
              <span className="text-[13px] text-text-2">
                {mode === 'auto'
                  ? `${autoCount} source${autoCount === 1 ? '' : 's'} · ${mixById(mix).label}`
                  : `${selected.size} item${selected.size === 1 ? '' : 's'} selected`}
              </span>
            </span>
            <span className="flex items-center gap-1.5 text-[12px] font-medium text-violet">
              {inputsOpen ? 'Hide' : 'Change sources'}
              <IconChevronDown
                size={14}
                className={cn('transition-transform', inputsOpen && 'rotate-180')}
              />
            </span>
          </button>
        )}

        {/* input UI */}
        {showInputs && (
          <div className={cn(draftId && 'mt-4')}>
            {mode === 'manual' ? (
              <>
                <div className="mt-6">
                  <DropZone />
                </div>

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
                          Nothing here yet. Drop a PDF, a screenshot or a thought above to start the
                          pile.
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
              </>
            ) : (
              <div className="mt-6">
                <SourcePicker
                  mix={mix}
                  onMix={changeMix}
                  selected={autoSelected}
                  onToggle={toggleSource}
                  onGroupSet={setGroup}
                />
              </div>
            )}
          </div>
        )}

        {/* the generated draft — created, edited and refined right here */}
        {draft && (
          <div className="mt-8">
            <DraftEditor
              campaign={draft}
              onRegenerate={handleRegenerate}
              onContinue={handleContinue}
              onDiscard={handleDiscard}
            />
          </div>
        )}
      </div>

      {/* right column — illustration + content settings */}
      <aside className="flex flex-col gap-4 lg:sticky lg:top-0 lg:max-h-[calc(100vh-5.5rem)] lg:self-start lg:overflow-y-auto lg:pt-1 lg:pb-4">
        {!draftId && <WorkspaceIllustration />}
        <ContentSettingsPanel
          canGenerate={draftId ? true : canGenerate}
          ctaLabel={draftId ? 'Regenerate' : 'Generate content'}
          onGenerate={draftId ? handleRegenerate : handleGenerate}
          feedback={feedback}
          hint={
            draftId
              ? 'Regenerate applies your latest settings & sources to this draft.'
              : canGenerate
                ? `${selCount} selected — these settings apply to every generation.`
                : mode === 'manual'
                  ? 'Select items from the pile, then generate.'
                  : 'Select sources, then generate.'
          }
        />
      </aside>
    </div>
  )
}
