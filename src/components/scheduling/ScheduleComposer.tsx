import { useState } from 'react'
import { cn } from '../../lib/cn'
import { useStore } from '../../store/useStore'
import {
  type Campaign,
  type ChannelKind,
  CHANNEL_ORDER,
  CHANNEL_LABEL,
  channelApproved,
  captionOf,
} from '../../types'
import { formatDate, formatTime, SCHEDULE_OPTIONS } from '../../lib/date'
import { Modal } from '../Modal'
import { MicroLabel } from '../MicroLabel'
import { Button } from '../Button'
import { ChannelIcon, IconCheck, IconClock } from '../icons'

interface ScheduleComposerProps {
  campaign: Campaign
  initialKind: ChannelKind
  onClose: () => void
}

const TIME_PRESETS = ['08:00', '09:00', '12:30', '17:00']

/**
 * The scheduling composer — carries the selected post forward from Preview and
 * lets the author set date + time, pick one or more channels, review and modify
 * each channel's caption, then confirm.
 */
export function ScheduleComposer({ campaign, initialKind, onClose }: ScheduleComposerProps) {
  const scheduleChannelAt = useStore((s) => s.scheduleChannelAt)
  const setChannelCaption = useStore((s) => s.setChannelCaption)
  const unscheduleChannel = useStore((s) => s.unscheduleChannel)

  const approvedKinds = CHANNEL_ORDER.filter((k) => channelApproved(campaign[k]))
  const initCh = campaign[initialKind]

  const [date, setDate] = useState(initCh.scheduledDate ?? SCHEDULE_OPTIONS[0].date())
  const [time, setTime] = useState(initCh.scheduledTime ?? '09:00')
  const [kinds, setKinds] = useState<Set<ChannelKind>>(() => new Set([initialKind]))
  const [captions, setCaptions] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {}
    for (const k of approvedKinds) map[k] = captionOf(campaign[k])
    return map
  })

  const selected = CHANNEL_ORDER.filter((k) => kinds.has(k))
  const canConfirm = selected.length > 0 && !!date && !!time
  const isScheduled = initCh.status === 'Scheduled'

  function toggleKind(k: ChannelKind) {
    setKinds((prev) => {
      const next = new Set(prev)
      next.has(k) ? next.delete(k) : next.add(k)
      return next
    })
  }

  function confirm() {
    for (const k of selected) {
      setChannelCaption(campaign.id, k, captions[k])
      scheduleChannelAt(campaign.id, k, date, time)
    }
    onClose()
  }

  const inputCls =
    'rounded-lg border border-border bg-bg px-3 py-2 text-[13.5px] text-text focus-violet transition-colors'

  return (
    <Modal
      open
      onClose={onClose}
      title="Schedule post"
      footer={
        <div className="flex items-center gap-2.5">
          {isScheduled && (
            <Button
              variant="ghost"
              size="md"
              onClick={() => {
                unscheduleChannel(campaign.id, initialKind)
                onClose()
              }}
            >
              Unschedule
            </Button>
          )}
          <span className="ml-auto flex items-center gap-2.5">
            <Button variant="ghost" size="md" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="primary" size="md" disabled={!canConfirm} onClick={confirm}>
              <IconCheck size={15} /> Confirm schedule
            </Button>
          </span>
        </div>
      }
    >
      {/* post summary — carried forward from Preview */}
      <div className="flex items-center gap-3 rounded-xl border border-border bg-surface p-3">
        {campaign.heroImage ? (
          <img src={campaign.heroImage} alt="" className="h-11 w-11 shrink-0 rounded-lg object-cover" />
        ) : (
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-purple-soft text-violet">
            <ChannelIcon kind={initialKind} size={18} />
          </span>
        )}
        <div className="min-w-0">
          <p className="truncate text-[13.5px] font-semibold text-text">{campaign.name}</p>
          <p className="truncate text-[11.5px] text-text-muted">{campaign.topic}</p>
        </div>
      </div>

      {/* when */}
      <div className="mt-5">
        <MicroLabel className="text-text-dim">Date &amp; time</MicroLabel>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />
          <span className="relative inline-flex items-center">
            <IconClock size={14} className="pointer-events-none absolute left-2.5 text-text-dim" />
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className={cn(inputCls, 'pl-8')}
            />
          </span>
        </div>
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {SCHEDULE_OPTIONS.slice(0, 4).map((o) => {
            const d = o.date()
            return (
              <button
                key={o.label}
                type="button"
                onClick={() => setDate(d)}
                className={cn(
                  'rounded-md border px-2 py-0.5 text-[11px] transition-colors',
                  date === d
                    ? 'border-[rgba(145,71,245,0.5)] bg-purple-soft text-violet'
                    : 'border-border text-text-muted hover:text-text-2',
                )}
              >
                {o.label}
              </button>
            )
          })}
          {TIME_PRESETS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTime(t)}
              className={cn(
                'rounded-md border px-2 py-0.5 text-[11px] transition-colors',
                time === t
                  ? 'border-[rgba(145,71,245,0.5)] bg-purple-soft text-violet'
                  : 'border-border text-text-muted hover:text-text-2',
              )}
            >
              {formatTime(t)}
            </button>
          ))}
        </div>
      </div>

      {/* channels */}
      <div className="mt-5">
        <MicroLabel className="text-text-dim">Channels</MicroLabel>
        <div className="mt-2 flex flex-wrap gap-2">
          {approvedKinds.map((k) => {
            const on = kinds.has(k)
            return (
              <button
                key={k}
                type="button"
                onClick={() => toggleKind(k)}
                aria-pressed={on}
                className={cn(
                  'inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-[13px] transition-colors',
                  on
                    ? 'border-[rgba(145,71,245,0.5)] bg-purple-soft text-violet'
                    : 'border-border text-text-muted hover:border-border-strong hover:text-text-2',
                )}
              >
                <ChannelIcon kind={k} size={14} />
                {CHANNEL_LABEL[k]}
                <span
                  className={cn(
                    'grid h-4 w-4 place-items-center rounded border',
                    on ? 'border-transparent bg-violet text-[#160c26]' : 'border-border text-transparent',
                  )}
                >
                  <IconCheck size={10} />
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* caption review per selected channel */}
      <div className="mt-5">
        <MicroLabel className="text-text-dim">Review &amp; edit caption</MicroLabel>
        <div className="mt-2 flex flex-col gap-3">
          {selected.length === 0 && (
            <p className="text-[12.5px] text-text-muted">Select at least one channel to schedule.</p>
          )}
          {selected.map((k) => (
            <div key={k} className="rounded-xl border border-border bg-surface p-3">
              <div className="mb-2 flex items-center gap-2">
                <ChannelIcon kind={k} size={13} className="text-violet-dim" />
                <MicroLabel className="text-text-2">{CHANNEL_LABEL[k]}</MicroLabel>
              </div>
              <textarea
                value={captions[k] ?? ''}
                onChange={(e) => setCaptions((c) => ({ ...c, [k]: e.target.value }))}
                rows={k === 'linkedin' ? 4 : 2}
                className="w-full resize-y rounded-lg border border-border bg-bg px-3 py-2 text-[13px] leading-relaxed text-text focus-violet"
              />
            </div>
          ))}
        </div>
      </div>

      {/* summary */}
      {canConfirm && (
        <p className="mt-4 text-[12px] text-text-muted">
          Scheduling {selected.map((k) => CHANNEL_LABEL[k]).join(', ')} for{' '}
          <span className="text-text-2">{formatDate(date)}</span> at{' '}
          <span className="text-text-2">{formatTime(time)}</span>.
        </p>
      )}
    </Modal>
  )
}
