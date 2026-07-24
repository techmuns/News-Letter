import { cn } from '../lib/cn'

interface MicroLabelProps {
  children: React.ReactNode
  className?: string
  tone?: 'muted' | 'violet' | 'sky'
  as?: 'span' | 'div' | 'p'
}

/** Monospace, uppercase, letter-spaced micro-label (§5.2). */
export function MicroLabel({
  children,
  className,
  tone = 'muted',
  as: Tag = 'span',
}: MicroLabelProps) {
  return (
    <Tag
      className={cn(
        'micro',
        tone === 'violet' && 'micro-violet',
        tone === 'sky' && 'micro-sky',
        className,
      )}
    >
      {children}
    </Tag>
  )
}
