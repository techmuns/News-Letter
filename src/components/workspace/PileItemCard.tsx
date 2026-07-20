import { cn } from '../../lib/cn'
import { relativeTime } from '../../lib/date'
import { type WorkspaceItem, type WorkspaceItemType } from '../../types'
import { Card } from '../Card'
import { MicroLabel } from '../MicroLabel'
import { IconPdf, IconScreenshot, IconNote, IconCheck } from '../icons'

const TYPE_META: Record<
  WorkspaceItemType,
  { label: string; Icon: typeof IconPdf; tint: string }
> = {
  pdf: { label: 'PDF', Icon: IconPdf, tint: 'text-[#F5C24B]' },
  screenshot: { label: 'Screenshot', Icon: IconScreenshot, tint: 'text-[#3DDC97]' },
  note: { label: 'Note', Icon: IconNote, tint: 'text-violet' },
}

interface PileItemCardProps {
  item: WorkspaceItem
  selected: boolean
  onToggle: () => void
}

export function PileItemCard({ item, selected, onToggle }: PileItemCardProps) {
  const meta = TYPE_META[item.type]
  const { Icon } = meta
  return (
    <Card
      active={selected}
      interactive
      onClick={onToggle}
      role="button"
      aria-pressed={selected}
      className="flex flex-col gap-3 p-4"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'grid h-8 w-8 place-items-center rounded-lg border border-border bg-[rgba(255,255,255,0.02)]',
              meta.tint,
            )}
          >
            <Icon size={16} />
          </span>
          <MicroLabel className={meta.tint}>{meta.label}</MicroLabel>
        </div>
        {/* selection check */}
        <span
          className={cn(
            'grid h-5 w-5 place-items-center rounded-md border transition-all duration-200',
            selected
              ? 'border-violet bg-violet text-[#12101e]'
              : 'border-border text-transparent',
          )}
        >
          <IconCheck size={13} />
        </span>
      </div>

      <div>
        <p className="line-clamp-1 text-[14px] font-medium text-text">{item.title}</p>
        <p className="mt-1 line-clamp-2 text-[12.5px] leading-relaxed text-text-muted">
          {item.preview}
        </p>
      </div>

      <div className="mt-auto flex items-center gap-2 pt-1">
        <span className="text-[11px] text-text-2">{item.addedBy}</span>
        <span className="text-text-dim">·</span>
        <MicroLabel className="text-[9.5px]">{relativeTime(item.createdAt)}</MicroLabel>
      </div>
    </Card>
  )
}
