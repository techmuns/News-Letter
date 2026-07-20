import { useEffect, useRef, useState } from 'react'
import { cn } from '../lib/cn'

interface MenuProps {
  trigger: React.ReactNode
  children: (close: () => void) => React.ReactNode
  align?: 'left' | 'right'
  className?: string
}

/** Click-based popover (no hover dependence, §5.6). */
export function Menu({ trigger, children, align = 'left', className }: MenuProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} className="block">
        {trigger}
      </button>
      {open && (
        <div
          className={cn(
            'absolute z-40 mt-2 min-w-[190px] rounded-xl border border-border-strong bg-surface-solid p-1.5',
            'shadow-glow-soft backdrop-blur-glass animate-fade-up',
            align === 'right' ? 'right-0' : 'left-0',
            className,
          )}
        >
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  )
}

export function MenuItem({
  children,
  onClick,
  active = false,
}: {
  children: React.ReactNode
  onClick: () => void
  active?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[13px]',
        'transition-colors duration-200',
        active ? 'text-violet bg-[rgba(157,140,245,0.08)]' : 'text-text-2 hover:bg-[rgba(255,255,255,0.04)] hover:text-text',
      )}
    >
      {children}
    </button>
  )
}
