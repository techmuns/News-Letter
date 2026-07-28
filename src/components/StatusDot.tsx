import { cn } from '../lib/cn'
import { type StatusTone } from '../types'

const TONE_BG: Record<StatusTone | 'pink', string> = {
  green: 'bg-green',
  amber: 'bg-amber',
  grey: 'bg-grey-dot',
  violet: 'bg-violet',
  red: 'bg-red',
  pink: 'bg-pink',
}

const TONE_GLOW: Record<StatusTone | 'pink', string> = {
  green: 'shadow-[0_0_6px_var(--glow-green)]',
  amber: 'shadow-[0_0_6px_var(--glow-amber)]',
  grey: '',
  violet: 'shadow-[0_0_6px_var(--glow)]',
  red: 'shadow-[0_0_6px_var(--glow-red)]',
  pink: 'shadow-[0_0_8px_var(--glow-pink)]',
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
