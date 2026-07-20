import { useRef, useState } from 'react'
import { cn } from '../../lib/cn'
import { useStore } from '../../store/useStore'
import { Button } from '../Button'
import { MicroLabel } from '../MicroLabel'
import { IconPlus, IconNote } from '../icons'

function formatBytes(n: number): string {
  if (!n) return ''
  const kb = n / 1024
  if (kb < 1024) return `${Math.max(1, Math.round(kb))} KB`
  return `${(kb / 1024).toFixed(1)} MB`
}

/**
 * The drop zone at the top of the Workspace: mocked file drop + a quick
 * text-note input. No tagging, no structure required (§3.1).
 */
export function DropZone() {
  const addFiles = useStore((s) => s.addFiles)
  const addNote = useStore((s) => s.addNote)
  const [dragging, setDragging] = useState(false)
  const [note, setNote] = useState('')
  const [flash, setFlash] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  function flashMsg(msg: string) {
    setFlash(msg)
    window.setTimeout(() => setFlash(null), 2200)
  }

  function ingest(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return
    const files = Array.from(fileList).map((f) => ({
      name: f.name,
      sizeLabel: formatBytes(f.size),
    }))
    addFiles(files)
    flashMsg(`Added ${files.length} item${files.length > 1 ? 's' : ''} to the pile`)
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
        ingest(e.dataTransfer.files)
      }}
      className={cn(
        'relative rounded-panel border border-dashed p-5 transition-all duration-[350ms] ease-premium md:p-6',
        dragging
          ? 'glow-active border-solid'
          : 'border-border bg-surface backdrop-blur-glass',
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
            <Button variant="ghost" size="sm" onClick={() => inputRef.current?.click()}>
              Browse files
            </Button>
            <MicroLabel className="text-text-dim">⌘ + Enter to add</MicroLabel>
          </div>
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => {
          ingest(e.target.files)
          e.target.value = ''
        }}
      />

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
