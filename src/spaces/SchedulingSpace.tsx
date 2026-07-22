import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore'
import { previewPath } from '../lib/routes'
import { formatDate, formatTime, weekdayName, weekBucket } from '../lib/date'
import {
  type Campaign,
  type ChannelKind,
  type ChannelStatus,
  CHANNEL_ORDER,
  CHANNEL_LABEL,
  channelApproved,
  captionOf,
  statusTone,
} from '../types'
import { PageHeader } from '../components/PageHeader'
import { MicroLabel } from '../components/MicroLabel'
import { Card } from '../components/Card'
import { StatusChip } from '../components/StatusChip'
import { StatusDot } from '../components/StatusDot'
import { Button } from '../components/Button'
import { ScheduleComposer } from '../components/scheduling/ScheduleComposer'
import { ChannelIcon, IconCalendar, IconClock } from '../components/icons'

interface ScheduleEntry {
  campaign: Campaign
  kind: ChannelKind
}

type Bucket = 'this' | 'next' | 'later' | 'earlier'
type Composer = { campaign: Campaign; kind: ChannelKind } | null

const GROUP_ORDER: { key: Bucket; label: string }[] = [
  { key: 'this', label: 'This week' },
  { key: 'next', label: 'Next week' },
  { key: 'later', label: 'Later' },
  { key: 'earlier', label: 'Earlier' },
]

const LEGEND: ChannelStatus[] = ['Ready', 'Scheduled', 'Published', 'Failed']

function bucketOf(date: string): Bucket {
  const b = weekBucket(date)
  return b === 'past' ? 'earlier' : b
}

function ChannelLine({ kind }: { kind: ChannelKind }) {
  return (
    <span className="flex items-center gap-1.5 text-[11.5px] text-text-muted">
      <ChannelIcon kind={kind} size={12} /> {CHANNEL_LABEL[kind]}
    </span>
  )
}

function ReadyRow({ entry, onSchedule }: { entry: ScheduleEntry; onSchedule: () => void }) {
  const navigate = useNavigate()
  const { campaign, kind } = entry
  return (
    <Card className="flex items-center justify-between gap-3 p-4">
      <button
        type="button"
        onClick={() => navigate(previewPath(campaign.id, kind))}
        className="flex min-w-0 flex-1 items-center gap-3 text-left"
      >
        {campaign.heroImage ? (
          <img src={campaign.heroImage} alt="" className="h-10 w-10 shrink-0 rounded-lg object-cover" />
        ) : (
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-purple-soft">
            <ChannelIcon kind={kind} size={16} className="text-violet" />
          </span>
        )}
        <div className="min-w-0">
          <p className="truncate text-[13.5px] font-semibold text-text">{campaign.name}</p>
          <div className="mt-1 flex items-center gap-2">
            <ChannelLine kind={kind} />
            <StatusChip status={campaign[kind].status} />
          </div>
        </div>
      </button>
      <Button variant="primary" size="sm" onClick={onSchedule}>
        <IconCalendar size={14} /> Schedule
      </Button>
    </Card>
  )
}

function ScheduledRow({ entry, onOpen }: { entry: ScheduleEntry; onOpen: () => void }) {
  const navigate = useNavigate()
  const { campaign, kind } = entry
  const ch = campaign[kind]
  const date = ch.scheduledDate!
  const wday = weekdayName(date).slice(0, 3).toUpperCase()

  return (
    <Card className="flex items-stretch gap-0 p-0">
      <div className="flex w-16 shrink-0 flex-col items-center justify-center gap-0.5 border-r border-[rgba(255,255,255,0.07)] py-4">
        <span className="micro text-[10px] text-violet">{wday}</span>
        <span className="font-display text-[16px] font-bold leading-none text-text">
          {new Date(`${date}T12:00:00`).getDate()}
        </span>
        {ch.scheduledTime && (
          <span className="mt-1 text-[9.5px] text-text-dim">{formatTime(ch.scheduledTime)}</span>
        )}
      </div>
      <button
        type="button"
        onClick={() => navigate(previewPath(campaign.id, kind))}
        className="min-w-0 flex-1 p-4 text-left"
      >
        <p className="line-clamp-1 text-[13.5px] font-semibold text-text">{campaign.name}</p>
        <p className="mt-1 line-clamp-1 text-[11.5px] text-text-muted">{captionOf(ch)}</p>
        <div className="mt-2.5 flex items-center gap-2">
          <ChannelLine kind={kind} />
          <StatusChip status={ch.status} />
        </div>
      </button>
      <div className="flex shrink-0 items-center pr-3">
        <button
          type="button"
          onClick={onOpen}
          className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-[13px] text-text-2 transition-colors hover:border-border-strong"
        >
          <IconClock size={13} className="text-violet-dim" />
          {ch.scheduledTime ? formatTime(ch.scheduledTime) : formatDate(date)}
        </button>
      </div>
    </Card>
  )
}

