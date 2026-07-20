import { MicroLabel } from './MicroLabel'

interface RangeSliderProps<T extends string> {
  /** ordered values, low → high (drives slider position) */
  order: readonly T[]
  value: T
  onChange: (value: T) => void
  leftLabel: string
  rightLabel: string
  ariaLabel: string
}

/**
 * A themed slider bound to an ordered set of enum values. The dropdown above
 * it and this slider share the same underlying field, so they stay in sync —
 * the slider is a second, tactile way to pick the same real setting.
 */
export function RangeSlider<T extends string>({
  order,
  value,
  onChange,
  leftLabel,
  rightLabel,
  ariaLabel,
}: RangeSliderProps<T>) {
  const max = Math.max(order.length - 1, 1)
  const idx = Math.max(0, order.indexOf(value))
  const pct = (idx / max) * 100

  return (
    <div className="flex flex-col gap-2">
      <input
        type="range"
        className="range-violet"
        min={0}
        max={max}
        step={1}
        value={idx}
        aria-label={ariaLabel}
        onChange={(e) => onChange(order[Number(e.target.value)])}
        style={{
          background: `linear-gradient(90deg, var(--purple) 0%, var(--purple-bright) ${pct}%, var(--border) ${pct}%, var(--border) 100%)`,
        }}
      />
      <div className="flex items-center justify-between">
        <MicroLabel className="text-[9.5px] text-text-dim">{leftLabel}</MicroLabel>
        <MicroLabel className="text-[9.5px] text-text-dim">{rightLabel}</MicroLabel>
      </div>
    </div>
  )
}
