import { useEffect, useRef, useState } from 'react'
import { cn } from '../../lib/cn'
import { type WorkspaceItem, type WorkspaceItemType } from '../../types'
import {
  IconPdf,
  IconScreenshot,
  IconNote,
  IconLink,
  IconClose,
  IconEdit,
  IconCheck,
  IconSpinner,
  IconAlert,
} from '../icons'

const TYPE_META: Record<WorkspaceItemType, { Icon: typeof IconPdf; icon: string; tile: string }> = {
  pdf: { Icon: IconPdf, icon: 'text-red', tile: 'bg-red-soft' },
  screenshot: { Icon: IconScreenshot, icon: 'text-green', tile: 'bg-green-soft' },
  note: { Icon: IconNote, icon: 'text-amber', tile: 'bg-amber-soft' },
  link: { Icon: IconLink, icon: 'text-sky', tile: 'bg-sky-soft' },
}

interface MaterialCardProps {
  item: WorkspaceItem
  onRename: (title: string) => void
  onRemove: () => void
  /** re-run reading on a link whose fetch failed */
  onRetryRead?: () => void
}

/** Rough word count of extracted text — how much the post has to work from. */
function wordsIn(text: string): number {
  return text.trim() ? text.trim().split(/\s+/).length : 0
}

/**
 * What we managed to read out of this material, in one line.
 *
 * Worth showing on every card: the difference between a post built on a
 * document's figures and one built on its filename is exactly this, and the
 * author needs to know which they are about to get.
 */
function ReadStatus({ item, onRetry }: { item: WorkspaceItem; onRetry?: () => void }) {
  if (item.readState === 'reading') {
    return (
      <span className="flex shrink-0 items-center gap-1 text-[11px] text-violet">
        <IconSpinner size={11} className="animate-spin" />
        {item.imageUrl || item.pageImages?.length ? 'reading the document…' : 'reading…'}
      </span>
    )
  }
  if (item.readState === 'failed') {
    return (
      <span className="flex shrink-0 items-center gap-1.5 text-[11px] text-amber" title={item.readError}>
        <IconAlert size={11} /> not read
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="underline decoration-dotted transition-colors hover:text-text focus-violet"
          >
            retry
          </button>
        )}
      </span>
    )
  }
  if (item.extracted) {
    const words = wordsIn(item.extracted)
    // An image that was looked at says so — "text read" on a screenshot would
    // leave the author guessing whether the picture itself was ever opened.
    const what = item.imageUrl || item.pageImages?.length
      ? item.readKind || 'document read'
      : item.pages
        ? `${item.pages} page${item.pages > 1 ? 's' : ''} read`
        : 'text read'
    return (
      <span
        className="flex shrink-0 items-center gap-1 text-[11px] text-green"
        title={`${words.toLocaleString('en-IN')} words read — the post is written from this text`}
      >
        <IconCheck size={11} />
        {what}
      </span>
    )
  }
  return null
}

/** One collected material, compact: thumbnail/icon, name, short preview, actions. */
export function MaterialCard({ item, onRename, onRemove, onRetryRead }: MaterialCardProps) {
  const { Icon, icon, tile } = TYPE_META[item.type]
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(item.title)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing) inputRef.current?.select()
  }, [editing])

  function commit() {
    const next = name.trim()
    if (next && next !== item.title) onRename(next)
    else setName(item.title)
    setEditing(false)
  }

  return (
    <div className="group flex animate-fade-up items-center gap-3 rounded-xl border border-border bg-surface-solid px-3 py-2.5 transition-colors hover:border-border-strong">
      {item.imageUrl ? (
        <img
          src={item.imageUrl}
          alt=""
          className="h-9 w-9 shrink-0 rounded-lg border border-border object-cover"
        />
      ) : (
        <span className={cn('grid h-9 w-9 shrink-0 place-items-center rounded-lg', tile)}>
          <Icon size={16} className={icon} />
        </span>
      )}

      <div className="min-w-0 flex-1">
        {editing ? (
          <input
            ref={inputRef}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commit()
              if (e.key === 'Escape') {
                setName(item.title)
                setEditing(false)
              }
            }}
            className="w-full rounded-md border border-border bg-surface-solid px-2 py-1 text-[13px] text-text focus-violet"
          />
        ) : (
          <p className="line-clamp-1 text-[13.5px] font-medium text-text" title={item.title}>
            {item.title}
          </p>
        )}
        {(item.preview || item.url) && !editing && (
          <p className="mt-0.5 line-clamp-1 text-[11.5px] text-text-muted">
            {/* Once read, the document's own opening line is the useful preview
                — it shows the author we opened the thing, not just filed it. */}
            {item.extracted ? item.preview : (item.url ?? item.preview)}
          </p>
        )}
      </div>

      <ReadStatus
        item={item}
        onRetry={item.url || item.imageUrl || item.pageImages?.length ? onRetryRead : undefined}
      />

      <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
        <button
          type="button"
          onClick={() => setEditing(true)}
          aria-label={`Rename ${item.title}`}
          className="grid h-7 w-7 place-items-center rounded-md text-text-dim transition-colors hover:bg-surface-hover hover:text-text focus-violet"
        >
          <IconEdit size={13} />
        </button>
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${item.title}`}
          className="grid h-7 w-7 place-items-center rounded-md text-text-dim transition-colors hover:bg-surface-hover hover:text-red focus-violet"
        >
          <IconClose size={13} />
        </button>
      </div>
    </div>
  )
}
