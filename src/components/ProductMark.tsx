import { cn } from '../lib/cn'

/**
 * The Munshot Content System wordmark + accent orb.
 * `onRail` renders it for the plum sidebar, where the lockup is warm white
 * with a lilac sub-label instead of page ink.
 */
export function ProductMark({
  compact = false,
  onRail = false,
}: {
  compact?: boolean
  onRail?: boolean
}) {
  return (
    <div className="flex items-center gap-3 select-none">
      <span className="relative grid h-9 w-9 shrink-0 place-items-center">
        <span
          className="absolute inset-0 rounded-full"
          style={{
            background: 'var(--orb-gradient)',
            boxShadow: '0 0 18px var(--orb-glow)',
          }}
        />
        <span
          className={cn(
            'relative h-3 w-3 rounded-full ring-1',
            onRail ? 'bg-[color:var(--plum)] ring-white/25' : 'bg-bg/80 ring-white/20',
          )}
        />
      </span>
      {!compact && (
        <span className="flex flex-col leading-none">
          <span
            className={cn(
              'font-display text-[16px] font-bold tracking-tight',
              onRail ? 'text-rail-text' : 'text-text',
            )}
          >
            Munshot
          </span>
          <span
            className={cn('micro mt-1.5 text-[9px]', onRail ? 'text-rail-accent' : 'micro-violet')}
          >
            Content System
          </span>
        </span>
      )}
    </div>
  )
}
