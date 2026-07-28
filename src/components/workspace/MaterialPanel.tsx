import { useRef, useState } from 'react'
import { cn } from '../../lib/cn'
import { extractUrls, readFileList, textWithoutUrls } from '../../lib/files'
import { useStore } from '../../store/useStore'
import { type MaterialGroup } from '../../types'
import { Button } from '../Button'
import { MicroLabel } from '../MicroLabel'
import { MaterialCard } from './MaterialCard'
import { IconPlus, IconUploadCloud, IconSpinner, IconCheck, IconLink } from '../icons'

interface MaterialPanelProps {
  group: MaterialGroup | null
  onDone: () => void
}

/**
 * The one place materials are collected — sitting at the front of the workspace
 * rather than behind a dialog. Everything for a single post goes in here: notes,
 * pasted text, files, images, links. It stays put so several can be added in a
 * row, and Done closes the group.
 */
export function MaterialPanel({ group, onDone }: MaterialPanelProps) {
  const addGroupNote = useStore((s) => s.addGroupNote)
  const addGroupFiles = useStore((s) => s.addGroupFiles)
  const updateGroupItem = useStore((s) => s.updateGroupItem)
  const removeGroupItem = useStore((s) => s.removeGroupItem)

  const [text, setText] = useState('')
  const [reading, setReading] = useState(0)
  const [justAdded, setJustAdded] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const textRef = useRef<HTMLTextAreaElement>(null)

  const items = group?.items ?? []

  function flashAdded(msg: string) {
    setJustAdded(msg)
    window.setTimeout(() => setJustAdded(null), 1800)
  }

  async function ingest(fileList: FileList | null) {
    const incoming = fileList?.length ?? 0
    if (!incoming) return
    setReading((n) => n + incoming)
    try {
      const files = await readFileList(fileList)
      if (files.length) {
        addGroupFiles(files)
        flashAdded(`${files.length} file${files.length > 1 ? 's' : ''} added`)
      }
    } finally {
      setReading((n) => Math.max(0, n - incoming))
    }
  }

  // A single box takes a note, a link, or both — links are read straight out of
  // whatever was typed or pasted, so there's no mode to pick first.
  const foundUrls = extractUrls(text)
  const noteRemainder = textWithoutUrls(text)
  const canAdd = text.trim().length > 0

  /** Adds whatever is in the box and clears it, ready for the next material. */
  function addCurrent() {
    if (!canAdd) return

    foundUrls.forEach((href) => addGroupNote({ type: 'link', text: href, url: href }))
    if (noteRemainder) addGroupNote({ type: 'note', text: noteRemainder })

    const parts: string[] = []
    if (foundUrls.length) parts.push(`${foundUrls.length} link${foundUrls.length > 1 ? 's' : ''}`)
    if (noteRemainder) parts.push('note')
    flashAdded(`${parts.join(' + ')} added`)

    setText('')
    textRef.current?.focus()
  }

  return (
    <section
      aria-label="Add my material"
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
        'glass relative w-full rounded-panel transition-colors',
        dragging && 'border-[color:var(--violet)]',
      )}
    >
      {/* the composer — box one: files. box two: note and/or link. */}
      <div className="px-5 py-5">
        {/* the drop box carries the title, so there's no separate header */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className={cn(
            'flex min-h-[176px] w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-6 py-8 text-center',
            'transition-all duration-[350ms] ease-premium focus-violet',
            dragging
              ? 'border-[color:var(--violet)] bg-purple-soft'
              : 'border-border-strong bg-[color:var(--surface)] hover:border-[color:var(--violet-dim)] hover:bg-purple-soft',
          )}
        >
          {reading > 0 ? (
            <>
              <IconSpinner size={30} className="animate-spin text-violet" />
              <span className="mt-1 text-[15px] font-semibold text-text">
                Reading {reading} file{reading > 1 ? 's' : ''}…
              </span>
            </>
          ) : (
            <>
              <IconUploadCloud size={30} className="text-violet" strokeWidth={1.5} />
              <span className="mt-1 flex items-center gap-2 text-[15px] font-semibold text-text">
                <IconPlus size={15} className="text-violet" />
                Add my material
              </span>
              <span className="text-[12.5px] text-text-muted">
                Drag &amp; drop your files here, or click to browse
              </span>
              <span className="text-[11.5px] text-text-dim">
                Everything you add becomes the source for one post
              </span>
            </>
          )}
        </button>

        <div className="mt-3">
          <textarea
            ref={textRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onPaste={(e) => {
              // a pasted screenshot becomes a file, not stray text
              if (e.clipboardData.files.length) {
                e.preventDefault()
                ingest(e.clipboardData.files)
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault()
                addCurrent()
              }
            }}
            rows={2}
            placeholder="Write a note or paste a link"
            className={cn(
              'w-full resize-y rounded-xl border border-border bg-surface-solid px-3.5 py-2.5',
              'text-[14px] leading-relaxed text-text placeholder:text-text-muted focus-violet',
            )}
          />

          {/* what the pasted text will become, before it's added */}
          {foundUrls.length > 0 && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <IconLink size={12} className="shrink-0 text-sky" />
              {foundUrls.slice(0, 3).map((u) => (
                <span
                  key={u}
                  title={u}
                  className="max-w-[220px] animate-chip-in truncate rounded-md border border-sky-border bg-sky-soft px-1.5 py-0.5 text-[11px] text-sky"
                >
                  {u}
                </span>
              ))}
              {foundUrls.length > 3 && (
                <span className="text-[11px] text-text-dim">+{foundUrls.length - 3} more</span>
              )}
              <span className="text-[11px] text-text-dim">
                will be added as {foundUrls.length === 1 ? 'a link' : 'links'}
                {noteRemainder ? ' + a note' : ''}
              </span>
            </div>
          )}
        </div>

        <div className="mt-2.5 flex items-center justify-end gap-3">
          {justAdded && (
            <span className="flex animate-fade-up items-center gap-1.5 text-[11.5px] text-green">
              <IconCheck size={12} /> {justAdded}
            </span>
          )}
          <Button variant="subtle" size="sm" onClick={addCurrent} disabled={!canAdd}>
            <IconPlus size={14} /> {items.length ? 'Add another material' : 'Add material'}
          </Button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            ingest(e.target.files)
            e.target.value = ''
          }}
        />
      </div>

      {/* what's been collected so far — grows under the composer */}
      {items.length > 0 && (
        <div className="border-t border-border px-5 py-4">
          <div className="flex flex-col gap-2">
            <MicroLabel className="text-text-dim">
              {items.length} item{items.length === 1 ? '' : 's'} in this post
            </MicroLabel>
            {items.map((item) => (
              <MaterialCard
                key={item.id}
                item={item}
                onRename={(title) => group && updateGroupItem(group.id, item.id, { title })}
                onRemove={() => group && removeGroupItem(group.id, item.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* footer — Done closes the group */}
      <div className="flex items-center justify-between gap-3 border-t border-border px-5 py-4">
        <span className="text-[12px] text-text-muted">
          {items.length > 0
            ? `${items.length} item${items.length === 1 ? '' : 's'} will become one post`
            : 'Nothing added yet — drop a file, write a note or paste a link.'}
        </span>
        <Button variant="primary" size="md" onClick={onDone} disabled={items.length === 0}>
          <IconCheck size={15} /> Done
        </Button>
      </div>
    </section>
  )
}
