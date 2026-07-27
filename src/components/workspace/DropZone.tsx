import { useRef, useState } from 'react'
import { cn } from '../../lib/cn'
import { readFileList, type ReadFile } from '../../lib/files'
import { useStore } from '../../store/useStore'
import { Button } from '../Button'
import { MicroLabel } from '../MicroLabel'
import { IconPlus, IconUpload, IconUploadCloud, IconClose, IconPaperclip } from '../icons'

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
  const [noteFiles, setNoteFiles] = useState<ReadFile[]>([])
  const [flash, setFlash] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const noteFileInputRef = useRef<HTMLInputElement>(null)

  function flashMsg(msg: string) {
    setFlash(msg)
    window.setTimeout(() => setFlash(null), 2200)
  }

  async function ingest(fileList: FileList | null) {
    const files = await readFileList(fileList)
    if (!files.length) return
    addFiles(files)
    flashMsg(`Added ${files.length} item${files.length > 1 ? 's' : ''} to the pile`)
  }

  async function attachToNote(fileList: FileList | null) {
    const files = await readFileList(fileList)
    if (files.length) setNoteFiles((prev) => [...prev, ...files])
  }

  function removeNoteFile(index: number) {
    setNoteFiles((prev) => prev.filter((_, i) => i !== index))
  }

  function closeNoteComposer() {
    setNoteOpen(false)
    setNote('')
    setNoteFiles([])
  }

  function submitNote() {
    const text = note.trim()
    if (!text) return
    const fileCount = noteFiles.length
    addNote(text, { attachments: noteFiles })
    setNote('')
    setNoteFiles([])
    setNoteOpen(false)
    flashMsg(
      fileCount
        ? `Note + ${fileCount} file${fileCount > 1 ? 's' : ''} dropped into the pile`
        : 'Note dropped into the pile',
    )
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
            : 'border-border-strong bg-surface-soft hover:border-[color:var(--glow)] hover:bg-surface-hover',
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
              if (e.key === 'Escape') closeNoteComposer()
            }}
            rows={3}
            placeholder="Paste a thought, a link, or a stray observation…"
            className={cn(
              'w-full resize-none rounded-lg border border-border bg-bg px-3.5 py-2.5',
              'text-[14px] leading-relaxed text-text placeholder:text-text-dim',
              'focus-violet transition-all duration-[350ms] ease-premium',
            )}
          />

          {/* files attached to this note, staged alongside the text */}
          {noteFiles.length > 0 && (
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {noteFiles.map((f, i) => (
                <span
                  key={`${f.name}-${i}`}
                  className="flex max-w-[220px] items-center gap-1.5 rounded-md border border-border bg-bg py-1 pl-2 pr-1 text-[12px] text-text-2"
                >
                  <IconPaperclip size={11} className="shrink-0 text-text-dim" />
                  <span className="truncate" title={f.name}>
                    {f.name}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeNoteFile(i)}
                    aria-label={`Remove ${f.name}`}
                    className="grid h-4 w-4 shrink-0 place-items-center rounded-full text-text-dim hover:text-text"
                  >
                    <IconClose size={10} />
                  </button>
                </span>
              ))}
            </div>
          )}

          <div className="mt-2.5 flex items-center justify-between gap-2">
            <Button variant="ghost" size="sm" onClick={() => noteFileInputRef.current?.click()}>
              <IconPaperclip size={13} /> Attach files
            </Button>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={closeNoteComposer}>
                Cancel
              </Button>
              <Button variant="subtle" size="sm" onClick={submitNote} disabled={!note.trim()}>
                <IconPlus size={14} /> Add to pile
              </Button>
            </div>
          </div>

          <input
            ref={noteFileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => {
              attachToNote(e.target.files)
              e.target.value = ''
            }}
          />
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
        <div className="pointer-events-none absolute inset-0 grid place-items-center rounded-panel bg-purple-soft">
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
