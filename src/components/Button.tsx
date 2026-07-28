import { cn } from '../lib/cn'

type Variant = 'primary' | 'ghost' | 'subtle'
type Size = 'sm' | 'md'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  children: React.ReactNode
}

const VARIANT: Record<Variant, string> = {
  // plum fill, warm-white ink — lifts a touch on hover
  primary:
    'text-on-accent bg-purple border border-transparent font-medium hover:bg-purple-bright hover:-translate-y-px hover:shadow-accent disabled:hover:translate-y-0 disabled:hover:shadow-none',
  ghost:
    'text-text-2 bg-transparent border border-border hover:border-border-strong hover:text-text',
  // pale lilac wash, plum ink
  subtle:
    'text-violet bg-purple-soft border border-border hover:border-border-strong hover:-translate-y-px disabled:hover:translate-y-0',
}

const SIZE: Record<Size, string> = {
  sm: 'text-[13px] px-3 py-1.5 gap-1.5 rounded-lg',
  md: 'text-sm px-4 py-2.5 gap-2 rounded-xl',
}

export function Button({
  variant = 'ghost',
  size = 'md',
  className,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center whitespace-nowrap',
        'transition-all duration-[350ms] ease-premium focus-violet',
        'disabled:opacity-40 disabled:cursor-not-allowed',
        VARIANT[variant],
        SIZE[size],
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  )
}
