import { cn } from '../lib/cn'
import { IconChevronRight } from './icons'

interface SelectOption<T> {
  value: T
  label: string
}

/** A named category — rendered as a heading its options sit under. */
interface SelectGroup<T> {
  label: string
  options: SelectOption<T>[]
}

type SelectEntry<T> = SelectOption<T> | SelectGroup<T>

function isGroup<T>(entry: SelectEntry<T>): entry is SelectGroup<T> {
  return 'options' in entry
}

interface SelectFieldProps<T extends string> {
  value: T
  onChange: (value: T) => void
  /** a flat list, or categories the options are grouped under */
  options: SelectEntry<T>[]
  id?: string
  className?: string
}

/**
 * Themed native <select> — the clean choice for many-option filters
 * (audience, pillar, format). Native for accessibility; styled to the
 * plum system with a chevron affordance. A long list reads faster when
 * it is categorised, so entries may be groups as well as options.
 */
export function SelectField<T extends string>({
  value,
  onChange,
  options,
  id,
  className,
}: SelectFieldProps<T>) {
  const option = (o: SelectOption<T>) => (
    <option key={o.value} value={o.value} className="bg-surface-solid text-text">
      {o.label}
    </option>
  )

  return (
    <div className={cn('relative', className)}>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className={cn(
          'w-full cursor-pointer appearance-none rounded-lg border border-border bg-surface-solid',
          'px-3 py-2 pr-8 text-[13px] text-text transition-colors duration-200',
          'hover:border-border-strong focus-violet',
        )}
      >
        {options.map((entry) =>
          isGroup(entry) ? (
            <optgroup key={entry.label} label={entry.label} className="bg-surface-solid text-text-muted">
              {entry.options.map(option)}
            </optgroup>
          ) : (
            option(entry)
          ),
        )}
      </select>
      <IconChevronRight
        size={13}
        className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 rotate-90 text-text-dim"
      />
    </div>
  )
}
