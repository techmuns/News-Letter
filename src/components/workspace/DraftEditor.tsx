import { cn } from '../../lib/cn'
import { useStore } from '../../store/useStore'
import { type Campaign, CHANNEL_ORDER, CHANNEL_LABEL } from '../../types'
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
  IconUpload,
} from '../icons'

interface DraftEditorProps {
  campaign: Campaign
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

/**
 * The Workspace's create-and-refine surface. Shows the generated draft as
 * editable copy with a live LinkedIn preview, the sources + settings it came
 * from, a Regenerate that responds to the latest settings, and the primary
 * "Continue to Preview" once the author is satisfied.
 */
export function DraftEditor({ campaign, onRegenerate, onContinue, onDiscard }: DraftEditorProps) {
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
      <div className="mt-4 rounded-xl border border-border bg-surface p-3.5">
        <div className="flex items-center gap-2">
          {auto ? (
            <IconSparkle size={13} className="text-violet" />
          ) : (
            <IconUpload size={13} className="text-violet" />
          )}
          <MicroLabel className="text-text-dim">
            {auto ? 'Automatic generator' : 'Manual upload'} · sources
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

      {/* editor */}
      <div className="mt-4 rounded-panel border border-border bg-surface p-4 shadow-panel">
        <MicroLabel className="text-text-dim">Headline</MicroLabel>
        <input
          value={li.headline}
          onChange={(e) => updateDraftContent({ title: e.target.value })}
          className={cn(
            'mt-1.5 w-full rounded-lg border border-border bg-bg px-3 py-2 text-[15px] font-semibold text-text',
            'focus-violet transition-colors',
          )}
        />

        <MicroLabel className="mt-4 block text-text-dim">Body</MicroLabel>
        <textarea
          value={li.body}
          onChange={(e) => updateDraftContent({ body: e.target.value })}
          rows={10}
          className={cn(
            'mt-1.5 w-full resize-y rounded-lg border border-border bg-bg px-3.5 py-3 text-[14px] leading-relaxed text-text',
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
        <Button variant="ghost" size="md" onClick={onRegenerate}>
          <IconRefresh size={15} /> Regenerate
        </Button>
        <span className="text-[11.5px] text-text-dim">Uses the latest settings &amp; sources</span>
        <Button variant="primary" size="md" className="ml-auto" onClick={onContinue}>
          Continue to Preview <IconArrowRight size={16} />
        </Button>
      </div>
    </div>
  )
}
