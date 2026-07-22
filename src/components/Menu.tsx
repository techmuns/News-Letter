import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '../lib/cn'

interface MenuProps {
  trigger: React.ReactNode
  children: (close: () => void) => React.ReactNode
  align?: 'left' | 'right'
  className?: string
}

/** Click-based popover (no hover dependence, §5.6). Rendered in a portal so it
    escapes the backdrop-filter stacking contexts of glass cards it sits inside. */
export function Menu({ trigger, children, align = 'left', className }: MenuProps) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [coords, setCoords] = useState<{ top: number; left?: number; right?: number }>({ top: 0 })

  useLayoutEffect(() => {
    if (!open || !wrapRef.current) return
    const r = wrapRef.current.getBoundingClientRect()
    const top = r.bottom + 8
    setCoords(
      align === 'right'
        ? { top, right: Math.max(8, window.innerWidth - r.right) }
        : { top, left: r.left },
    )
  }, [open, align])

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node
      if (wrapRef.current?.contains(t) || menuRef.current?.contains(t)) return
      setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    const onScroll = () => setOpen(false)
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onScroll)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onScroll)
    }
  }, [open])

  return (
    <div ref={wrapRef} className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} className="block">
        {trigger}
      </button>
      {open &&
        createPortal(
          <div
            ref={menuRef}
            style={{
              position: 'fixed',
              top: coords.top,
              left: coords.left,
              right: coords.right,
              zIndex: 60,
            }}
            className={cn(
              'max-h-[70vh] min-w-[190px] overflow-y-auto rounded-xl border border-border-strong bg-surface-solid p-1.5',
              'shadow-glow-soft backdrop-blur-glass animate-fade-up',
              className,
            )}
          >
            {children(() => setOpen(false))}
          </div>,
          document.body,
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
