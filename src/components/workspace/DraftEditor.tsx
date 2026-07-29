import { cn } from '../../lib/cn'
import { useStore } from '../../store/useStore'
import { type Campaign, CHANNEL_ORDER, CHANNEL_LABEL } from '../../types'
import { modelCallsMade } from '../../lib/ai'
import { briefChips } from '../../lib/brief'
import { MicroLabel } from '../MicroLabel'
import { Button } from '../Button'
import { StatusChip } from '../StatusChip'
import { LinkedInPost } from '../preview/LinkedInPost'
import {
  ChannelIcon,
  IconRefresh,
  IconArrowRight,
  IconClose,
  IconEdit,
  IconSparkle,
  IconSpinner,
  IconUpload,
  IconEye,
} from '../icons'

interface DraftEditorProps {
  campaign: Campaign
  /** a regeneration is in flight */
  busy?: boolean
  onRegenerate: () => void
  onContinue: () => void
  onDiscard: () => void
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-md border border-border bg-surface-soft px-2 py-0.5 text-[11px] text-text-2">
      {children}
    </span>
  )
}

function kb(bytes: number): string {
  if (!bytes) return '0 KB'
  const kilo = bytes / 1024
  return kilo < 1024 ? `${Math.round(kilo)} KB` : `${(kilo / 1024).toFixed(1)} MB`
}

/**
 * What the model was actually given, reported from the server's own count of
 * the request it sent.
 *
 * This exists because "the image is in the app" and "the image reached the
 * model" look identical from the outside, and only the second one produces a
 * post about the document. If this says 0 images, the draft in front of you was
 * not written from your upload — and that is worth being able to see at a
 * glance rather than having to open a network tab to find out.
 */
function AiTraceCard({ campaign }: { campaign: Campaign }) {
  const trace = campaign.ai
  if (!trace) return null
  return (
    <div className="glass mt-4 rounded-xl p-3.5">
      <div className="flex items-center gap-2">
        <IconEye size={13} className="text-violet" />
        <MicroLabel className="text-text-dim">Read by the model</MicroLabel>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <Chip>{trace.model}</Chip>
        <Chip>
          {trace.imagesSent} image{trace.imagesSent === 1 ? '' : 's'} sent
          {trace.imagesSent > 0 ? ` · ${kb(trace.imageBytes)}` : ''}
          {trace.imagesSent > 0 && trace.imageDetail ? ` · ${trace.imageDetail} detail` : ''}
        </Chip>
        {trace.documentsSent > 0 && (
          <Chip>
            {trace.documentsSent} document{trace.documentsSent === 1 ? '' : 's'} ·{' '}
            {trace.documentChars.toLocaleString('en-IN')} chars
          </Chip>
        )}
        {trace.promptTokens !== null && (
          <Chip>
            {trace.promptTokens.toLocaleString('en-IN')} in
            {trace.completionTokens !== null
              ? ` · ${trace.completionTokens.toLocaleString('en-IN')} out`
              : ''}{' '}
            tokens
          </Chip>
        )}
        {/* Billed calls, counted in the browser — what a demo actually spent. */}
        <Chip>
          {modelCallsMade()} model call{modelCallsMade() === 1 ? '' : 's'} this session
        </Chip>
      </div>
      {campaign.aiSummary && (
        <p className="mt-2.5 text-[12px] leading-relaxed text-text-2">{campaign.aiSummary}</p>
      )}
      {campaign.aiFacts && campaign.aiFacts.length > 0 && (
        <ul className="mt-2 flex flex-col gap-1">
          {campaign.aiFacts.slice(0, 6).map((fact) => (
            <li key={fact} className="flex items-start gap-2 text-[11.5px] leading-relaxed text-text-muted">
              <span className="mt-[5px] h-1 w-1 shrink-0 rounded-full bg-violet" />
              {fact}
            </li>
          ))}
        </ul>
      )}
      {trace.imagesSent === 0 && (
        <p className="mt-2 text-[11px] leading-relaxed text-amber">
          No image was transmitted with this generation — the copy came from text alone.
        </p>
      )}
    </div>
  )
}

/**
 * The Workspace's create-and-refine surface. Shows the generated draft as
 * editable copy with a live LinkedIn preview, the sources + settings it came
 * from, a Regenerate that responds to the latest settings, and the primary
 * "Continue to Preview" once the author is satisfied.
 */
