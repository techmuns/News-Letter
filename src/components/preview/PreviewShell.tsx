import { useState } from 'react'
import { useStore } from '../../store/useStore'
import {
  type Campaign,
  type ChannelKind,
  CHANNEL_LABEL,
  CHANNEL_ORDER,
  CHANNEL_STATUS_FLOW,
  type ChannelStatus,
} from '../../types'
import { formatDate, weekdayIn } from '../../lib/date'
import { cn } from '../../lib/cn'
import { MicroLabel } from '../MicroLabel'
import { StatusChip } from '../StatusChip'
import { Menu, MenuItem } from '../Menu'
import { Button } from '../Button'
import { IconCalendar, IconSparkle } from '../icons'
import { ChannelEditor } from '../editor/ChannelEditor'

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

/** Wraps a channel preview with a preview/edit toggle and its controls. */
export function PreviewShell({ campaign, kind, children, onBack }: PreviewShellProps) {
  const setChannelStatus = useStore((s) => s.setChannelStatus)
  const scheduleChannel = useStore((s) => s.scheduleChannel)
  const regenerateCampaign = useStore((s) => s.regenerateCampaign)
  const generation = useStore((s) => s.generation)

  const [editing, setEditing] = useState(false)
  const [confirmRedraft, setConfirmRedraft] = useState(false)

  const ch = campaign[kind]
  const running = generation.status === 'running'
  const editedChannels = CHANNEL_ORDER.filter((k) => campaign[k].edited)

  async function redraft() {
    setConfirmRedraft(false)
    await regenerateCampaign(campaign.id)
  }

  return (
    <div className="animate-fade-up">
      {/* Minimal header */}
      <div className="mb-4">
        <div className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-2">
            <MicroLabel tone="violet">{CHANNEL_LABEL[kind]}</MicroLabel>
            {ch.edited && <MicroLabel className="text-amber">Edited</MicroLabel>}
          </span>
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

        {/* Preview / Edit toggle */}
        <div className="mt-3 inline-flex rounded-lg border border-border p-0.5">
          {(['preview', 'edit'] as const).map((mode) => {
            const active = (mode === 'edit') === editing
            return (
              <button
                key={mode}
                type="button"
                onClick={() => setEditing(mode === 'edit')}
                className={cn(
                  'rounded-[6px] px-3 py-1 text-[12.5px] font-medium capitalize transition-colors',
                  active
                    ? 'bg-[rgba(170,152,248,0.16)] text-violet'
                    : 'text-text-muted hover:text-text-2',
                )}
              >
                {mode}
              </button>
            )
          })}
        </div>
      </div>

      {/* The rendered preview, or the editor */}
      <div>{editing ? <ChannelEditor campaign={campaign} kind={kind} /> : children}</div>

      {/* Actions: status, schedule (email only), re-draft */}
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

        <Button
          variant="ghost"
          size="sm"
          disabled={running}
          onClick={() => (editedChannels.length ? setConfirmRedraft(true) : void redraft())}
        >
          <IconSparkle size={14} />
          {running ? 'Drafting…' : 'Re-draft all three'}
        </Button>
      </div>

      {/* A manual edit is never silently overwritten. */}
      {confirmRedraft && (
        <div className="mt-3 rounded-xl border border-[rgba(240,180,90,0.35)] bg-[rgba(240,180,90,0.07)] p-4 animate-fade-up">
          <MicroLabel className="text-amber">Overwrite manual edits?</MicroLabel>
          <p className="mt-2 text-[13px] leading-relaxed text-text-2">
            Re-drafting replaces all three channel versions from the original source material.
            You have edited{' '}
            <strong className="font-semibold text-text">
              {editedChannels.map((k) => CHANNEL_LABEL[k]).join(', ')}
            </strong>
            {editedChannels.length === 1 ? ' — that edit' : ' — those edits'} will be lost.
          </p>
          <div className="mt-3 flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setConfirmRedraft(false)}>
              Keep my edits
            </Button>
            <Button variant="primary" size="sm" onClick={() => void redraft()}>
              Overwrite and re-draft
            </Button>
          </div>
        </div>
      )}

      {generation.status === 'error' && (
        <p className="mt-3 rounded-xl border border-[rgba(255,120,120,0.3)] bg-[rgba(255,120,120,0.07)] px-4 py-3 text-[13px] leading-relaxed text-[#ffb4b4]">
          {generation.message}
        </p>
      )}
    </div>
  )
}
