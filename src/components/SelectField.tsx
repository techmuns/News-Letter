import { cn } from '../lib/cn'
import { IconChevronRight } from './icons'

interface SelectOption<T> {
  value: T
  label: string
}

interface SelectFieldProps<T extends string> {
  value: T
  onChange: (value: T) => void
  options: SelectOption<T>[]
  id?: string
  className?: string
}

/**
 * Themed native <select> — the clean choice for many-option filters
 * (audience, pillar, format). Native for accessibility; styled to the
 * violet system with a chevron affordance.
 */
export function SelectField<T extends string>({
  value,
  onChange,
  options,
  id,
  className,
}: SelectFieldProps<T>) {
  return (
    <div className={cn('relative', className)}>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className={cn(
          'w-full cursor-pointer appearance-none rounded-lg border border-border bg-[rgba(255,255,255,0.03)]',
          'px-3 py-2 pr-8 text-[13px] text-text transition-colors duration-200',
          'hover:border-border-strong focus-violet',
        )}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value} className="bg-surface-solid text-text">
            {o.label}
          </option>
        ))}
      </select>
      <IconChevronRight
        size={13}
        className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 rotate-90 text-text-dim"
      />
    </div>
  )
}
