import { useEffect, useRef } from 'react'
import { cn } from '../../lib/cn'
import { MicroLabel } from '../MicroLabel'

const BASE = cn(
  'w-full rounded-xl border border-border bg-[rgba(255,255,255,0.02)] px-3.5 py-2.5',
  'text-[14px] leading-relaxed text-text placeholder:text-text-dim',
  'focus-violet transition-all duration-[350ms] ease-premium',
)

interface FieldProps {
  label: string
  value: string
  onChange: (next: string) => void
  placeholder?: string
  /** Renders a growing textarea instead of a single-line input. */
  multiline?: boolean
  /** Starting height for a multiline field. */
  minRows?: number
  hint?: string
}

/** A labelled text field. Multiline variants grow to fit their content. */
export function Field({
  label,
  value,
  onChange,
  placeholder,
  multiline,
  minRows = 3,
  hint,
}: FieldProps) {
  const ref = useRef<HTMLTextAreaElement>(null)

  // Grow to fit — re-measured whenever the value changes from any source.
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [value, multiline])

  return (
    <label className="block">
      <span className="mb-1.5 flex items-baseline justify-between gap-3">
        <MicroLabel>{label}</MicroLabel>
        {hint && <span className="micro text-text-dim">{hint}</span>}
      </span>
      {multiline ? (
        <textarea
          ref={ref}
          value={value}
          rows={minRows}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className={cn(BASE, 'resize-none overflow-hidden')}
        />
      ) : (
        <input
          type="text"
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className={BASE}
        />
      )}
    </label>
  )
}

/** Numeric variant for small integers (read minutes). */
export function NumberField({
  label,
  value,
  onChange,
  min = 1,
  max = 60,
}: {
  label: string
  value: number
  onChange: (next: number) => void
  min?: number
  max?: number
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block">
        <MicroLabel>{label}</MicroLabel>
      </span>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        onChange={(e) => {
          const n = Number.parseInt(e.target.value, 10)
          if (!Number.isNaN(n)) onChange(Math.min(max, Math.max(min, n)))
        }}
        className={cn(BASE, 'max-w-[110px]')}
      />
    </label>
  )
}
