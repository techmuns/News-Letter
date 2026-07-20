import { cn } from '../../lib/cn'
import { type Campaign } from '../../types'
import { useStore } from '../../store/useStore'
import { Card } from '../Card'
import { Button } from '../Button'
import { MicroLabel } from '../MicroLabel'
import { ChannelChips } from '../ChannelChips'
import { StatusDot } from '../StatusDot'
import { SkeletonLines } from '../Skeleton'
import { IconCheck } from '../icons'

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

  const needsReview = !campaign.approved

  return (
    <Card
      active={highlight || needsReview}
      className={cn('p-4 transition-all duration-[350ms] ease-premium', highlight && 'animate-fade-up')}
    >
      <p className="line-clamp-2 text-[13.5px] font-semibold leading-snug text-text">
        {campaign.name}
      </p>
      <div className="mt-3">
        <ChannelChips campaign={campaign} deepLink={campaign.approved} />
      </div>

      {needsReview && (
        <div className="mt-3 flex items-center justify-between gap-2 border-t border-[rgba(255,255,255,0.07)] pt-3">
          <MicroLabel className="text-amber">Needs review</MicroLabel>
          <Button variant="primary" size="sm" onClick={() => approveCampaign(campaign.id)}>
            <IconCheck size={14} /> Approve
          </Button>
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
