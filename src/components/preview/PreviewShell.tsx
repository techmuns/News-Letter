import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../../store/useStore'
import {
  type Campaign,
  type ChannelKind,
  CHANNEL_LABEL,
  CHANNEL_STATUS_FLOW,
  type ChannelStatus,
} from '../../types'
import { formatDate, weekdayIn } from '../../lib/date'
import { channelPath } from '../../lib/routes'
import { cn } from '../../lib/cn'
import { MicroLabel } from '../MicroLabel'
import { StatusChip } from '../StatusChip'
import { ChannelChips } from '../ChannelChips'
import { Button } from '../Button'
import { Menu, MenuItem } from '../Menu'
import { ConfirmDialog } from '../ConfirmDialog'
import { StatusDot } from '../StatusDot'
import { IconCalendar, IconSparkle, IconCheck } from '../icons'

const SETTABLE_STATUSES: ChannelStatus[] = CHANNEL_STATUS_FLOW.filter(
  (s) => s !== 'Scheduled',
)

const SCHEDULE_OPTS = [
  { label: 'This Mon', date: () => weekdayIn(0, 0) },
  { label: 'This Wed', date: () => weekdayIn(0, 2) },
  { label: 'This Fri', date: () => weekdayIn(0, 4) },
  { label: 'Next Mon', date: () => weekdayIn(1, 0) },
  { label: 'Next Wed', date: () => weekdayIn(1, 2) },
  { label: 'Next Fri', date: () => weekdayIn(1, 4) },
]

interface PreviewShellProps {
  campaign: Campaign
  kind: ChannelKind
  children: React.ReactNode
  /** back-to-list handler for mobile */
  onBack?: () => void
}

export function PreviewShell({ campaign, kind, children, onBack }: PreviewShellProps) {
  const navigate = useNavigate()
  const setChannelStatus = useStore((s) => s.setChannelStatus)
  const scheduleChannel = useStore((s) => s.scheduleChannel)
  const markChannelEdited = useStore((s) => s.markChannelEdited)
  const regenerateChannel = useStore((s) => s.regenerateChannel)

  const [regenerating, setRegenerating] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)

  const ch = campaign[kind]

  function runRegen() {
    setRegenerating(true)
    window.setTimeout(() => {
      regenerateChannel(campaign.id, kind)
      setRegenerating(false)
    }, 1400)
  }

  function onRegenerateClick() {
    if (ch.edited) setConfirmOpen(true)
    else runRegen()
  }

  return (
    <div className="animate-fade-up">
      {/* Linkage meta header */}
      <div className="mb-4 flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <MicroLabel tone="violet">
            {CHANNEL_LABEL[kind]} · {campaign.topic}
          </MicroLabel>
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
        <h2 className="font-display text-[20px] font-bold leading-snug tracking-tight text-text">
          {campaign.name}
        </h2>
        <div className="flex flex-wrap items-center gap-3">
          <StatusChip status={ch.status} pill />
          {ch.scheduledDate && (
            <span className="inline-flex items-center gap-1.5">
              <IconCalendar size={13} className="text-violet-dim" />
              <MicroLabel className="text-text-2">{formatDate(ch.scheduledDate)}</MicroLabel>
            </span>
          )}
          {ch.edited && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[rgba(157,140,245,0.3)] px-2 py-0.5">
              <span className="h-1.5 w-1.5 rounded-full bg-violet" />
              <MicroLabel className="micro-violet">Manually edited</MicroLabel>
            </span>
          )}
          <span className="ml-auto">
            <MicroLabel className="mr-2 text-text-dim">Linked</MicroLabel>
            <span className="inline-block align-middle">
              <ChannelChips campaign={campaign} deepLink />
            </span>
          </span>
        </div>
      </div>

      {/* The rendered channel preview (with regenerating overlay) */}
      <div className="relative">
        <div className={cn(regenerating && 'pointer-events-none opacity-40 blur-[1px]')}>
          {children}
        </div>
        {regenerating && (
          <div className="absolute inset-0 grid place-items-center">
            <div className="glow-active flex items-center gap-2.5 rounded-full px-4 py-2">
              <StatusDot tone="pink" pulse size={8} />
              <MicroLabel className="text-pink">Regenerating draft…</MicroLabel>
            </div>
          </div>
        )}
      </div>

      {/* Channel actions — status · schedule · edit-guard · regenerate */}
      <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-[rgba(255,255,255,0.06)] pt-5">
        {/* status */}
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
              <div className="px-3 pb-1.5 pt-1">
                <MicroLabel>Set status</MicroLabel>
              </div>
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

        {/* schedule */}
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
              <div className="px-3 pb-1.5 pt-1">
                <MicroLabel>Schedule send</MicroLabel>
              </div>
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

        {/* edit guard toggle */}
        <Button
          variant={ch.edited ? 'subtle' : 'ghost'}
          size="sm"
          onClick={() => markChannelEdited(campaign.id, kind, !ch.edited)}
        >
          {ch.edited ? (
            <>
              <IconCheck size={14} /> Edited
            </>
          ) : (
            'Mark as edited'
          )}
        </Button>

        <div className="ml-auto flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onRegenerateClick} disabled={regenerating}>
            <IconSparkle size={14} /> Regenerate
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => navigate(channelPath(kind))}
            className="hidden sm:inline-flex"
          >
            Done
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        tone="amber"
        title="This version was edited by hand"
        body="Regenerating will overwrite the manual edits on this channel version. The other two channels are untouched. Continue?"
        confirmLabel="Overwrite & regenerate"
        cancelLabel="Keep my edits"
        onConfirm={() => {
          setConfirmOpen(false)
          runRegen()
        }}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  )
}
