import { useRef, useState } from 'react'
import { cn } from '../../lib/cn'
import { useStore } from '../../store/useStore'
import { Button } from '../Button'
import { MicroLabel } from '../MicroLabel'
import { IconPlus, IconUpload, IconUploadCloud, IconClose } from '../icons'

function formatBytes(n: number): string {
  if (!n) return ''
  const kb = n / 1024
  if (kb < 1024) return `${Math.max(1, Math.round(kb))} KB`
  return `${(kb / 1024).toFixed(1)} MB`
}

/**
 * The upload card at the top of the Workspace: mocked file drop + a quick
 * text-note input. No tagging, no structure required (§3.1).
 */
export function DropZone() {
  const addFiles = useStore((s) => s.addFiles)
  const addNote = useStore((s) => s.addNote)
  const [dragging, setDragging] = useState(false)
  const [noteOpen, setNoteOpen] = useState(false)
  const [note, setNote] = useState('')
  const [flash, setFlash] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  function flashMsg(msg: string) {
    setFlash(msg)
    window.setTimeout(() => setFlash(null), 2200)
  }

  function readImage(file: File): Promise<string | undefined> {
    if (!file.type.startsWith('image/')) return Promise.resolve(undefined)
    return new Promise((resolve) => {
      const reader = new FileReader()
      reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : undefined)
      reader.onerror = () => resolve(undefined)
      reader.readAsDataURL(file)
    })
  }

  async function ingest(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return
    const files = await Promise.all(
      Array.from(fileList).map(async (f) => ({
        name: f.name,
        sizeLabel: formatBytes(f.size),
        imageUrl: await readImage(f),
      })),
    )
    addFiles(files)
    flashMsg(`Added ${files.length} item${files.length > 1 ? 's' : ''} to the pile`)
  }

  function submitNote() {
    const text = note.trim()
    if (!text) return
    addNote(text)
    setNote('')
    setNoteOpen(false)
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
      className="relative rounded-panel border border-border bg-surface p-4 shadow-panel md:p-5"
    >
      {/* card heading */}
      <div className="flex items-center gap-2.5 px-1 pb-3.5">
        <IconUpload size={14} className="text-violet-dim" />
        <MicroLabel className="text-text-muted">
          Drop PDFs, screenshots or notes — we&rsquo;ll handle the rest
        </MicroLabel>
      </div>

      {/* dashed drop target */}
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className={cn(
          'flex min-h-[148px] w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-6 py-8 text-center',
          'transition-all duration-[350ms] ease-premium focus-violet',
          dragging
            ? 'border-glow bg-purple-soft'
            : 'border-border-strong bg-surface-soft hover:border-[rgba(145,71,245,0.4)] hover:bg-surface-hover',
        )}
      >
        <IconUploadCloud size={30} className="text-violet" strokeWidth={1.5} />
        <span className="mt-1 text-[14px] font-medium text-text-2">Drag &amp; drop files here</span>
        <span className="text-[12.5px] text-text-muted">or click to browse</span>
      </button>

      {/* actions */}
      <div className="mt-4 flex flex-wrap items-center gap-2.5 px-1">
        <Button
          variant="subtle"
          size="sm"
          onClick={() => setNoteOpen((o) => !o)}
          aria-expanded={noteOpen}
        >
          <IconPlus size={15} /> Add note
        </Button>
        <Button variant="ghost" size="sm" onClick={() => inputRef.current?.click()}>
          Browse files
        </Button>
      </div>

      {/* inline note composer */}
      {noteOpen && (
        <div className="mt-3 animate-fade-up rounded-xl border border-border bg-surface-soft p-3">
          <textarea
            value={note}
            autoFocus
            onChange={(e) => setNote(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault()
                submitNote()
              }
              if (e.key === 'Escape') setNoteOpen(false)
            }}
            rows={3}
            placeholder="Paste a thought, a link, or a stray observation…"
            className={cn(
              'w-full resize-none rounded-lg border border-border bg-bg px-3.5 py-2.5',
              'text-[14px] leading-relaxed text-text placeholder:text-text-dim',
              'focus-violet transition-all duration-[350ms] ease-premium',
            )}
          />
          <div className="mt-2.5 flex items-center justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setNoteOpen(false)}>
              Cancel
            </Button>
            <Button variant="subtle" size="sm" onClick={submitNote} disabled={!note.trim()}>
              <IconPlus size={14} /> Add to pile
            </Button>
          </div>
        </div>
      )}

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
        <div className="pointer-events-none absolute inset-0 grid place-items-center rounded-panel bg-[rgba(145,71,245,0.05)]">
          <MicroLabel className="micro-violet text-[12px]">Release to add to the pile</MicroLabel>
        </div>
      )}

      {/* transient confirmation */}
      {flash && (
        <div className="absolute right-4 top-4 flex items-center gap-2 rounded-full border border-[rgba(71,214,161,0.3)] bg-[rgba(71,214,161,0.08)] px-3 py-1 animate-fade-up">
          <span className="h-1.5 w-1.5 rounded-full bg-green shadow-[0_0_8px_rgba(71,214,161,0.7)]" />
          <MicroLabel className="text-green">{flash}</MicroLabel>
          <button type="button" onClick={() => setFlash(null)} aria-label="Dismiss">
            <IconClose size={12} className="text-green/70 hover:text-green" />
          </button>
        </div>
      )}
    </div>
  )
}
