import { cn } from '../lib/cn'

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
  /** violet glow-border treatment for active/selected surfaces (§5.3) */
  active?: boolean
  /** solid elevated fill instead of glass */
  solid?: boolean
  /** interactive affordance (cursor + subtle lift on hover) */
  interactive?: boolean
  className?: string
}

/** The workhorse surface — glass fill, hairline border, 18px radius (§5.3). */
export function Card({
  children,
  active = false,
  solid = false,
  interactive = false,
  className,
  ...rest
}: CardProps) {
  return (
    <div
      className={cn(
        'rounded-card',
        solid ? 'bg-surface-solid border border-border' : 'glass',
        active && 'glow-active',
        interactive &&
          'cursor-pointer transition-all duration-[350ms] ease-premium hover:border-border-strong',
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  )
}
