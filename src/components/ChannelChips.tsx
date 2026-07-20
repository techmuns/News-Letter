import { useNavigate } from 'react-router-dom'
import { cn } from '../lib/cn'
import { channelPath } from '../lib/routes'
import { type Campaign, CHANNEL_ORDER, CHANNEL_LABEL, statusTone } from '../types'
import { ChannelIcon } from './icons'
import { StatusDot } from './StatusDot'

interface ChannelChipsProps {
  campaign: Campaign
  /** clicking a channel deep-links into that space */
  deepLink?: boolean
  className?: string
}

/**
 * Compact, borderless indicator of the three linked channel versions and
 * their statuses — the one place the master → 3-channel progress is shown.
 */
export function ChannelChips({ campaign, deepLink = false, className }: ChannelChipsProps) {
  const navigate = useNavigate()

  return (
    <div className={cn('flex items-center gap-3', className)}>
      {CHANNEL_ORDER.map((kind) => {
        const ch = campaign[kind]
        return (
          <button
            key={kind}
            type="button"
            disabled={!deepLink}
            onClick={
              deepLink
                ? (e) => {
                    e.stopPropagation()
                    navigate(channelPath(kind, campaign.id))
                  }
                : undefined
            }
            title={`${CHANNEL_LABEL[kind]} · ${ch.status}`}
            className={cn(
              'inline-flex items-center gap-1.5',
              deepLink ? 'cursor-pointer hover:opacity-100' : 'cursor-default',
              deepLink && 'opacity-80',
            )}
          >
            <ChannelIcon kind={kind} size={13} className="text-text-muted" />
            <StatusDot tone={statusTone(ch.status)} size={6} />
          </button>
        )
      })}
    </div>
  )
}
