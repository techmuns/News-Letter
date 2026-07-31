import { useStore } from '../../store/useStore'
import {
  type Campaign,
  type ChannelKind,
  CHANNEL_LABEL,
  CHANNEL_STATUS_FLOW,
  type ChannelStatus,
} from '../../types'
import { formatDate, weekdayIn } from '../../lib/date'
import { MicroLabel } from '../MicroLabel'
import { StatusChip } from '../StatusChip'
import { Menu, MenuItem } from '../Menu'
import { IconCalendar, IconExternal } from '../icons'

const SETTABLE_STATUSES: ChannelStatus[] = CHANNEL_STATUS_FLOW.filter((s) => s !== 'Scheduled')

const SCHEDULE_OPTS = [
  { label: 'This Mon', date: () => weekdayIn(0, 0) },
  { label: 'This Wed', date: () => weekdayIn(0, 2) },
  { label: 'This Fri', date: () => weekdayIn(0, 4) },
  { label: 'Next Mon', date: () => weekdayIn(1, 0) },
]

interface PreviewShellProps {
  campaign: Campaign
  kind: ChannelKind
  children: React.ReactNode
  onBack?: () => void
}

/** Wraps a channel preview with a minimal header + one or two controls. */
export function PreviewShell({ campaign, kind, children, onBack }: PreviewShellProps) {
  const setChannelStatus = useStore((s) => s.setChannelStatus)
  const scheduleChannel = useStore((s) => s.scheduleChannel)
  const ch = campaign[kind]

  return (
    <div className="animate-fade-up">
      {/* Minimal header */}
      <div className="mb-4">
        <div className="flex items-center justify-between gap-3">
          <MicroLabel tone="violet">{CHANNEL_LABEL[kind]}</MicroLabel>
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="micro text-text-muted hover:text-text-2 lg:hidden"
            >
              ‹ Back
            </button>
          )}
        </div>
        <h2 className="mt-2 font-display text-[20px] font-bold leading-snug tracking-tight text-text">
          {campaign.name}
        </h2>
      </div>

      {/* The rendered preview */}
      <div>{children}</div>

      {/* Attribution — whoever's words this was built from, and where to check them.
          Sits with the approver, not just inside the copy. */}
      {campaign.sources && campaign.sources.length > 0 && (
        <div className="mt-5 rounded-xl border border-border bg-[rgba(255,255,255,0.02)] p-4">
          <MicroLabel className="text-text-dim">Sourced from</MicroLabel>
          <ul className="mt-2.5 flex flex-col gap-2">
            {campaign.sources.map((source) => (
              <li key={source.url} className="text-[12.5px] leading-relaxed text-text-muted">
                <span className="text-text-2">{source.author}</span>
                <span className="text-text-dim"> · {source.authorRole}</span>
                <br />
                <a
                  href={source.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex items-center gap-1 text-violet-dim underline decoration-dotted underline-offset-2 transition-colors hover:text-violet"
                >
                  {source.title}
                  <IconExternal size={11} />
                </a>
                <span className="text-text-dim">
                  {' '}
                  — {source.outlet}
                  {source.publishedAt && `, ${source.publishedAt}`}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Minimal actions: status, and schedule for email only */}
      <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-[rgba(255,255,255,0.07)] pt-5">
        <Menu
          trigger={
            <span className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-[13px] text-text-2 transition-colors hover:border-border-strong">
              <MicroLabel className="text-text-dim">Status</MicroLabel>
              <StatusChip status={ch.status} />
            </span>
          }
        >
          {(close) => (
            <>
              {SETTABLE_STATUSES.map((s) => (
                <MenuItem
                  key={s}
                  active={s === ch.status}
                  onClick={() => {
                    setChannelStatus(campaign.id, kind, s)
                    close()
                  }}
                >
                  <StatusChip status={s} />
                </MenuItem>
              ))}
            </>
          )}
        </Menu>

        {kind === 'email' && (
          <Menu
            trigger={
              <span className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-[13px] text-text-2 transition-colors hover:border-border-strong">
                <IconCalendar size={14} className="text-violet-dim" />
                {ch.scheduledDate ? formatDate(ch.scheduledDate) : 'Schedule'}
              </span>
            }
          >
            {(close) => (
              <>
                {SCHEDULE_OPTS.map((opt) => {
                  const date = opt.date()
                  return (
                    <MenuItem
                      key={opt.label}
                      active={ch.scheduledDate === date}
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
        )}
      </div>
    </div>
  )
}
