import { useEffect, useState } from 'react'
import { cn } from '../../lib/cn'
import {
  type GenerationBrief,
  type WorkspaceItem,
  CHANNEL_ORDER,
  CHANNEL_LABEL,
} from '../../types'
import {
  DEFAULT_BRIEF,
  PRESETS,
  applyGuardrails,
  briefSentence,
  briefChips,
  AUDIENCE_OPTS,
  OBJECTIVE_OPTS,
  PILLAR_OPTS,
  CONTENT_TYPE_OPTS,
  DEPTH_OPTS,
  LENGTH_OPTS,
  LENGTH_HINT,
  TONE_OPTS,
  POV_OPTS,
  DATA_OPTS,
  MARKET_OPTS,
  RATIO_OPTS,
  COMPLIANCE_OPTS,
  SOURCING_OPTS,
  CONFIDENCE_OPTS,
} from '../../lib/brief'
import { Button } from '../Button'
import { MicroLabel } from '../MicroLabel'
import { Segmented } from '../Segmented'
import { SelectField } from '../SelectField'
import { ChannelIcon, IconSparkle, IconClose, IconChevronRight } from '../icons'

interface BriefModalProps {
  open: boolean
  items: WorkspaceItem[]
  onClose: () => void
  onGenerate: (brief: GenerationBrief) => void
}

/** A labelled control row. */
function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <div className="flex items-baseline justify-between gap-2">
        <MicroLabel className="text-text-muted">{label}</MicroLabel>
        {hint && <span className="text-[10.5px] text-text-dim">{hint}</span>}
      </div>
      {children}
    </div>
  )
}

function GroupLabel({ children }: { children: React.ReactNode }) {
  return <MicroLabel className="micro-violet">{children}</MicroLabel>
}

