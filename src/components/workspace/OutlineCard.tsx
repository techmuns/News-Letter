import { useRef, useState } from 'react'
import { cn } from '../../lib/cn'
import { useStore } from '../../store/useStore'
import { type MaterialGroup, type WorkspaceItemType } from '../../types'
import { Button } from '../Button'
import { MicroLabel } from '../MicroLabel'
import {
  IconPdf,
  IconScreenshot,
  IconNote,
  IconLink,
  IconEdit,
  IconCheck,
  IconRefresh,
  IconSparkle,
  IconArrowRight,
  IconClose,
} from '../icons'

const TYPE_ICON: Record<WorkspaceItemType, { Icon: typeof IconPdf; icon: string }> = {
  pdf: { Icon: IconPdf, icon: 'text-red' },
  screenshot: { Icon: IconScreenshot, icon: 'text-green' },
  note: { Icon: IconNote, icon: 'text-amber' },
  link: { Icon: IconLink, icon: 'text-sky' },
}

interface OutlineCardProps {
  group: MaterialGroup
  /** generate the full post from this write-up */
  onGenerate: () => void
  /** go back and change the materials */
  onEditMaterials: () => void
  onDiscard: () => void
}

/** Rough reading measure — enough to tell a one-liner from a real draft. */
function wordCount(text: string): number {
  return text.trim() ? text.trim().split(/\s+/).length : 0
}

/**
 * Step one of generating a post. Once the materials are in, this is the basic
 * write-up composed from them — shown as the post it will become, and directly
 * editable. Whatever the author leaves here is what the full generation runs
 * on, so the first thing they do is correct the machine rather than accept it.
 */
export function OutlineCard({ group, onGenerate, onEditMaterials, onDiscard }: OutlineCardProps) {
  const updateOutline = useStore((s) => s.updateOutline)
  const recomposeOutline = useStore((s) => s.recomposeOutline)
  const outline = group.outline

  const [editing, setEditing] = useState(false)
  const bodyRef = useRef<HTMLTextAreaElement>(null)

  if (!outline) return null

  const { items } = group
  const counts = items.reduce<Partial<Record<WorkspaceItemType, number>>>((acc, it) => {
    acc[it.type] = (acc[it.type] ?? 0) + 1
    return acc
  }, {})
  const words = wordCount(outline.body)

  /** Clicking the read-only copy drops straight into editing it. */
  function startEditing(focusBody = false) {
    setEditing(true)
    if (focusBody) window.setTimeout(() => bodyRef.current?.focus(), 0)
  }

  return (
    <section aria-label="Draft write-up" className="glass animate-fade-up rounded-panel">
      {/* header — what this is, and where it came from */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3.5">
        <div className="flex flex-wrap items-center gap-2.5">
          <MicroLabel tone="violet">Step 1 · Your write-up</MicroLabel>
          {outline.edited ? (
            <span className="flex items-center gap-1 text-[11px] text-green">
              <IconCheck size={12} /> your words
            </span>
          ) : (
            <span className="text-[11px] text-text-dim">drafted from your material</span>
          )}
        </div>
        <div className="flex items-center gap-2.5">
          {(Object.keys(counts) as WorkspaceItemType[]).map((t) => {
            const { Icon, icon } = TYPE_ICON[t]
            return (
              <span key={t} className="flex items-center gap-1 text-[11.5px] text-text-muted">
                <Icon size={13} className={icon} /> {counts[t]}
              </span>
            )
          })}
          <button
            type="button"
            onClick={onDiscard}
            aria-label="Discard this write-up"
            className="grid h-6 w-6 place-items-center rounded-md text-text-dim transition-colors hover:bg-surface-hover hover:text-red focus-violet"
          >
            <IconClose size={13} />
          </button>
        </div>
      </div>

      {/* the write-up — reads as the post, edits in place */}
      <div className="px-5 py-5">
        {editing ? (
          <>
            <MicroLabel className="text-text-dim">Headline</MicroLabel>
            <input
              value={outline.headline}
              onChange={(e) => updateOutline(group.id, { headline: e.target.value })}
              placeholder="What is this post about?"
              className={cn(
                'mt-1.5 w-full rounded-lg border border-border bg-surface-solid px-3 py-2',
                'text-[17px] font-semibold leading-snug text-text placeholder:text-text-muted focus-violet',
              )}
            />

            <MicroLabel className="mt-4 block text-text-dim">Write-up</MicroLabel>
            <textarea
              ref={bodyRef}
              value={outline.body}
              onChange={(e) => updateOutline(group.id, { body: e.target.value })}
              rows={12}
              placeholder="Say it in your own words — this is what the post gets built from."
              className={cn(
                'mt-1.5 w-full resize-y rounded-lg border border-border bg-surface-solid px-3.5 py-3',
                'text-[14px] leading-relaxed text-text placeholder:text-text-muted focus-violet',
              )}
            />
          </>
        ) : (
          <div
            role="button"
            tabIndex={0}
            onClick={() => startEditing()}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                startEditing()
              }
            }}
            title="Click to edit"
            className="group cursor-text rounded-lg text-left focus-violet"
          >
            <h3 className="font-display text-[21px] font-bold leading-[1.2] tracking-tight text-heading">
              {outline.headline || 'Untitled post'}
            </h3>
            <div className="mt-3 flex flex-col gap-3">
              {outline.body.split('\n\n').map((para, i) => (
                <p key={i} className="whitespace-pre-line text-[14.5px] leading-relaxed text-text-2">
                  {para}
                </p>
              ))}
            </div>
            <span className="mt-3 inline-flex items-center gap-1.5 text-[11.5px] text-text-dim opacity-0 transition-opacity group-hover:opacity-100">
              <IconEdit size={12} /> Click anywhere to rewrite this
            </span>
          </div>
        )}
      </div>

      {/* actions */}
      <div className="flex flex-wrap items-center gap-2.5 border-t border-border px-5 py-4">
        <Button variant="subtle" size="sm" onClick={() => (editing ? setEditing(false) : startEditing(true))}>
          {editing ? (
            <>
              <IconCheck size={14} /> Done editing
            </>
          ) : (
            <>
              <IconEdit size={14} /> Edit write-up
            </>
          )}
        </Button>
        <button
          type="button"
          onClick={onEditMaterials}
          className="text-[12px] text-text-muted transition-colors hover:text-violet focus-violet"
        >
          Change materials
        </button>
        {outline.edited && (
          <button
            type="button"
            onClick={() => recomposeOutline(group.id)}
            title="Throw away your edits and rebuild from the materials"
            className="flex items-center gap-1.5 text-[12px] text-text-muted transition-colors hover:text-violet focus-violet"
          >
            <IconRefresh size={12} /> Start over
          </button>
        )}
        <span className="ml-auto flex items-center gap-3">
          <span className="text-[11.5px] text-text-dim">
            {words} word{words === 1 ? '' : 's'}
          </span>
          <Button variant="primary" size="md" onClick={onGenerate} disabled={words === 0}>
            <IconSparkle size={15} /> Generate the post <IconArrowRight size={15} />
          </Button>
        </span>
      </div>
    </section>
  )
}
