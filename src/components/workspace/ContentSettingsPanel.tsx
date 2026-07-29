import { cn } from '../../lib/cn'
import { useStore } from '../../store/useStore'
import {
  CONTENT_TYPE_GROUPS,
  TONE_OPTS,
  AUDIENCE_GROUPS,
  OBJECTIVE_OPTS,
  DEPTH_OPTS,
} from '../../lib/brief'
import { MicroLabel } from '../MicroLabel'
import { SelectField } from '../SelectField'
import { RangeSlider } from '../RangeSlider'
import { Button } from '../Button'
import { IconSliders, IconSparkle, IconSpinner } from '../icons'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <MicroLabel className="text-text-muted">{label}</MicroLabel>
      {children}
    </div>
  )
}

interface ContentSettingsPanelProps {
  /** whether the primary action is enabled */
  canGenerate: boolean
  /** label for the primary button (e.g. "Generate content" / "Regenerate") */
  ctaLabel: string
  /** a generation is in flight — a model call is not instant */
  busy?: boolean
  onGenerate: () => void
  feedback?: { text: string; ok: boolean } | null
  /** helper line under the button */
  hint?: string
}

/**
 * The persistent Content Settings card — every control is bound to the real,
 * persisted generation brief in the store; the primary button hands the
 * current selection + brief to the generation flow (generate or regenerate).
 */
export function ContentSettingsPanel({
  canGenerate,
  ctaLabel,
  busy = false,
  onGenerate,
  feedback,
  hint,
}: ContentSettingsPanelProps) {
  const brief = useStore((s) => s.brief)
  const updateBrief = useStore((s) => s.updateBrief)

  return (
    <div className="glass rounded-panel p-5">
      {/* header */}
      <div className="flex items-start gap-3">
        <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-purple-soft">
          <IconSliders size={16} className="text-violet" />
        </span>
        <div>
          <h2 className="text-[13.5px] font-semibold tracking-tight text-text">Content Settings</h2>
          <p className="mt-1 text-[12px] leading-relaxed text-text-muted">
            Control how your content is created.
          </p>
        </div>
      </div>

      {/* controls */}
      <div className="mt-5 flex flex-col gap-4">
        <Field label="Content Type">
          <SelectField
            value={brief.contentType}
            onChange={(v) => updateBrief({ contentType: v })}
            options={CONTENT_TYPE_GROUPS}
          />
        </Field>

        <Field label="Audience">
          <SelectField
            value={brief.audience}
            onChange={(v) => updateBrief({ audience: v })}
            options={AUDIENCE_GROUPS}
          />
        </Field>

        <Field label="Objective">
          <SelectField
            value={brief.objective}
            onChange={(v) => updateBrief({ objective: v })}
            options={OBJECTIVE_OPTS}
          />
        </Field>

        {/* Tone and Depth are scales, so the slider is the whole control —
            it names the setting it lands on instead of a second dropdown. */}
        <Field label="Tone">
          <RangeSlider
            options={TONE_OPTS}
            value={brief.tone}
            onChange={(v) => updateBrief({ tone: v })}
            leftLabel="Formal"
            rightLabel="Conversational"
            ariaLabel="Tone: formal to conversational"
          />
        </Field>

        <Field label="Depth">
          <RangeSlider
            options={DEPTH_OPTS}
            value={brief.depth}
            onChange={(v) => updateBrief({ depth: v })}
            leftLabel="Concise"
            rightLabel="In-depth"
            ariaLabel="Depth: concise to in-depth"
          />
        </Field>
      </div>

      {/* generate */}
      <div className="mt-5">
        <Button
          variant="primary"
          onClick={onGenerate}
          disabled={!canGenerate}
          className="w-full justify-center py-3 text-[14px]"
        >
          {busy ? (
            <IconSpinner size={16} className="animate-spin" />
          ) : (
            <IconSparkle size={16} />
          )}{' '}
          {ctaLabel}
        </Button>

        {feedback ? (
          <p
            className={cn(
              'mt-3 text-center text-[11.5px] leading-relaxed',
              feedback.ok ? 'text-green' : 'text-amber',
            )}
          >
            {feedback.text}
          </p>
        ) : (
          <p className="mt-3 text-center text-[11px] leading-relaxed text-text-dim">
            {hint ?? 'These preferences will be applied to all content you generate.'}
          </p>
        )}
      </div>
    </div>
  )
}
