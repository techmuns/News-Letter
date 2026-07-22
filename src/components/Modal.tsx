import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '../lib/cn'
import { MicroLabel } from './MicroLabel'
import { IconClose } from './icons'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  footer?: React.ReactNode
  className?: string
}

/** Portal modal — backdrop, escape/click-out to close, sticky header + footer. */
export function Modal({ open, onClose, title, children, footer, className }: ModalProps) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
      <div
        className="absolute inset-0 bg-[rgba(0,0,0,0.62)] backdrop-blur-[2px] animate-fade-up"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          'relative z-10 flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-panel border border-border-strong bg-surface-solid shadow-[0_18px_60px_-12px_rgba(0,0,0,0.7)] sm:rounded-panel',
          'sm:max-w-[560px]',
          className,
        )}
      >
        <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3.5">
          <MicroLabel className="text-text-2">{title}</MicroLabel>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid h-7 w-7 place-items-center rounded-lg text-text-muted transition-colors hover:bg-surface-hover hover:text-text"
          >
            <IconClose size={16} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-5">{children}</div>
        {footer && <div className="border-t border-border px-5 py-3.5">{footer}</div>}
      </div>
    </div>,
    document.body,
  )
}
