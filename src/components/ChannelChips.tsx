import { useNavigate } from 'react-router-dom'
import { cn } from '../lib/cn'
import { channelPath } from '../lib/routes'
import {
  type Campaign,
  CHANNEL_ORDER,
  CHANNEL_LABEL,
  statusTone,
} from '../types'
import { ChannelIcon } from './icons'
import { StatusDot } from './StatusDot'

interface ChannelChipsProps {
  campaign: Campaign
  /** clicking a chip deep-links into that channel space */
  deepLink?: boolean
  /** compact = icon + status dot only; full = icon + label + status */
  variant?: 'compact' | 'full'
  className?: string
}

/**
 * Surfaces the master → 3-channel relationship: one chip per channel
 * version with its own independent status dot (§4).
 */
export function ChannelChips({
  campaign,
  deepLink = false,
  variant = 'compact',
  className,
}: ChannelChipsProps) {
  const navigate = useNavigate()

  return (
    <div className={cn('flex items-center gap-1.5', className)}>
      {CHANNEL_ORDER.map((kind) => {
        const ch = campaign[kind]
        const tone = statusTone(ch.status)
        const interactive = deepLink
        return (
          <button
            key={kind}
            type="button"
            disabled={!interactive}
            onClick={
              interactive
                ? (e) => {
                    e.stopPropagation()
                    navigate(channelPath(kind, campaign.id))
                  }
                : undefined
            }
            title={`${CHANNEL_LABEL[kind]} · ${ch.status}${ch.edited ? ' · edited' : ''}`}
            className={cn(
              'group inline-flex items-center gap-1.5 rounded-full border border-border px-2 py-1',
              'transition-all duration-[350ms] ease-premium',
              interactive && 'hover:border-border-strong focus-violet cursor-pointer',
              !interactive && 'cursor-default',
            )}
          >
            <ChannelIcon kind={kind} size={13} className="text-text-2" />
            {variant === 'full' && (
              <span className="micro text-text-muted">{CHANNEL_LABEL[kind]}</span>
            )}
            <StatusDot tone={tone} size={6} />
            {ch.edited && (
              <span
                className="h-1 w-1 rounded-full bg-violet"
                title="manually edited"
                aria-label="manually edited"
              />
            )}
          </button>
        )
      })}
    </div>
  )
}
