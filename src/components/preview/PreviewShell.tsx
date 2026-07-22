import { useStore } from '../../store/useStore'
import {
  type Campaign,
  type ChannelKind,
  CHANNEL_LABEL,
  CHANNEL_STATUS_FLOW,
  type ChannelStatus,
} from '../../types'
import { formatDate, SCHEDULE_OPTIONS } from '../../lib/date'
import { MicroLabel } from '../MicroLabel'
import { StatusChip } from '../StatusChip'
import { Menu, MenuItem } from '../Menu'
import { IconCalendar } from '../icons'

const SETTABLE_STATUSES: ChannelStatus[] = CHANNEL_STATUS_FLOW.filter((s) => s !== 'Scheduled')

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

      {/* Minimal actions: status and schedule */}
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
              {SCHEDULE_OPTIONS.map((opt) => {
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
      </div>
    </div>
  )
}
