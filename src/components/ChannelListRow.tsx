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
  /** when provided, shows a delete control on the row */
  onDelete?: () => void
}

export function ChannelListRow({
  campaign,
  kind,
  active,
  onClick,
  snippet,
  onDelete,
}: ChannelListRowProps) {
  const ch = campaign[kind]
  const date = ch.scheduledDate ? formatDate(ch.scheduledDate) : relativeTime(campaign.createdAt)
  return (
    <Card active={active} interactive onClick={onClick} className="group relative p-4">
      {onDelete && (
        <button
          type="button"
          aria-label={`Delete "${campaign.name}"`}
          title="Delete this draft"
          onClick={(e) => {
            // Never let the delete bubble into the row's select handler.
            e.stopPropagation()
            onDelete()
          }}
          className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-lg text-[15px] leading-none text-text-dim opacity-0 transition-all hover:bg-[rgba(248,113,113,0.12)] hover:text-[#f7a3a3] focus-visible:opacity-100 group-hover:opacity-100"
        >
          ×
        </button>
      )}
      <p className="line-clamp-2 pr-7 text-[14px] font-semibold leading-snug text-text">
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