export function BriefModal({ open, items, onClose, onGenerate }: BriefModalProps) {
  const [brief, setBrief] = useState<GenerationBrief>(DEFAULT_BRIEF)
  const [advanced, setAdvanced] = useState(false)

  // Fresh brief each time the panel opens.
  useEffect(() => {
    if (open) {
      setBrief(DEFAULT_BRIEF)
      setAdvanced(false)
    }
  }, [open])

  // Lock background scroll while open.
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  // Escape to close.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  function update<K extends keyof GenerationBrief>(key: K, value: GenerationBrief[K]) {
    // A manual edit makes it a custom brief (drops the preset marker).
    setBrief((b) => ({ ...b, [key]: value, preset: undefined }))
  }

  const effective = applyGuardrails(brief)

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:p-6">
      {/* backdrop */}
      <div
        className="fixed inset-0 bg-[rgba(12,10,20,0.66)] backdrop-blur-[3px] animate-fade-up"
        onClick={onClose}
        aria-hidden
      />

      {/* panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Content brief"
        className="relative my-auto w-full max-w-[680px] rounded-panel border border-border-strong bg-surface-solid shadow-[0_24px_80px_-24px_rgba(0,0,0,0.7)] animate-fade-up"
      >
        {/* header */}
        <div className="flex items-start justify-between gap-4 border-b border-[rgba(255,255,255,0.08)] px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <IconSparkle size={15} className="text-violet" />
              <h2 className="text-[15px] font-semibold text-text">Content brief</h2>
            </div>
            <p className="mt-1 text-[12.5px] leading-relaxed text-text-muted">
              {items.length === 1
                ? 'Shape how this item becomes content'
                : `Shape how these ${items.length} items become content`}{' '}
              — one campaign, three linked channels.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 rounded-lg border border-border p-1.5 text-text-muted transition-colors hover:border-border-strong hover:text-text focus-violet"
          >
            <IconClose size={15} />
          </button>
        </div>

        {/* body */}
        <div className="max-h-[min(70vh,720px)] overflow-y-auto px-5 py-5 sm:px-6">
          {/* source items */}
          {items.length > 0 && (
            <div className="mb-5">
              <MicroLabel className="text-text-muted">Source material</MicroLabel>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {items.map((it) => (
                  <span
                    key={it.id}
                    className="max-w-[220px] truncate rounded-md border border-border bg-[rgba(255,255,255,0.03)] px-2 py-1 text-[11.5px] text-text-2"
                    title={it.title}
                  >
                    {it.title}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* presets */}
          <div className="mb-6">
            <MicroLabel className="text-text-muted">Start from a preset</MicroLabel>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {PRESETS.map((p) => {
                const active = brief.preset === p.id
                return (
                  <button
                    key={p.id}
                    type="button"
                    title={p.description}
                    onClick={() => setBrief(p.brief)}
                    className={cn(
                      'rounded-lg border px-2.5 py-1 text-[12px] transition-all duration-200 focus-violet',
                      active
                        ? 'border-[rgba(170,152,248,0.5)] bg-[rgba(170,152,248,0.16)] text-violet'
                        : 'border-border text-text-2 hover:border-border-strong hover:text-text',
                    )}
                  >
                    {p.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* core */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Audience">
              <SelectField value={brief.audience} onChange={(v) => update('audience', v)} options={AUDIENCE_OPTS} />
            </Field>
            <Field label="Objective">
              <SelectField value={brief.objective} onChange={(v) => update('objective', v)} options={OBJECTIVE_OPTS} />
            </Field>
            <Field label="Content pillar">
              <SelectField value={brief.pillar} onChange={(v) => update('pillar', v)} options={PILLAR_OPTS} />
            </Field>
            <Field label="Format">
              <SelectField value={brief.contentType} onChange={(v) => update('contentType', v)} options={CONTENT_TYPE_OPTS} />
            </Field>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4">
            <Field label="Depth">
              <Segmented value={brief.depth} onChange={(v) => update('depth', v)} options={DEPTH_OPTS} />
            </Field>
            <Field label="Length" hint={LENGTH_HINT[brief.length]}>
              <Segmented value={brief.length} onChange={(v) => update('length', v)} options={LENGTH_OPTS} />
            </Field>
            <Field label="Tone">
              <Segmented value={brief.tone} onChange={(v) => update('tone', v)} options={TONE_OPTS} />
            </Field>
          </div>

          {/* advanced */}
          <div className="mt-5 border-t border-[rgba(255,255,255,0.07)] pt-4">
            <button
              type="button"
              onClick={() => setAdvanced((a) => !a)}
              className="flex w-full items-center justify-between text-left focus-violet"
            >
              <MicroLabel className="text-text-2">Advanced controls</MicroLabel>
              <IconChevronRight
                size={14}
                className={cn('text-text-dim transition-transform duration-200', advanced && 'rotate-90')}
              />
            </button>

            {advanced && (
              <div className="mt-4 flex flex-col gap-4 animate-fade-up">
                <div className="grid grid-cols-1 gap-4">
                  <Field label="Point of view">
                    <Segmented value={brief.pointOfView} onChange={(v) => update('pointOfView', v)} options={POV_OPTS} />
                  </Field>
                  <Field label="Data intensity">
                    <Segmented value={brief.dataIntensity} onChange={(v) => update('dataIntensity', v)} options={DATA_OPTS} />
                  </Field>
                  <Field label="Market lens">
                    <Segmented value={brief.marketLens} onChange={(v) => update('marketLens', v)} options={MARKET_OPTS} />
                  </Field>
                </div>

                {/* governance sub-group */}
                <div className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.02)] p-4">
                  <GroupLabel>Governance</GroupLabel>
                  <div className="mt-3 flex flex-col gap-4">
                    <Field label="Insight-to-promotion">
                      <Segmented value={brief.promotionRatio} onChange={(v) => update('promotionRatio', v)} options={RATIO_OPTS} />
                    </Field>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <Field label="Compliance">
                        <SelectField value={brief.compliance} onChange={(v) => update('compliance', v)} options={COMPLIANCE_OPTS} />
                      </Field>
                      <Field label="Sourcing rigor">
                        <SelectField value={brief.sourcing} onChange={(v) => update('sourcing', v)} options={SOURCING_OPTS} />
                      </Field>
                    </div>
                    <Field label="Confidence">
                      <Segmented value={brief.confidence} onChange={(v) => update('confidence', v)} options={CONFIDENCE_OPTS} />
                    </Field>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* live summary */}
          <div className="mt-5 rounded-xl border border-[rgba(170,152,248,0.28)] bg-[rgba(170,152,248,0.06)] p-4">
            <MicroLabel className="micro-violet">This brief</MicroLabel>
            <p className="mt-2 text-[13px] leading-relaxed text-text">{briefSentence(effective.brief)}</p>
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {briefChips(effective.brief).map((c) => (
                <span
                  key={c}
                  className="rounded-md border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.03)] px-2 py-0.5 text-[11px] text-text-2"
                >
                  {c}
                </span>
              ))}
            </div>

            {effective.notes.length > 0 && (
              <ul className="mt-3 flex flex-col gap-1.5 border-t border-[rgba(255,255,255,0.08)] pt-3">
                {effective.notes.map((n) => (
                  <li key={n} className="flex items-start gap-2 text-[11.5px] leading-relaxed text-amber">
                    <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-amber" />
                    {n}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* footer */}
        <div className="flex flex-col gap-3 border-t border-[rgba(255,255,255,0.08)] px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="flex items-center gap-2">
            <MicroLabel className="text-text-dim">Drafts</MicroLabel>
            <div className="flex items-center gap-2">
              {CHANNEL_ORDER.map((kind) => (
                <span key={kind} className="flex items-center gap-1 text-text-muted" title={CHANNEL_LABEL[kind]}>
                  <ChannelIcon kind={kind} size={13} />
                </span>
              ))}
            </div>
            <MicroLabel className="text-text-dim">three linked channels</MicroLabel>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" onClick={() => onGenerate(effective.brief)}>
              <IconSparkle size={15} /> Generate content
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
