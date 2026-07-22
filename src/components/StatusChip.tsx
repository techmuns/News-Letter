import { cn } from '../lib/cn'
import { type ChannelStatus, statusTone } from '../types'
import { StatusDot } from './StatusDot'

const TEXT_TONE = {
  green: 'text-green',
  amber: 'text-amber',
  grey: 'text-text-muted',
  violet: 'text-violet',
  red: 'text-red',
} as const

interface StatusChipProps {
  status: ChannelStatus
  className?: string
  /** show as a bordered pill rather than plain dot+text */
  pill?: boolean
}

/** Dot + status label, using the shared status language (§5.4). */
export function StatusChip({ status, className, pill = false }: StatusChipProps) {
  const tone = statusTone(status)
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap',
        pill && 'rounded-full border border-border px-2.5 py-1',
        className,
      )}
    >
      <StatusDot tone={tone} size={7} />
      <span className={cn('micro', TEXT_TONE[tone])}>{status}</span>
    </span>
  )
}
