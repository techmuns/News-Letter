import { formatDate, relativeTime } from '../lib/date'
import { type Campaign, type ChannelKind } from '../types'
import { Card } from './Card'
import { MicroLabel } from './MicroLabel'
import { StatusChip } from './StatusChip'

interface ChannelListRowProps {
  campaign: Campaign
  kind: ChannelKind
  active: boolean
  onClick: () => void
  /** short one-line subtitle of the channel content */
  snippet: string
}

export function ChannelListRow({ campaign, kind, active, onClick, snippet }: ChannelListRowProps) {
  const ch = campaign[kind]
  const date = ch.scheduledDate ? formatDate(ch.scheduledDate) : relativeTime(campaign.createdAt)
  return (
    <Card active={active} interactive onClick={onClick} className="p-4">
      <p className="line-clamp-2 text-[14px] font-semibold leading-snug text-text">
        {campaign.name}
      </p>
      <p className="mt-1 line-clamp-1 text-[12.5px] text-text-muted">{snippet}</p>
      <div className="mt-3 flex items-center justify-between gap-2">
        <StatusChip status={ch.status} />
        <MicroLabel className="text-[9.5px]">{date}</MicroLabel>
      </div>
    </Card>
  )
}
