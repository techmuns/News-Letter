import { type ChannelKind } from '../types'

interface IconProps {
  size?: number
  className?: string
  strokeWidth?: number
}

const base = (size: number, className?: string) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  className,
})

export function IconWorkspace({ size = 18, className, strokeWidth = 1.6 }: IconProps) {
  return (
    <svg {...base(size, className)} strokeWidth={strokeWidth}>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  )
}

export function IconLinkedIn({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5ZM3 9h4v12H3V9Zm6 0h3.8v1.7h.05c.53-1 1.83-2.05 3.77-2.05 4.03 0 4.78 2.65 4.78 6.1V21h-4v-5.3c0-1.26-.02-2.9-1.77-2.9-1.77 0-2.04 1.38-2.04 2.8V21H9V9Z" />
    </svg>
  )
}

export function IconEmail({ size = 18, className, strokeWidth = 1.6 }: IconProps) {
  return (
    <svg {...base(size, className)} strokeWidth={strokeWidth}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3.5 7 8.5 6 8.5-6" />
    </svg>
  )
}

export function IconArticle({ size = 18, className, strokeWidth = 1.6 }: IconProps) {
  return (
    <svg {...base(size, className)} strokeWidth={strokeWidth}>
      <path d="M6 3h9l4 4v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" />
      <path d="M14 3v5h5M8.5 13h7M8.5 17h7M8.5 9h3" />
    </svg>
  )
}

export function IconPdf({ size = 18, className, strokeWidth = 1.6 }: IconProps) {
  return (
    <svg {...base(size, className)} strokeWidth={strokeWidth}>
      <path d="M7 3h7l4 4v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" />
      <path d="M13 3v5h5" />
      <path d="M9 13h1.2a1.3 1.3 0 0 1 0 2.6H9V13Zm0 2.6V18" />
    </svg>
  )
}

export function IconScreenshot({ size = 18, className, strokeWidth = 1.6 }: IconProps) {
  return (
    <svg {...base(size, className)} strokeWidth={strokeWidth}>
      <rect x="3" y="4" width="18" height="15" rx="2" />
      <circle cx="9" cy="10" r="1.6" />
      <path d="m4 17 4.5-4 3 2.5L15 12l5 4.5" />
    </svg>
  )
}

export function IconNote({ size = 18, className, strokeWidth = 1.6 }: IconProps) {
  return (
    <svg {...base(size, className)} strokeWidth={strokeWidth}>
      <path d="M5 4h14a1 1 0 0 1 1 1v10l-5 5H6a1 1 0 0 1-1-1V4Z" />
      <path d="M20 15h-5v5M8.5 9h7M8.5 12.5h4" />
    </svg>
  )
}

export function IconPlus({ size = 18, className, strokeWidth = 1.8 }: IconProps) {
  return (
    <svg {...base(size, className)} strokeWidth={strokeWidth}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}

export function IconSparkle({ size = 18, className, strokeWidth = 1.6 }: IconProps) {
  return (
    <svg {...base(size, className)} strokeWidth={strokeWidth}>
      <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z" />
      <path d="M19 15l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7.7-2Z" />
    </svg>
  )
}

export function IconEye({ size = 18, className, strokeWidth = 1.6 }: IconProps) {
  return (
    <svg {...base(size, className)} strokeWidth={strokeWidth}>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

export function IconCalendar({ size = 18, className, strokeWidth = 1.6 }: IconProps) {
  return (
    <svg {...base(size, className)} strokeWidth={strokeWidth}>
      <rect x="3" y="4.5" width="18" height="16" rx="2" />
      <path d="M3 9h18M8 3v3M16 3v3" />
    </svg>
  )
}

export function IconClock({ size = 18, className, strokeWidth = 1.6 }: IconProps) {
  return (
    <svg {...base(size, className)} strokeWidth={strokeWidth}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  )
}

export function IconClose({ size = 18, className, strokeWidth = 1.8 }: IconProps) {
  return (
    <svg {...base(size, className)} strokeWidth={strokeWidth}>
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  )
}

export function IconCheck({ size = 18, className, strokeWidth = 2 }: IconProps) {
  return (
    <svg {...base(size, className)} strokeWidth={strokeWidth}>
      <path d="M4 12.5 9 17.5 20 6.5" />
    </svg>
  )
}

export function IconChevronRight({ size = 18, className, strokeWidth = 1.8 }: IconProps) {
  return (
    <svg {...base(size, className)} strokeWidth={strokeWidth}>
      <path d="m9 5 7 7-7 7" />
    </svg>
  )
}

export function IconArrowRight({ size = 18, className, strokeWidth = 1.7 }: IconProps) {
  return (
    <svg {...base(size, className)} strokeWidth={strokeWidth}>
      <path d="M4 12h15M13 6l6 6-6 6" />
    </svg>
  )
}

/** Icon for a channel kind. */
export function ChannelIcon({ kind, ...props }: { kind: ChannelKind } & IconProps) {
  if (kind === 'linkedin') return <IconLinkedIn {...props} />
  if (kind === 'email') return <IconEmail {...props} />
  return <IconArticle {...props} />
}
