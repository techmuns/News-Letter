import { cn } from '../../lib/cn'
import { relativeTime } from '../../lib/date'
import { type MaterialGroup, type WorkspaceItemType } from '../../types'
import { MicroLabel } from '../MicroLabel'
import { IconPdf, IconScreenshot, IconNote, IconLink, IconEdit, IconClose } from '../icons'

const TYPE_ICON: Record<WorkspaceItemType, { Icon: typeof IconPdf; icon: string }> = {
  pdf: { Icon: IconPdf, icon: 'text-red' },
  screenshot: { Icon: IconScreenshot, icon: 'text-green' },
  note: { Icon: IconNote, icon: 'text-amber' },
  link: { Icon: IconLink, icon: 'text-sky' },
}

interface MaterialGroupCardProps {
  group: MaterialGroup
  selected: boolean
  onSelect: () => void
  onEdit: () => void
  onDiscard: () => void
}

/**
 * The collapsed view of one post's material set — a count, the type mix and a
 * few names. Deliberately compact: the individual materials live inside the
 * group, not scattered down the page.
 */
export function MaterialGroupCard({
  group,
  selected,
  onSelect,
  onEdit,
  onDiscard,
}: MaterialGroupCardProps) {
  const { items } = group
  const counts = items.reduce<Partial<Record<WorkspaceItemType, number>>>((acc, it) => {
    acc[it.type] = (acc[it.type] ?? 0) + 1
    return acc
  }, {})

  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onSelect()
        }
      }}
      className={cn(
        'glass group relative cursor-pointer rounded-panel p-4 text-left',
        'transition-all duration-[350ms] ease-premium focus-violet',
        selected
          ? 'border-[color:var(--violet-dim)] bg-purple-soft'
          : 'hover:border-border-strong',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <MicroLabel tone="violet">Post material</MicroLabel>
            <span className="text-[12px] text-text-2">
              {items.length} item{items.length === 1 ? '' : 's'} added
            </span>
          </div>

          {/* type mix */}
          <div className="mt-2.5 flex flex-wrap items-center gap-2.5">
            {(Object.keys(counts) as WorkspaceItemType[]).map((t) => {
              const { Icon, icon } = TYPE_ICON[t]
              return (
                <span key={t} className="flex items-center gap-1 text-[11.5px] text-text-muted">
                  <Icon size={13} className={icon} /> {counts[t]}
                </span>
              )
            })}
            <span className="text-[11px] text-text-dim">· {relativeTime(group.createdAt)}</span>
          </div>

          {/* a few names, then a tail count */}
          <div className="mt-2 flex flex-wrap gap-1.5">
            {items.slice(0, 4).map((it) => (
              <span
                key={it.id}
                title={it.title}
                className="max-w-[160px] truncate rounded-md border border-border-soft bg-surface-soft px-1.5 py-0.5 text-[11px] text-text-muted"
              >
                {it.title}
              </span>
            ))}
            {items.length > 4 && (
              <span className="text-[11px] text-text-dim">+{items.length - 4} more</span>
            )}
          </div>
        </div>

        <div onClick={(e) => e.stopPropagation()} className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={onEdit}
            className="flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-[11.5px] font-medium text-text-2 transition-colors hover:border-border-strong hover:text-text focus-violet"
          >
            <IconEdit size={12} /> Edit materials
          </button>
          <button
            type="button"
            onClick={onDiscard}
            aria-label="Discard this material group"
            className="grid h-7 w-7 place-items-center rounded-md text-text-dim opacity-0 transition-all hover:bg-surface-hover hover:text-red focus-visible:opacity-100 group-hover:opacity-100 focus-violet"
          >
            <IconClose size={13} />
          </button>
        </div>
      </div>
    </div>
  )
}
