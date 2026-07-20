import { cn } from '../lib/cn'

interface SegmentedOption<T> {
  value: T
  label: string
}

interface SegmentedProps<T extends string | number> {
  value: T
  onChange: (value: T) => void
  options: SegmentedOption<T>[]
  className?: string
  /** shrink padding for dense rows */
  dense?: boolean
}

/**
 * A compact segmented control — the workhorse for 3–5 option filters.
 * One active segment, violet-tinted; the rest quiet.
 */
export function Segmented<T extends string | number>({
  value,
  onChange,
  options,
  className,
  dense = false,
}: SegmentedProps<T>) {
  return (
    <div
      className={cn(
        'inline-flex flex-wrap gap-1 rounded-lg border border-border bg-[rgba(255,255,255,0.02)] p-1',
        className,
      )}
    >
      {options.map((o) => {
        const active = o.value === value
        return (
          <button
            key={String(o.value)}
            type="button"
            onClick={() => onChange(o.value)}
            aria-pressed={active}
            className={cn(
              'rounded-md border text-[12px] transition-all duration-200 focus-violet',
              dense ? 'px-2 py-0.5' : 'px-2.5 py-1',
              active
                ? 'border-[rgba(170,152,248,0.45)] bg-[rgba(170,152,248,0.16)] text-violet'
                : 'border-transparent text-text-muted hover:text-text',
            )}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
