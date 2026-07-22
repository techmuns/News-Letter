import { cn } from '../../lib/cn'
import { relativeTime, formatAbsolute } from '../../lib/date'
import { type WorkspaceItem, type WorkspaceItemType } from '../../types'
import { Menu, MenuItem } from '../Menu'
import {
  IconPdf,
  IconScreenshot,
  IconNote,
  IconDots,
  IconCheck,
} from '../icons'

interface TypeMeta {
  Icon: typeof IconPdf
  label: string
  icon: string
  tile: string
  tagText: string
  tagBg: string
}

/** Visual treatment per item type — the tag is the item's real type, not an invented topic. */
const TYPE_META: Record<WorkspaceItemType, TypeMeta> = {
  pdf: {
    Icon: IconPdf,
    label: 'PDF',
    icon: 'text-red',
    tile: 'bg-[rgba(226,104,90,0.12)]',
    tagText: 'text-red',
    tagBg: 'bg-[rgba(226,104,90,0.1)] border-[rgba(226,104,90,0.22)]',
  },
  screenshot: {
    Icon: IconScreenshot,
    label: 'Screenshot',
    icon: 'text-green',
    tile: 'bg-[rgba(71,214,161,0.12)]',
    tagText: 'text-green',
    tagBg: 'bg-[rgba(71,214,161,0.1)] border-[rgba(71,214,161,0.22)]',
  },
  note: {
    Icon: IconNote,
    label: 'Note',
    icon: 'text-amber',
    tile: 'bg-[rgba(242,197,102,0.12)]',
    tagText: 'text-amber',
    tagBg: 'bg-[rgba(242,197,102,0.1)] border-[rgba(242,197,102,0.22)]',
  },
}

interface PileRowProps {
  item: WorkspaceItem
  selected: boolean
  onToggle: () => void
  onRemove: () => void
}

export function PileRow({ item, selected, onToggle, onRemove }: PileRowProps) {
  const meta = TYPE_META[item.type]
  const { Icon } = meta

  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      onClick={onToggle}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onToggle()
        }
      }}
      className={cn(
        'group relative flex cursor-pointer items-center gap-3.5 px-4 py-3.5 transition-colors duration-200',
        selected ? 'bg-purple-soft' : 'hover:bg-surface-hover',
      )}
    >
      {selected && (
        <span className="absolute inset-y-2 left-0 w-[3px] rounded-full bg-violet" aria-hidden />
      )}

      {/* type tile / thumbnail */}
      {item.imageUrl ? (
        <img
          src={item.imageUrl}
          alt=""
          className="h-10 w-10 shrink-0 rounded-lg border border-border object-cover"
        />
      ) : (
        <span className={cn('grid h-10 w-10 shrink-0 place-items-center rounded-lg', meta.tile)}>
          <Icon size={18} className={meta.icon} />
        </span>
      )}

      {/* title · description · added-time */}
      <div className="min-w-0 flex-1">
        <p className="line-clamp-1 text-[14px] font-medium text-text" title={item.title}>
          {item.title}
        </p>
        {item.preview && (
          <p className="mt-0.5 line-clamp-1 text-[12.5px] leading-relaxed text-text-muted">
            {item.preview}
          </p>
        )}
        <p className="mt-1.5 text-[11px] text-text-dim">Added &middot; {relativeTime(item.createdAt)}</p>
      </div>

      {/* real type tag + real date (from createdAt) */}
      <div className="hidden shrink-0 items-center gap-3.5 md:flex">
        <span
          className={cn(
            'rounded-md border px-2 py-0.5 text-[11px] font-medium',
            meta.tagBg,
            meta.tagText,
          )}
        >
          {meta.label}
        </span>
        <span className="w-[92px] text-right text-[11.5px] tabular-nums text-text-dim">
          {formatAbsolute(item.createdAt)}
        </span>
      </div>

      {/* selection check (only when selected — clean by default) */}
      {selected && (
        <span className="grid h-5 w-5 shrink-0 place-items-center rounded-md bg-violet text-[#160c26] md:hidden">
          <IconCheck size={12} />
        </span>
      )}

      {/* row menu — stops propagation so it doesn't toggle selection */}
      <div onClick={(e) => e.stopPropagation()} className="shrink-0">
        <Menu
          align="right"
          trigger={
            <span className="grid h-8 w-8 place-items-center rounded-lg border border-transparent text-text-muted transition-colors hover:border-border hover:bg-surface-hover hover:text-text">
              <IconDots size={16} />
            </span>
          }
        >
          {(close) => (
            <>
              <MenuItem
                onClick={() => {
                  onToggle()
                  close()
                }}
              >
                {selected ? 'Deselect' : 'Select for content'}
              </MenuItem>
              <MenuItem
                onClick={() => {
                  onRemove()
                  close()
                }}
              >
                Remove from pile
              </MenuItem>
            </>
          )}
        </Menu>
      </div>
    </div>
  )
}
