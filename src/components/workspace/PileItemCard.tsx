import { cn } from '../../lib/cn'
import { relativeTime } from '../../lib/date'
import { type WorkspaceItem, type WorkspaceItemType } from '../../types'
import { Card } from '../Card'
import { IconPdf, IconScreenshot, IconNote, IconCheck } from '../icons'

const TYPE_ICON: Record<WorkspaceItemType, { Icon: typeof IconPdf; tint: string }> = {
  pdf: { Icon: IconPdf, tint: 'text-amber' },
  screenshot: { Icon: IconScreenshot, tint: 'text-green' },
  note: { Icon: IconNote, tint: 'text-violet' },
}

interface PileItemCardProps {
  item: WorkspaceItem
  selected: boolean
  onToggle: () => void
}

export function PileItemCard({ item, selected, onToggle }: PileItemCardProps) {
  const { Icon, tint } = TYPE_ICON[item.type]
  return (
    <Card
      active={selected}
      interactive
      onClick={onToggle}
      role="button"
      aria-pressed={selected}
      className="flex gap-3 p-4"
    >
      <Icon size={17} className={cn('mt-0.5 shrink-0', tint)} />

      <div className="min-w-0 flex-1">
        <p className="line-clamp-1 text-[14px] font-medium text-text">{item.title}</p>
        <p className="mt-1 line-clamp-1 text-[12.5px] leading-relaxed text-text-muted">
          {item.preview}
        </p>
        <p className="mt-2 text-[11px] text-text-dim">
          {item.addedBy} · {relativeTime(item.createdAt)}
        </p>
      </div>

      {/* selection check */}
      <span
        className={cn(
          'grid h-5 w-5 shrink-0 place-items-center rounded-md border transition-all duration-200',
          selected ? 'border-violet bg-violet text-[#211a33]' : 'border-border text-transparent',
        )}
      >
        <IconCheck size={13} />
      </span>
    </Card>
  )
}
