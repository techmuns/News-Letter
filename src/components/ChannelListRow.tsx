import { cn } from '../lib/cn'
import { formatDate, relativeTime } from '../lib/date'
import { type Campaign, type ChannelKind } from '../types'
import { Card } from './Card'
import { MicroLabel } from './MicroLabel'
import { StatusChip } from './StatusChip'
import { ChannelChips } from './ChannelChips'

interface ChannelListRowProps {
  campaign: Campaign
  kind: ChannelKind
  active: boolean
  onClick: () => void
  /** short one-line snippet of the channel content */
  snippet: string
}

export function ChannelListRow({ campaign, kind, active, onClick, snippet }: ChannelListRowProps) {
  const ch = campaign[kind]
  return (
    <Card active={active} interactive onClick={onClick} className="p-4">
      <div className="flex items-center justify-between gap-2">
        <MicroLabel className="micro-violet line-clamp-1">{campaign.topic}</MicroLabel>
        <MicroLabel className="shrink-0 text-[9.5px]">
          {ch.scheduledDate ? formatDate(ch.scheduledDate) : relativeTime(campaign.createdAt)}
        </MicroLabel>
      </div>
      <p className="mt-1.5 line-clamp-2 text-[14px] font-semibold leading-snug text-text">
        {campaign.name}
      </p>
      <p className="mt-1 line-clamp-1 text-[12px] text-text-muted">{snippet}</p>
      <div className="mt-3 flex items-center justify-between gap-2">
        <StatusChip status={ch.status} />
        <ChannelChips campaign={campaign} className={cn(active && 'opacity-100')} />
      </div>
    </Card>
  )
}
