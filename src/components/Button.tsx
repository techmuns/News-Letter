import { cn } from '../lib/cn'

type Variant = 'primary' | 'ghost' | 'subtle'
type Size = 'sm' | 'md'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  children: React.ReactNode
}

const VARIANT: Record<Variant, string> = {
  primary:
    'text-white bg-purple border border-transparent hover:brightness-110 shadow-[0_6px_20px_-8px_rgba(145,71,245,0.65)] font-medium',
  ghost:
    'text-text-2 bg-transparent border border-border hover:border-border-strong hover:text-text',
  subtle:
    'text-violet bg-purple-soft border border-[rgba(145,71,245,0.28)] hover:bg-[rgba(145,71,245,0.24)]',
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
