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
import { IconCalendar } from '../icons'
import { Button } from '../Button'
import { useComposeTarget } from '../../store/useComposeTarget'

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
  const sendToCompose = useComposeTarget((s) => s.sendToCompose)
  const ch = campaign[kind]

  // The post text as it should actually go out. Daily Pulse stores the FULL
  // caption (hook + bullets + close + tags) in `body`, so prepending the
  // headline would repeat the hook — only prepend when the body doesn't already
  // open with it (e.g. the mock/seed campaigns, whose body is just the bullets).
  const linkedInText = (() => {
    if (kind !== 'linkedin') return ''
    const head = (campaign.linkedin.content.headline ?? '').trim()
    const body = (campaign.linkedin.content.body ?? '').trim()
    const firstBodyLine = body
      .split('\n')[0]
      .replace(/^(\s*\p{Extended_Pictographic}️?\s*)+/u, '')
      .trim()
    const bodyOpensWithHook =
      head.length > 0 && firstBodyLine.slice(0, 50).toLowerCase() === head.slice(0, 50).toLowerCase()
    return bodyOpensWithHook ? body : [head, body].filter(Boolean).join('\n\n')
  })()

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

      {/* Minimal actions: status, and schedule for email only */}
      <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-[rgba(255,255,255,0.07)] pt-5">
        {kind === 'linkedin' && linkedInText && (
          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              sendToCompose({
                text: linkedInText,
                headline: campaign.linkedin.content.headline,
                topic: campaign.topic,
                // Hand over the rendered market card so the compose box attaches
                // the SAME image the preview shows, not a re-rendered plain one.
                image: campaign.heroImage,
              })
              // The compose box lives above the split view on the same page.
              window.scrollTo({ top: 0, behavior: 'smooth' })
            }}
          >
            Use this draft ↑
          </Button>
        )}

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
