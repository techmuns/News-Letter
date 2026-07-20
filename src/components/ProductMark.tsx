import { cn } from '../lib/cn'

/** The Munshot Content System wordmark + glowing violet orb mark. */
export function ProductMark({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-3 select-none">
      <span className="relative grid h-9 w-9 shrink-0 place-items-center">
        <span
          className="absolute inset-0 rounded-full"
          style={{
            background:
              'radial-gradient(120% 120% at 30% 25%, #b892ff 0%, #9147f5 42%, #5b2ea8 78%, #2a1650 100%)',
            boxShadow: '0 0 18px rgba(145,71,245,0.5)',
          }}
        />
        <span className="relative h-3 w-3 rounded-full bg-[#0b0807]/85 ring-1 ring-white/25" />
      </span>
      {!compact && (
        <span className="flex flex-col leading-none">
          <span className="font-display text-[16px] font-bold tracking-tight text-text">
            Munshot
          </span>
          <span className={cn('micro micro-violet mt-1.5 text-[9px]')}>Content System</span>
        </span>
      )}
    </div>
  )
}