export function DraftEditor({
  campaign,
  busy = false,
  onRegenerate,
  onContinue,
  onDiscard,
}: DraftEditorProps) {
  const updateDraftContent = useStore((s) => s.updateDraftContent)
  const li = campaign.linkedin.content
  const chips = campaign.brief ? briefChips(campaign.brief) : []
  const auto = campaign.sourceMode === 'auto'

  return (
    <div className="animate-fade-up">
      {/* header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <MicroLabel tone="violet">Draft</MicroLabel>
          <StatusChip status={campaign.linkedin.status} />
          {campaign.linkedin.edited && (
            <span className="flex items-center gap-1 text-[11px] text-text-dim">
              <IconEdit size={12} /> edited
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={onDiscard}
          className="flex items-center gap-1.5 text-[12px] text-text-muted transition-colors hover:text-text-2"
        >
          <IconClose size={13} /> Discard
        </button>
      </div>

      {/* provenance — where it came from + which settings are active */}
      <div className="glass mt-4 rounded-xl p-3.5">
        <div className="flex items-center gap-2">
          {auto ? (
            <IconSparkle size={13} className="text-violet" />
          ) : (
            <IconUpload size={13} className="text-violet" />
          )}
          <MicroLabel className="text-text-dim">
            {auto ? 'Automatic generator' : 'My materials'} · sources
          </MicroLabel>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {campaign.sources && campaign.sources.length > 0 ? (
            campaign.sources.slice(0, 6).map((s) => <Chip key={s}>{s}</Chip>)
          ) : (
            <Chip>{campaign.sourceItemIds.length || 'No'} uploaded item{campaign.sourceItemIds.length === 1 ? '' : 's'}</Chip>
          )}
          {campaign.sources && campaign.sources.length > 6 && (
            <Chip>+{campaign.sources.length - 6} more</Chip>
          )}
        </div>
        {chips.length > 0 && (
          <>
            <div className="mt-3 flex items-center gap-2">
              <MicroLabel className="text-text-dim">Settings used</MicroLabel>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {chips.map((c) => (
                <Chip key={c}>{c}</Chip>
              ))}
            </div>
          </>
        )}
      </div>

      {/* proof of what went to the model — images included */}
      <AiTraceCard campaign={campaign} />

      {/* editor */}
      <div className="glass mt-4 rounded-panel p-4">
        <MicroLabel className="text-text-dim">Headline</MicroLabel>
        <input
          value={li.headline}
          onChange={(e) => updateDraftContent({ title: e.target.value })}
          className={cn(
            'mt-1.5 w-full rounded-lg border border-border bg-surface-solid px-3 py-2 text-[15px] font-semibold text-text',
            'focus-violet transition-colors',
          )}
        />

        <MicroLabel className="mt-4 block text-text-dim">Body</MicroLabel>
        <textarea
          value={li.body}
          onChange={(e) => updateDraftContent({ body: e.target.value })}
          rows={10}
          className={cn(
            'mt-1.5 w-full resize-y rounded-lg border border-border bg-surface-solid px-3.5 py-3 text-[14px] leading-relaxed text-text',
            'focus-violet transition-colors',
          )}
        />

        {/* the other channels are generated too */}
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border-soft pt-3">
          <MicroLabel className="text-text-dim">Also generated</MicroLabel>
          {CHANNEL_ORDER.filter((k) => k !== 'linkedin').map((k) => (
            <span key={k} className="flex items-center gap-1.5 text-[11.5px] text-text-muted">
              <ChannelIcon kind={k} size={12} /> {CHANNEL_LABEL[k]}
            </span>
          ))}
          <span className="text-[11px] text-text-dim">· refine every channel in Preview</span>
        </div>
      </div>

      {/* live preview */}
      <div className="mt-4">
        <MicroLabel className="text-text-dim">Live preview</MicroLabel>
        <div className="mt-2">
          <LinkedInPost content={li} image={campaign.heroImage} topic={campaign.topic} />
        </div>
      </div>

      {/* actions */}
      <div className="mt-5 flex flex-wrap items-center gap-2.5 border-t border-border-soft pt-4">
        <Button variant="ghost" size="md" onClick={onRegenerate} disabled={busy}>
          {busy ? (
            <>
              <IconSpinner size={15} className="animate-spin" /> Regenerating…
            </>
          ) : (
            <>
              <IconRefresh size={15} /> Regenerate
            </>
          )}
        </Button>
        <span className="text-[11.5px] text-text-dim">
          {busy
            ? 'Re-reading your material with the current settings'
            : 'Uses the latest settings & sources'}
        </span>
        <Button variant="primary" size="md" className="ml-auto" onClick={onContinue} disabled={busy}>
          Continue to Preview <IconArrowRight size={16} />
        </Button>
      </div>
    </div>
  )
}
