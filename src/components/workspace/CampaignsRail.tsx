import { cn } from '../../lib/cn'
import { relativeTime } from '../../lib/date'
import { type Campaign } from '../../types'
import { Card } from '../Card'
import { MicroLabel } from '../MicroLabel'
import { ChannelChips } from '../ChannelChips'
import { StatusDot } from '../StatusDot'
import { SkeletonLines } from '../Skeleton'

function CampaignRailCard({ campaign, highlight }: { campaign: Campaign; highlight: boolean }) {
  if (campaign.processing) {
    return (
      <Card active className="p-4">
        <div className="flex items-center gap-2">
          <StatusDot tone="pink" pulse size={8} />
          <MicroLabel className="text-pink">Generating 3 channel drafts…</MicroLabel>
        </div>
        <p className="mt-3 line-clamp-1 text-[13.5px] font-medium text-text-2">{campaign.name}</p>
        <SkeletonLines lines={3} className="mt-3" />
      </Card>
    )
  }

  return (
    <Card
      active={highlight}
      className={cn('p-4 transition-all duration-[350ms] ease-premium', highlight && 'animate-fade-up')}
    >
      <div className="flex items-center justify-between gap-2">
        <MicroLabel className="micro-violet line-clamp-1">{campaign.topic}</MicroLabel>
        <MicroLabel className="shrink-0 text-[9.5px]">{relativeTime(campaign.createdAt)}</MicroLabel>
      </div>
      <p className="mt-2 line-clamp-2 text-[13.5px] font-semibold leading-snug text-text">
        {campaign.name}
      </p>
      <div className="mt-3">
        <ChannelChips campaign={campaign} deepLink variant="full" />
      </div>
      {campaign.promo && (
        <div className="mt-3 flex items-center gap-2 border-t border-[rgba(255,255,255,0.06)] pt-3">
          <span className="h-1.5 w-1.5 rounded-full bg-violet-dim" />
          <span className="text-[11px] text-text-muted">
            Promotes <span className="text-text-2">{campaign.promo.name}</span>
          </span>
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
      <div className="flex items-center justify-between">
        <MicroLabel>Campaigns in progress</MicroLabel>
        <MicroLabel className="text-text-dim">{campaigns.length}</MicroLabel>
      </div>
      {campaigns.length === 0 ? (
        <Card className="p-4">
          <p className="text-[12.5px] leading-relaxed text-text-muted">
            No campaigns yet. Select items from the pile and turn them into content.
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
