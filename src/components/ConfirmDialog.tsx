import { useEffect } from 'react'
import { Button } from './Button'
import { MicroLabel } from './MicroLabel'

interface ConfirmDialogProps {
  open: boolean
  title: string
  body: string
  confirmLabel?: string
  cancelLabel?: string
  tone?: 'violet' | 'amber'
  onConfirm: () => void
  onCancel: () => void
}

/** A small, styled confirm modal — used to protect manual edits (§4). */
export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'violet',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onCancel])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-[rgba(6,5,12,0.72)] p-4 backdrop-blur-sm animate-fade-up"
      onClick={onCancel}
    >
      <div
        className="glow-active w-full max-w-[420px] rounded-panel p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <MicroLabel className={tone === 'amber' ? 'text-amber' : 'micro-violet'}>
          {tone === 'amber' ? 'Heads up' : 'Confirm'}
        </MicroLabel>
        <h3 className="mt-2 font-display text-[18px] font-bold text-text">{title}</h3>
        <p className="mt-2 text-[13.5px] leading-relaxed text-text-2">{body}</p>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button variant="primary" size="sm" onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}
