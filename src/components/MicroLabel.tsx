import { cn } from '../lib/cn'

interface MicroLabelProps {
  children: React.ReactNode
  className?: string
  tone?: 'muted' | 'violet'
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
    <Tag className={cn('micro', tone === 'violet' && 'micro-violet', className)}>
      {children}
    </Tag>
  )
}
