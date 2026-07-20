import { cn } from '../../lib/cn'
import {
  type Campaign,
  CHANNEL_ORDER,
  CHANNEL_LABEL,
  statusTone,
  channelApproved,
  campaignNeedsReview,
} from '../../types'
import { useStore } from '../../store/useStore'
import { Card } from '../Card'
import { Button } from '../Button'
import { MicroLabel } from '../MicroLabel'
import { ChannelChips } from '../ChannelChips'
import { StatusDot } from '../StatusDot'
import { SkeletonLines } from '../Skeleton'
import { ChannelIcon, IconCheck } from '../icons'

function ReviewRows({ campaign }: { campaign: Campaign }) {
  const approveChannel = useStore((s) => s.approveChannel)
  return (
    <div className="mt-3 flex flex-col gap-2">
      {CHANNEL_ORDER.map((kind) => {
        const ch = campaign[kind]
        const approved = channelApproved(ch)
        return (
          <div key={kind} className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2">
              <ChannelIcon kind={kind} size={13} className="text-text-muted" />
              <MicroLabel className="text-text-2">{CHANNEL_LABEL[kind]}</MicroLabel>
              <StatusDot tone={statusTone(ch.status)} size={6} />
            </span>
            {approved ? (
              <MicroLabel className="text-green">Ready</MicroLabel>
            ) : (
              <button
                type="button"
                onClick={() => approveChannel(campaign.id, kind)}
                className="rounded-md border border-[rgba(170,152,248,0.4)] bg-[rgba(170,152,248,0.12)] px-2 py-0.5 text-[11px] font-medium text-violet transition-colors hover:bg-[rgba(170,152,248,0.2)]"
              >
                Approve
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}

function CampaignRailCard({ campaign, highlight }: { campaign: Campaign; highlight: boolean }) {
  const approveCampaign = useStore((s) => s.approveCampaign)

  if (campaign.processing) {
    return (
      <Card active className="p-4">
        <div className="flex items-center gap-2">
          <StatusDot tone="pink" pulse size={7} />
          <MicroLabel className="text-pink">Drafting three versions…</MicroLabel>
        </div>
        <SkeletonLines lines={2} className="mt-3" />
      </Card>
    )
  }

  const review = campaignNeedsReview(campaign)

  return (
    <Card
      active={highlight || review}
      className={cn('p-4 transition-all duration-[350ms] ease-premium', highlight && 'animate-fade-up')}
    >
      <p className="line-clamp-2 text-[13.5px] font-semibold leading-snug text-text">
        {campaign.name}
      </p>

      {review ? (
        <>
          <ReviewRows campaign={campaign} />
          <div className="mt-3 flex items-center justify-between gap-2 border-t border-[rgba(255,255,255,0.07)] pt-3">
            <MicroLabel className="text-amber">Needs review</MicroLabel>
            <Button variant="primary" size="sm" onClick={() => approveCampaign(campaign.id)}>
              <IconCheck size={14} /> Approve all
            </Button>
          </div>
        </>
      ) : (
        <div className="mt-3">
          <ChannelChips campaign={campaign} deepLink />
        </div>
      )}
    </Card>
  )
}

export function CampaignsRail({
  campaigns,
  highlightId,
}: {
  campaigns: Campaign[]
  highlightId?: string | null
}) {
  return (
    <div className="flex flex-col gap-3">
      <MicroLabel>Campaigns</MicroLabel>
      {campaigns.length === 0 ? (
        <Card className="p-4">
          <p className="text-[12.5px] leading-relaxed text-text-muted">
            Select items from the pile and turn them into content.
          </p>
        </Card>
      ) : (
        campaigns.map((c) => (
          <CampaignRailCard key={c.id} campaign={c} highlight={c.id === highlightId} />
        ))
      )}
    </div>
  )
}
