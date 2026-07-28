import { cn } from '../../lib/cn'
import {
  type SourceKind,
  type MonitoredSource,
  SOURCE_KIND_LABEL,
  INPUT_MIXES,
  mixById,
  visibleGroups as buildGroups,
  hiddenCount,
} from '../../data/sources'
import { MicroLabel } from '../MicroLabel'
import { Segmented } from '../Segmented'
import { AddSourceForm } from './AddSourceForm'
import {
  IconUsers,
  IconBuilding,
  IconTrend,
  IconNews,
  IconMessage,
  IconCheck,
  IconSparkle,
  IconClose,
  IconRefresh,
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
  /** profiles the user added themselves */
  custom: MonitoredSource[]
  /** ids of built-in sources the user removed */
  hidden: string[]
  onAdd: (input: { name: string; handle: string; kind: SourceKind }) => string | null
  onRemove: (id: string) => void
  onRestore: () => void
}

/** The kinds a user can add their own entries to. */
const ADDABLE: SourceKind[] = ['creator', 'page']

function SourceRow({
  source,
  selected,
  onToggle,
  onRemove,
}: {
  source: MonitoredSource
  selected: boolean
  onToggle: () => void
  onRemove: () => void
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onToggle}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onToggle()
        }
      }}
      aria-pressed={selected}
      className={cn(
        'group flex cursor-pointer items-center gap-3 rounded-xl border p-2.5 text-left transition-colors duration-200',
        selected
          ? 'border-[color:var(--violet-dim)] bg-purple-soft'
          : 'border-border bg-surface-solid hover:border-border-strong hover:bg-surface-hover',
      )}
    >
      <span
        className={cn(
          'grid h-9 w-9 shrink-0 place-items-center rounded-lg font-display text-[12px] font-bold',
          selected ? 'bg-purple text-on-accent' : 'bg-surface-soft text-text-muted',
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

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          onRemove()
        }}
        aria-label={`Remove ${source.name}`}
        title="Remove from monitored sources"
        className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-text-dim opacity-0 transition-all hover:bg-surface-hover hover:text-red focus-visible:opacity-100 group-hover:opacity-100 focus-violet"
      >
        <IconClose size={13} />
      </button>

      <span
        className={cn(
          'grid h-5 w-5 shrink-0 place-items-center rounded-md border transition-colors',
          selected ? 'border-transparent bg-purple text-on-accent' : 'border-border text-transparent',
        )}
      >
        <IconCheck size={12} />
      </span>
    </div>
  )
}

/**
 * The Automatic Generator's source configuration: pick an input mix, then
 * choose which monitored profiles, pages, posts, news categories and
 * conversations to feed the generator. Progressive — only the groups the
 * chosen mix draws from are shown (custom shows everything).
 */
export function SourcePicker({
  mix,
  onMix,
  selected,
  onToggle,
  onGroupSet,
  custom,
  hidden,
  onAdd,
  onRemove,
  onRestore,
}: SourcePickerProps) {
  const activeMix = mixById(mix)
  const allGroups = buildGroups(custom, hidden)
  const groups =
    activeMix.kinds.length === 0
      ? allGroups
      : allGroups.filter((g) => activeMix.kinds.includes(g.kind))
  const removedCount = hiddenCount(hidden)

  return (
    <div className="glass rounded-panel p-4 md:p-5">
      {/* input mix — the header doubles as the section label */}
      <div className="px-1">
        <div className="flex items-center gap-2.5">
          <IconSparkle size={14} className="text-violet" />
          <MicroLabel tone="violet">Pull from</MicroLabel>
        </div>
        <div className="mt-2.5">
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
        {groups.map((group) => {
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
                    onRemove={() => onRemove(s.id)}
                  />
                ))}
              </div>
            </div>
          )
        })}

        {groups.length === 0 && (
          <p className="px-1 py-6 text-center text-[12.5px] text-text-muted">
            No sources left in this mix. Add one below or restore the defaults.
          </p>
        )}

        {/* people & company pages are the only kinds you can add by hand */}
        {(groups.length === 0 || groups.some((g) => ADDABLE.includes(g.kind))) && (
          <AddSourceForm onAdd={onAdd} />
        )}

        {removedCount > 0 && (
          <button
            type="button"
            onClick={onRestore}
            className="flex items-center justify-center gap-1.5 rounded-lg py-1 text-[11.5px] text-text-muted transition-colors hover:text-violet focus-violet"
          >
            <IconRefresh size={12} />
            Restore {removedCount} removed source{removedCount === 1 ? '' : 's'}
          </button>
        )}
      </div>
    </div>
  )
}
