import { useMemo, useRef, useState } from 'react'
import { cn } from '../../lib/cn'
import { useStore } from '../../store/useStore'
import { type MaterialGroup, type WorkspaceItemType } from '../../types'
import { PATTERNS, type PatternId, GAP_RE, scorePiece } from '../../lib/playbook'
import { Button } from '../Button'
import { MicroLabel } from '../MicroLabel'
import { StatusDot } from '../StatusDot'
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
  IconChevronDown,
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
 * Renders a paragraph with the playbook's bracketed gaps called out.
 *
 * The gaps are deliberate: where a figure or a mechanism belongs and the
 * material didn't supply one, the write-up asks for it rather than inventing
 * it. Marking them makes the ask visible instead of leaving "[the mechanism…]"
 * to be published by accident.
 */
function Para({ text }: { text: string }) {
  const parts = text.split(new RegExp(`(${GAP_RE.source})`, 'g'))
  return (
    <p className="whitespace-pre-line text-[14.5px] leading-relaxed text-text-2">
      {parts.map((part, i) =>
        /^\[[^\]\n]{4,}\]$/.test(part) ? (
          <mark
            key={i}
            className="rounded bg-amber-soft px-1 text-[13.5px] italic text-amber"
          >
            {part}
          </mark>
        ) : (
          part
        ),
      )}
    </p>
  )
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

  const brief = useStore((s) => s.brief)
  const [editing, setEditing] = useState(false)
  const [showScore, setShowScore] = useState(false)
  const bodyRef = useRef<HTMLTextAreaElement>(null)

  // §9 of the playbook — the pre-publish rubric, run live on the write-up so
  // the author sees what would be rejected before the post is generated.
  const score = useMemo(
    () =>
      outline
        ? scorePiece({ headline: outline.headline, body: outline.body, brief })
        : null,
    [outline?.headline, outline?.body, brief],
  )

  if (!outline || !score) return null

  const { items } = group
  const pattern = outline.pattern ? PATTERNS[outline.pattern as PatternId] : undefined
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
          {/* which playbook pattern this is shaped on (§5) */}
          {/* Names the pattern the Content Type chose, so changing that setting
              is visibly what reshaped the write-up. */}
          {pattern && (
            <span
              title={`${pattern.shape}\n\nPattern ${pattern.rank} of 7 in the playbook — chosen by your Content Type${
                outline.edited ? '. Your edits are kept; hit Rebuild to reshape.' : ''
              }`}
              className="rounded-full border border-border px-2 py-0.5 text-[10.5px] text-text-muted"
            >
              {pattern.name}
            </span>
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
                <Para key={i} text={para} />
              ))}
            </div>
            <span className="mt-3 inline-flex items-center gap-1.5 text-[11.5px] text-text-dim opacity-0 transition-opacity group-hover:opacity-100">
              <IconEdit size={12} /> Click anywhere to rewrite this
            </span>
          </div>
        )}
      </div>

      {/* the playbook check — §9's rubric, plus what it still wants */}
      <div className="border-t border-border px-5 py-3.5">
        <button
          type="button"
          onClick={() => setShowScore((v) => !v)}
          className="flex w-full items-center gap-2.5 text-left focus-violet"
        >
          <StatusDot tone={score.pass ? 'green' : score.total >= 7 ? 'amber' : 'red'} />
          <span className="text-[12.5px] font-medium text-text">
            Playbook check · {score.total}/12
          </span>
          <span className="text-[11.5px] text-text-dim">
            {score.pass
              ? 'clears the pre-publish bar'
              : score.gaps > 0
                ? `${score.gaps} gap${score.gaps > 1 ? 's' : ''} to fill`
                : 'below the pass bar of 9'}
          </span>
          <IconChevronDown
            size={14}
            className={cn('ml-auto text-text-dim transition-transform', showScore && 'rotate-180')}
          />
        </button>

        {showScore && (
          <div className="mt-3 flex flex-col gap-1.5">
            {score.lines.map((l) => (
              <div key={l.dim} className="flex items-start gap-2.5 text-[12px]">
                <span
                  className={cn(
                    'mt-px w-4 shrink-0 text-right font-medium tabular-nums',
                    l.score === 2 ? 'text-green' : l.score === 1 ? 'text-amber' : 'text-red',
                  )}
                >
                  {l.score}
                </span>
                <span className="w-[126px] shrink-0 text-text-2">{l.label}</span>
                <span className="min-w-0 text-text-dim">{l.fix}</span>
              </div>
            ))}
            {score.hardRejects.length > 0 && (
              <p className="mt-1.5 text-[11.5px] leading-relaxed text-red">
                Would be rejected: {score.hardRejects.join(' · ')}
              </p>
            )}
            <p className="mt-1.5 text-[11px] leading-relaxed text-text-dim">
              Bracketed gaps are left for you on purpose — the playbook's rule is never to
              invent a figure. Fill them with the real numbers from your material.
            </p>
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
        {/* Always offered, not just after an edit — a write-up composed under an
            older brief (or an older playbook) needs a way back to a fresh one. */}
        <button
          type="button"
          onClick={() => recomposeOutline(group.id)}
          title={
            outline.edited
              ? 'Throw away your edits and rebuild from the materials'
              : 'Rebuild from the materials using the current settings'
          }
          className="flex items-center gap-1.5 text-[12px] text-text-muted transition-colors hover:text-violet focus-violet"
        >
          <IconRefresh size={12} /> {outline.edited ? 'Start over' : 'Rebuild'}
        </button>
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
