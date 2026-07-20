import { MicroLabel } from './MicroLabel'

interface PageHeaderProps {
  eyebrow: string
  title: string
  subtitle?: string
  right?: React.ReactNode
}

/** Consistent space header — mono eyebrow, display title, muted subtitle. */
export function PageHeader({ eyebrow, title, subtitle, right }: PageHeaderProps) {
  return (
    <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <MicroLabel tone="violet">{eyebrow}</MicroLabel>
        <h1 className="mt-2 font-display text-[26px] font-bold leading-tight tracking-tight text-text md:text-[30px]">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-2 max-w-[62ch] text-[14px] leading-relaxed text-text-2">
            {subtitle}
          </p>
        )}
      </div>
      {right && <div className="shrink-0">{right}</div>}
    </div>
  )
}
