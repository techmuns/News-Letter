import { cn } from '../lib/cn'

/** The Munshot Content System wordmark + glowing ring mark. */
export function ProductMark({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5 select-none">
      <span className="relative grid h-8 w-8 place-items-center shrink-0">
        <span className="absolute inset-0 rounded-lg border border-glow shadow-glow" />
        <span className="h-2.5 w-2.5 rounded-full bg-violet shadow-[0_0_10px_rgba(157,140,245,0.9)]" />
      </span>
      {!compact && (
        <span className="flex flex-col leading-none">
          <span className="font-display font-bold tracking-tight text-[15px] text-text">
            Munshot
          </span>
          <span className={cn('micro micro-violet mt-1')}>Content System</span>
        </span>
      )}
    </div>
  )
}
