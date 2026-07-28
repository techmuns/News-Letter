import { cn } from '../lib/cn'

/** The Munshot Content System wordmark + glowing accent orb mark. */
export function ProductMark({ compact = false }: { compact?: boolean }) {
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
        <span className="relative h-3 w-3 rounded-full bg-rail/85 ring-1 ring-white/25" />
      </span>
      {!compact && (
        <span className="flex flex-col leading-none">
          <span className="font-display text-[16px] font-bold tracking-tight text-text">
            Munshot
          </span>
          <span className={cn('micro micro-sky mt-1.5 text-[9px]')}>Content System</span>
        </span>
      )}
    </div>
  )
}