function PublishedRow({ entry }: { entry: ScheduleEntry }) {
  const navigate = useNavigate()
  const { campaign, kind } = entry
  const ch = campaign[kind]
  return (
    <Card interactive onClick={() => navigate(previewPath(campaign.id, kind))} className="flex items-center gap-3 p-4">
      {campaign.heroImage ? (
        <img src={campaign.heroImage} alt="" className="h-9 w-9 shrink-0 rounded-lg object-cover opacity-90" />
      ) : (
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-surface-soft">
          <ChannelIcon kind={kind} size={15} className="text-text-muted" />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-medium text-text-2">{campaign.name}</p>
        <ChannelLine kind={kind} />
      </div>
      <StatusChip status={ch.status} />
    </Card>
  )
}

export function SchedulingSpace() {
  const campaigns = useStore((s) => s.campaigns).filter((c) => !c.draft)
  const [composer, setComposer] = useState<Composer>(null)

  const entries: ScheduleEntry[] = campaigns.flatMap((c) =>
    CHANNEL_ORDER.filter((k) => channelApproved(c[k])).map((k) => ({ campaign: c, kind: k })),
  )

  const ready = entries
    .filter((e) => e.campaign[e.kind].status === 'Ready')
    .sort((a, b) => b.campaign.createdAt.localeCompare(a.campaign.createdAt))

  const scheduled = entries.filter((e) => e.campaign[e.kind].status === 'Scheduled')
  const grouped = GROUP_ORDER.map((g) => ({
    ...g,
    items: scheduled
      .filter((e) => bucketOf(e.campaign[e.kind].scheduledDate!) === g.key)
      .sort((a, b) => a.campaign[a.kind].scheduledDate!.localeCompare(b.campaign[b.kind].scheduledDate!)),
  })).filter((g) => g.items.length > 0)

  const published = entries.filter((e) => e.campaign[e.kind].status === 'Published')
  const failed = entries.filter((e) => e.campaign[e.kind].status === 'Failed')

  return (
    <div>
      <PageHeader
        eyebrow="03"
        title="Scheduling"
        subtitle="Ready posts waiting for a date, everything already queued, and what has gone live — across LinkedIn, Email and Article."
      />

      {/* status legend */}
      <div className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-border bg-surface px-4 py-2.5">
        <MicroLabel className="text-text-dim">Status</MicroLabel>
        {LEGEND.map((s) => (
          <span key={s} className="flex items-center gap-1.5">
            <StatusDot tone={statusTone(s)} size={7} />
            <span className="text-[11.5px] text-text-muted">{s}</span>
          </span>
        ))}
      </div>

      <section>
        <div className="flex items-center justify-between">
          <MicroLabel>Ready to schedule</MicroLabel>
          <MicroLabel className="text-text-dim">{ready.length}</MicroLabel>
        </div>
        {ready.length === 0 ? (
          <Card className="mt-3 p-4">
            <p className="text-[12.5px] leading-relaxed text-text-muted">
              Nothing waiting — approved content shows up here as soon as it&rsquo;s Ready.
            </p>
          </Card>
        ) : (
          <div className="mt-3 flex flex-col gap-3">
            {ready.map((e) => (
              <ReadyRow
                key={`${e.campaign.id}-${e.kind}`}
                entry={e}
                onSchedule={() => setComposer({ campaign: e.campaign, kind: e.kind })}
              />
            ))}
          </div>
        )}
      </section>

      <section className="mt-8">
        <MicroLabel>Scheduled</MicroLabel>
        {grouped.length === 0 ? (
          <Card className="mt-3 p-4">
            <p className="text-[12.5px] leading-relaxed text-text-muted">Nothing on the calendar yet.</p>
          </Card>
        ) : (
          <div className="mt-3 flex flex-col gap-6">
            {grouped.map((group) => (
              <div key={group.key}>
                <MicroLabel className="text-[9px] text-text-dim">{group.label}</MicroLabel>
                <div className="mt-3 flex flex-col gap-3">
                  {group.items.map((e) => (
                    <ScheduledRow
                      key={`${e.campaign.id}-${e.kind}`}
                      entry={e}
                      onOpen={() => setComposer({ campaign: e.campaign, kind: e.kind })}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {failed.length > 0 && (
        <section className="mt-8">
          <MicroLabel className="text-red">Needs attention</MicroLabel>
          <div className="mt-3 flex flex-col gap-3">
            {failed.map((e) => (
              <PublishedRow key={`${e.campaign.id}-${e.kind}`} entry={e} />
            ))}
          </div>
        </section>
      )}

      {published.length > 0 && (
        <section className="mt-8">
          <MicroLabel>Published</MicroLabel>
          <div className="mt-3 flex flex-col gap-2.5">
            {published.map((e) => (
              <PublishedRow key={`${e.campaign.id}-${e.kind}`} entry={e} />
            ))}
          </div>
        </section>
      )}

      {composer && (
        <ScheduleComposer
          campaign={composer.campaign}
          initialKind={composer.kind}
          onClose={() => setComposer(null)}
        />
      )}
    </div>
  )
}
