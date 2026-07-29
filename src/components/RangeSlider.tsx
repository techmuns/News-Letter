import { MicroLabel } from './MicroLabel'

interface RangeOption<T> {
  value: T
  label: string
}

interface RangeSliderProps<T extends string> {
  /** the ordered choices, low → high (drives slider position) */
  options: RangeOption<T>[]
  value: T
  onChange: (value: T) => void
  leftLabel: string
  rightLabel: string
  ariaLabel: string
}

/**
 * A themed slider bound to an ordered set of enum values. It names the choice
 * it is currently on, so the scale is the whole control — no dropdown has to
 * repeat the same setting underneath it.
 */
export function RangeSlider<T extends string>({
  options,
  value,
  onChange,
  leftLabel,
  rightLabel,
  ariaLabel,
}: RangeSliderProps<T>) {
  const max = Math.max(options.length - 1, 1)
  const idx = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  )
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
        aria-valuetext={options[idx]?.label}
        onChange={(e) => onChange(options[Number(e.target.value)].value)}
        style={{
          // filled portion runs plum → lilac; the rest stays a muted track
          background: `linear-gradient(90deg, var(--plum) 0%, var(--lilac) ${pct}%, var(--surface-hover) ${pct}%, var(--surface-hover) 100%)`,
        }}
      />
      <div className="flex items-center justify-between gap-2">
        <MicroLabel className="text-[9.5px] text-text-dim">{leftLabel}</MicroLabel>
        <span className="text-[11.5px] font-medium text-violet">{options[idx]?.label}</span>
        <MicroLabel className="text-[9.5px] text-text-dim">{rightLabel}</MicroLabel>
      </div>
    </div>
  )
}
