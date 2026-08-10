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
        solid
          ? 'bg-surface-solid border border-border shadow-[0_18px_46px_-24px_rgba(0,0,0,0.75),0_0_40px_-18px_rgba(224,60,140,0.14)]'
          : 'glass shadow-[0_20px_50px_-24px_rgba(0,0,0,0.75),0_0_40px_-16px_rgba(224,60,140,0.14)]',
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
