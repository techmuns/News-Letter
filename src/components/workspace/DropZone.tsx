import { useRef, useState } from 'react'
import { cn } from '../../lib/cn'
import { useStore } from '../../store/useStore'
import { Button } from '../Button'
import { MicroLabel } from '../MicroLabel'
import { IconPlus, IconNote, IconClose } from '../icons'

/**
 * The drop zone at the top of the Workspace: real file ingest + a quick
 * text-note input. Files are stored locally (IndexedDB) and only leave the
 * browser when you press "Turn into content".
 */
export function DropZone() {
  const addFiles = useStore((s) => s.addFiles)
  const addNote = useStore((s) => s.addNote)
  const [dragging, setDragging] = useState(false)
  const [note, setNote] = useState('')
  const [flash, setFlash] = useState<string | null>(null)
  const [rejected, setRejected] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  function flashMsg(msg: string) {
    setFlash(msg)
    window.setTimeout(() => setFlash(null), 2200)
  }

  async function ingest(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return
    setBusy(true)
    setRejected([])
    try {
      const files = Array.from(fileList)
      const problems = await addFiles(files)
      setRejected(problems)
      const added = files.length - problems.length
      if (added > 0) flashMsg(`Added ${added} item${added > 1 ? 's' : ''} to the pile`)
    } finally {
      setBusy(false)
    }
  }

  function submitNote() {
    const text = note.trim()
    if (!text) return
    addNote(text)
    setNote('')
    flashMsg('Note dropped into the pile')
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault()
        setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDragging(false)
        void ingest(e.dataTransfer.files)
      }}
      className={cn(
        'relative rounded-panel border border-dashed p-5 transition-all duration-[350ms] ease-premium md:p-6',
        dragging ? 'glow-active border-solid' : 'border-border bg-surface backdrop-blur-glass',
      )}
    >
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:gap-6">
        {/* Note input */}
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <IconNote size={15} className="text-violet-dim" />
            <MicroLabel>Drop PDFs, screenshots or notes — or paste a thought</MicroLabel>
          </div>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault()
                submitNote()
              }
            }}
            rows={3}
            placeholder="e.g. Insurers quietly repricing — worth a Wednesday story?"
            className={cn(
              'mt-3 w-full resize-none rounded-xl border border-border bg-[rgba(255,255,255,0.02)] px-4 py-3',
              'text-[14px] leading-relaxed text-text placeholder:text-text-dim',
              'focus-violet transition-all duration-[350ms] ease-premium',
            )}
          />
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Button variant="subtle" size="sm" onClick={submitNote} disabled={!note.trim()}>
              <IconPlus size={15} /> Add note
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={() => inputRef.current?.click()}
            >
              {busy ? 'Reading…' : 'Browse files'}
            </Button>
            <span className="micro text-text-dim">PDF and images up to 8 MB</span>
          </div>
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        multiple
        accept="application/pdf,image/*"
        className="hidden"
        onChange={(e) => {
          void ingest(e.target.files)
          e.target.value = ''
        }}
      />

      {/* Files we could not take */}
      {rejected.length > 0 && (
        <div className="mt-4 flex items-start justify-between gap-4 rounded-xl border border-[rgba(240,180,90,0.35)] bg-[rgba(240,180,90,0.07)] px-4 py-3">
          <ul className="flex flex-col gap-1">
            {rejected.map((r) => (
              <li key={r} className="text-[13px] leading-relaxed text-amber">
                {r}
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => setRejected([])}
            aria-label="Dismiss"
            className="mt-0.5 shrink-0 text-amber transition-opacity hover:opacity-70"
          >
            <IconClose size={14} />
          </button>
        </div>
      )}

      {/* drag overlay hint */}
      {dragging && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center rounded-panel bg-[rgba(157,140,245,0.06)]">
          <MicroLabel className="micro-violet text-[12px]">Release to add to the pile</MicroLabel>
        </div>
      )}

      {/* transient confirmation */}
      {flash && (
        <div className="absolute right-4 top-4 flex items-center gap-2 rounded-full border border-[rgba(61,220,151,0.3)] bg-[rgba(61,220,151,0.08)] px-3 py-1 animate-fade-up">
          <span className="h-1.5 w-1.5 rounded-full bg-green shadow-[0_0_8px_rgba(61,220,151,0.7)]" />
          <MicroLabel className="text-green">{flash}</MicroLabel>
        </div>
      )}
    </div>
  )
}
