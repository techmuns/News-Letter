import { useEffect, useRef, useState } from 'react'
import { cn } from '../../lib/cn'
import { type WorkspaceItem, type WorkspaceItemType } from '../../types'
import { IconPdf, IconScreenshot, IconNote, IconLink, IconClose, IconEdit } from '../icons'

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
}

/** One collected material, compact: thumbnail/icon, name, short preview, actions. */
export function MaterialCard({ item, onRename, onRemove }: MaterialCardProps) {
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
            {item.url ?? item.preview}
          </p>
        )}
      </div>

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
