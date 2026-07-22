import { cn } from '../../lib/cn'
import {
  type SourceKind,
  type MonitoredSource,
  SOURCE_GROUPS,
  SOURCE_KIND_LABEL,
  INPUT_MIXES,
  mixById,
} from '../../data/sources'
import { MicroLabel } from '../MicroLabel'
import { Segmented } from '../Segmented'
import {
  IconUsers,
  IconBuilding,
  IconTrend,
  IconNews,
  IconMessage,
  IconCheck,
  IconSparkle,
} from '../icons'

const KIND_ICON: Record<SourceKind, (p: { size?: number; className?: string }) => JSX.Element> = {
  creator: IconUsers,
  page: IconBuilding,
  post: IconTrend,
  news: IconNews,
  conversation: IconMessage,
}

interface SourcePickerProps {
  mix: string
  onMix: (id: string) => void
  selected: Set<string>
  onToggle: (id: string) => void
  onGroupSet: (ids: string[], select: boolean) => void
}

function SourceRow({
  source,
  selected,
  onToggle,
}: {
  source: MonitoredSource
  selected: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={selected}
      className={cn(
        'flex items-center gap-3 rounded-xl border p-2.5 text-left transition-colors duration-200',
        selected
          ? 'border-[rgba(145,71,245,0.5)] bg-purple-soft'
          : 'border-border bg-surface-soft hover:border-border-strong hover:bg-surface-hover',
      )}
    >
      <span
        className={cn(
          'grid h-9 w-9 shrink-0 place-items-center rounded-lg font-display text-[12px] font-bold',
          selected ? 'bg-[rgba(145,71,245,0.25)] text-violet' : 'bg-surface text-text-muted',
        )}
      >
        {source.avatar}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-medium text-text">{source.name}</p>
        <p className="truncate text-[11.5px] text-text-muted">
          {source.detail}
          {source.signal ? ` · ${source.signal}` : ''}
        </p>
      </div>
      <span
        className={cn(
          'grid h-5 w-5 shrink-0 place-items-center rounded-md border transition-colors',
          selected ? 'border-transparent bg-violet text-[#160c26]' : 'border-border text-transparent',
        )}
      >
        <IconCheck size={12} />
      </span>
    </button>
  )
}

/**
 * The Automatic Generator's source configuration: pick an input mix, then
 * choose which monitored profiles, pages, posts, news categories and
 * conversations to feed the generator. Progressive — only the groups the
 * chosen mix draws from are shown (custom shows everything).
 */
export function SourcePicker({ mix, onMix, selected, onToggle, onGroupSet }: SourcePickerProps) {
  const activeMix = mixById(mix)
  const visibleGroups =
    activeMix.kinds.length === 0
      ? SOURCE_GROUPS
      : SOURCE_GROUPS.filter((g) => activeMix.kinds.includes(g.kind))

  return (
    <div className="rounded-panel border border-border bg-surface p-4 shadow-panel md:p-5">
      <div className="flex items-center gap-2.5 px-1">
        <IconSparkle size={14} className="text-violet" />
        <MicroLabel className="text-text-muted">
          Automatic generator — build content from monitored sources
        </MicroLabel>
      </div>

      {/* input mix */}
      <div className="mt-4 px-1">
        <MicroLabel className="text-text-dim">Input mix</MicroLabel>
        <div className="mt-2">
          <Segmented
            value={mix}
            onChange={onMix}
            options={INPUT_MIXES.map((m) => ({ value: m.id, label: m.label }))}
          />
        </div>
        <p className="mt-2 text-[12px] leading-relaxed text-text-muted">{activeMix.hint}</p>
      </div>

      {/* source groups */}
      <div className="mt-4 flex flex-col gap-5">
        {visibleGroups.map((group) => {
          const Icon = KIND_ICON[group.kind]
          const ids = group.sources.map((s) => s.id)
          const selCount = ids.filter((id) => selected.has(id)).length
          const allSel = selCount === ids.length
          return (
            <div key={group.kind}>
              <div className="mb-2.5 flex items-center justify-between px-1">
                <span className="flex items-center gap-2">
                  <Icon size={14} className="text-violet-dim" />
                  <MicroLabel className="text-text-2">{SOURCE_KIND_LABEL[group.kind]}</MicroLabel>
                  {selCount > 0 && (
                    <span className="rounded-full bg-purple-soft px-1.5 py-0.5 text-[10px] font-medium text-violet">
                      {selCount}
                    </span>
                  )}
                </span>
                <button
                  type="button"
                  onClick={() => onGroupSet(ids, !allSel)}
                  className="text-[11px] font-medium text-violet transition-opacity hover:opacity-80"
                >
                  {allSel ? 'Clear' : 'Select all'}
                </button>
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {group.sources.map((s) => (
                  <SourceRow
                    key={s.id}
                    source={s}
                    selected={selected.has(s.id)}
                    onToggle={() => onToggle(s.id)}
                  />
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
