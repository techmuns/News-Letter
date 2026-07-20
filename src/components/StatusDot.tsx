import { cn } from '../lib/cn'
import { type StatusTone } from '../types'

const TONE_BG: Record<StatusTone | 'pink', string> = {
  green: 'bg-green',
  amber: 'bg-amber',
  grey: 'bg-grey-dot',
  violet: 'bg-violet',
  pink: 'bg-pink',
}

const TONE_GLOW: Record<StatusTone | 'pink', string> = {
  green: 'shadow-[0_0_8px_rgba(61,220,151,0.7)]',
  amber: 'shadow-[0_0_8px_rgba(245,194,75,0.7)]',
  grey: '',
  violet: 'shadow-[0_0_8px_rgba(157,140,245,0.7)]',
  pink: 'shadow-[0_0_10px_rgba(251,94,126,0.8)]',
}

interface StatusDotProps {
  tone: StatusTone | 'pink'
  pulse?: boolean
  size?: number
  className?: string
}

/** The shared status dot — green/amber/grey/violet, optional pink pulse (§5.4). */
export function StatusDot({ tone, pulse = false, size = 8, className }: StatusDotProps) {
  return (
    <span
      className={cn(
        'inline-block rounded-full shrink-0',
        TONE_BG[tone],
        tone !== 'grey' && TONE_GLOW[tone],
        pulse && 'animate-pulse-pink',
        className,
      )}
      style={{ width: size, height: size }}
    />
  )
}
