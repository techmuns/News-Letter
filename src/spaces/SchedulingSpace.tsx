import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore'
import { previewPath } from '../lib/routes'
import { formatDate, weekdayName, weekBucket, SCHEDULE_OPTIONS } from '../lib/date'
import { type Campaign, type ChannelKind, CHANNEL_ORDER, CHANNEL_LABEL, channelApproved } from '../types'
import { PageHeader } from '../components/PageHeader'
import { MicroLabel } from '../components/MicroLabel'
import { Card } from '../components/Card'
import { StatusChip } from '../components/StatusChip'
import { Menu, MenuItem } from '../components/Menu'
import { ChannelIcon, IconCalendar } from '../components/icons'

interface ScheduleEntry {
  campaign: Campaign
  kind: ChannelKind
}

type Bucket = 'this' | 'next' | 'later' | 'earlier'

const GROUP_ORDER: { key: Bucket; label: string }[] = [
  { key: 'this', label: 'This week' },
  { key: 'next', label: 'Next week' },
  { key: 'later', label: 'Later' },
  { key: 'earlier', label: 'Earlier' },
]

function bucketOf(date: string): Bucket {
  const b = weekBucket(date)
  return b === 'past' ? 'earlier' : b
}

function ReadyRow({ entry }: { entry: ScheduleEntry }) {
  const scheduleChannel = useStore((s) => s.scheduleChannel)
  const navigate = useNavigate()
  const { campaign, kind } = entry
  const ch = campaign[kind]

  return (
    <Card className="flex items-center justify-between gap-3 p-4">
      <button
        type="button"
        onClick={() => navigate(previewPath(campaign.id, kind))}
        className="flex min-w-0 flex-1 items-center gap-3 text-left"
      >
        <ChannelIcon kind={kind} size={16} className="shrink-0 text-text-muted" />
        <div className="min-w-0">
          <p className="truncate text-[13.5px] font-semibold text-text">{campaign.name}</p>
          <div className="mt-1 flex items-center gap-1.5">
            <MicroLabel className="text-text-dim">{CHANNEL_LABEL[kind]}</MicroLabel>
            <StatusChip status={ch.status} />
          </div>
        </div>
      </button>
      <Menu
        align="right"
        trigger={
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-[rgba(170,152,248,0.4)] bg-[rgba(170,152,248,0.12)] px-3 py-1.5 text-[13px] font-medium text-violet transition-colors hover:bg-[rgba(170,152,248,0.2)]">
            <IconCalendar size={14} /> Schedule
          </span>
        }
      >
        {(close) => (
          <>
            {SCHEDULE_OPTIONS.map((opt) => {
              const date = opt.date()
              return (
                <MenuItem
                  key={opt.label}
                  onClick={() => {
                    scheduleChannel(campaign.id, kind, date)
                    close()
                  }}
                >
                  <span className="flex w-full items-center justify-between gap-4">
                    <span>{opt.label}</span>
                    <span className="micro text-text-dim">{formatDate(date)}</span>
                  </span>
                </MenuItem>
              )
            })}
          </>
        )}
      </Menu>
    </Card>
  )
}

function ScheduledRow({ entry }: { entry: ScheduleEntry }) {
  const scheduleChannel = useStore((s) => s.scheduleChannel)
  const unscheduleChannel = useStore((s) => s.unscheduleChannel)
  const navigate = useNavigate()
  const { campaign, kind } = entry
  const ch = campaign[kind]
  const date = ch.scheduledDate!
  const wday = weekdayName(date).slice(0, 3).toUpperCase()

  return (
    <Card className="flex items-stretch gap-0 p-0">
      <div className="flex w-16 shrink-0 flex-col items-center justify-center gap-1 border-r border-[rgba(255,255,255,0.07)] py-4">
        <span className="micro text-[10px] text-violet">{wday}</span>
        <span className="font-display text-[16px] font-bold leading-none text-text">
          {new Date(`${date}T12:00:00`).getDate()}
        </span>
      </div>
      <button
        type="button"
        onClick={() => navigate(previewPath(campaign.id, kind))}
        className="min-w-0 flex-1 p-4 text-left"
      >
        <p className="line-clamp-1 text-[13.5px] font-semibold text-text">{campaign.name}</p>
        <p className="mt-1 flex items-center gap-1.5 text-[11.5px] text-text-muted">
          <ChannelIcon kind={kind} size={12} /> {CHANNEL_LABEL[kind]}
        </p>
        <div className="mt-2.5">
          <StatusChip status={ch.status} />
        </div>
      </button>
      <div className="flex shrink-0 items-center pr-3">
        <Menu
          align="right"
          trigger={
            <span className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-[13px] text-text-2 transition-colors hover:border-border-strong">
              {formatDate(date)}
            </span>
          }
        >
          {(close) => (
            <>
              {SCHEDULE_OPTIONS.map((opt) => {
                const d = opt.date()
                return (
                  <MenuItem
                    key={opt.label}
                    active={d === date}
                    onClick={() => {
                      scheduleChannel(campaign.id, kind, d)
                      close()
                    }}
                  >
                    <span className="flex w-full items-center justify-between gap-4">
                      <span>{opt.label}</span>
                      <span className="micro text-text-dim">{formatDate(d)}</span>
                    </span>
                  </MenuItem>
                )
              })}
              <div className="my-1 border-t border-border" />
              <MenuItem
                onClick={() => {
                  unscheduleChannel(campaign.id, kind)
                  close()
                }}
              >
                <span className="text-text-muted">Move back to Ready</span>
              </MenuItem>
            </>
          )}
        </Menu>
      </div>
    </Card>
  )
}

export function SchedulingSpace() {
  const campaigns = useStore((s) => s.campaigns)

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

  return (
    <div>
      <PageHeader
        eyebrow="03"
        title="Scheduling"
        subtitle="Ready posts waiting for a send date, plus everything already queued across LinkedIn, Email and Article."
      />

      <section>
        <div className="flex items-center justify-between">
          <MicroLabel>Ready to schedule</MicroLabel>
          <MicroLabel className="text-text-dim">{ready.length}</MicroLabel>
        </div>
        {ready.length === 0 ? (
          <Card className="mt-3 p-4">
            <p className="text-[12.5px] leading-relaxed text-text-muted">
              Nothing waiting — approved content shows up here as soon as it's Ready.
            </p>
          </Card>
        ) : (
          <div className="mt-3 flex flex-col gap-3">
            {ready.map((e) => (
              <ReadyRow key={`${e.campaign.id}-${e.kind}`} entry={e} />
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
                    <ScheduledRow key={`${e.campaign.id}-${e.kind}`} entry={e} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
