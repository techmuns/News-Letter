import { cn } from '../../lib/cn'
import { relativeTime } from '../../lib/date'
import { type WorkspaceItem, type WorkspaceItemType } from '../../types'
import { Card } from '../Card'
import { IconPdf, IconScreenshot, IconNote, IconCheck, IconLinkedIn } from '../icons'

const TYPE_ICON: Record<WorkspaceItemType, { Icon: typeof IconPdf; tint: string }> = {
  pdf: { Icon: IconPdf, tint: 'text-amber' },
  screenshot: { Icon: IconScreenshot, tint: 'text-green' },
  note: { Icon: IconNote, tint: 'text-violet' },
  linkedin: { Icon: IconLinkedIn, tint: 'text-[#5b9bd5]' },
}

/** "1.2K" — engagement reads better short on a card this size. */
function compact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, '')}K`
  return String(n)
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
      {item.imageUrl ? (
        <img
          src={item.imageUrl}
          alt=""
          className="mt-0.5 h-10 w-14 shrink-0 rounded-md border border-border object-cover"
        />
      ) : (
        <Icon size={17} className={cn('mt-0.5 shrink-0', tint)} />
      )}

      <div className="min-w-0 flex-1">
        <p className="line-clamp-1 text-[14px] font-medium text-text">{item.title}</p>
        <p className="mt-1 line-clamp-1 text-[12.5px] leading-relaxed text-text-muted">
          {item.preview}
        </p>
        <p className="mt-2 text-[11px] text-text-dim">
          {item.addedBy} · {relativeTime(item.createdAt)}
          {item.engagement && (
            <>
              {item.engagement.reactions !== undefined &&
                ` · ${compact(item.engagement.reactions)} reactions`}
              {item.engagement.comments !== undefined &&
                ` · ${compact(item.engagement.comments)} comments`}
            </>
          )}
        </p>

        {/* A scraped post points back at the original rather than replacing it. */}
        {item.sourceUrl && (
          <a
            href={item.sourceUrl}
            target="_blank"
            rel="noreferrer noopener"
            onClick={(e) => e.stopPropagation()}
            className="mt-1 inline-block text-[11px] text-violet-dim underline-offset-2 hover:underline"
          >
            View on LinkedIn ↗
          </a>
        )}
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
