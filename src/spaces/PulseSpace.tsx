import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageHeader } from '../components/PageHeader'
import { Card } from '../components/Card'
import { Button } from '../components/Button'
import { MicroLabel } from '../components/MicroLabel'
import { IconSparkle } from '../components/icons'
import { api, type PulseItem, type PulseGroup, type PulseFeed, type HealthFlags } from '../lib/api'
import { DailyPulseComposer } from './pulse/DailyPulseComposer'
import { cn } from '../lib/cn'

type GroupFilter = 'all' | PulseGroup

const GROUP_LABEL: Record<PulseGroup, string> = {
  index: 'Index',
  currency: 'Currency',
  commodity: 'Commodity',
  holding: 'Holding',
}

const pct = (n: number) => `${n > 0 ? '+' : ''}${n.toFixed(2)}%`
const fmt = (n: number) => n.toLocaleString('en-IN', { maximumFractionDigits: 2 })

function deltaColor(n: number): string {
  if (n > 0.001) return 'text-[#54d98c]'
  if (n < -0.001) return 'text-[#f7a3a3]'
  return 'text-text-dim'
}

function timeAgo(iso: string): string {
  const t = Date.parse(iso)
  if (!t) return ''
  const mins = Math.round((Date.now() - t) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.round(hrs / 24)}d ago`
}

/** The exact text handed to Studio → Claude when you pick an item. */
function toSource(it: PulseItem, fetchedAt: string): string {
  const unit = it.unit ? ` ${it.unit}` : ''
  const sector = it.sector ? ` · ${it.sector}` : ''
  const asOf = fetchedAt ? new Date(fetchedAt).toLocaleString() : 'today'
  return [
    `Munshot Daily Market Pulse — ${it.name}${sector} [${it.ticker}]`,
    `Level: ${fmt(it.current)}${unit}`,
    `Move: ${pct(it.d1)} today · ${pct(it.d5)} over 5 days · ${pct(it.m1)} over 1 month`,
    `As of ${asOf}. (Source: Munshot Daily Market Pulse dashboard.)`,
  ].join('\n')
}

function Sparkline({ points, up }: { points: number[]; up: boolean }) {
  if (points.length < 2) return null
  const w = 84
  const h = 26
  const min = Math.min(...points)
  const max = Math.max(...points)
  const span = max - min || 1
  const d = points
    .map((p, i) => {
      const x = (i / (points.length - 1)) * w
      const y = h - ((p - min) / span) * h
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="shrink-0" aria-hidden>
      <path
        d={d}
        fill="none"
        stroke={up ? '#54d98c' : '#f7a3a3'}
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
        opacity={0.9}
      />
    </svg>
  )
}

function ConnDot({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2 rounded-full border border-border px-3 py-1.5">
      <span className={cn('h-2 w-2 rounded-full', ok ? 'bg-[#54d98c]' : 'bg-text-dim')} />
      <span className="text-[12.5px] text-text-2">{label}</span>
    </div>
  )
}

function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
}) {
  return (
    <div className="inline-flex w-fit flex-wrap rounded-lg border border-border p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors',
            value === o.value ? 'bg-[rgba(157,140,245,0.16)] text-violet' : 'text-text-muted hover:text-text-2',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function PulseSpace() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [feed, setFeed] = useState<PulseFeed | null>(null)
  const [filter, setFilter] = useState<GroupFilter>('all')
  const [health, setHealth] = useState<HealthFlags | null>(null)

  async function load() {
    setLoading(true)
    setError('')
    try {
      const res = await api.dailyPulse()
      setFeed({ fetchedAt: res.fetchedAt, items: res.items })
    } catch (e) {
      setError((e as Error).message)
      setFeed(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    api.health().then(setHealth).catch(() => setHealth(null))
    load()
  }, [])

  function useThis(it: PulseItem) {
    navigate('/studio', { state: { prefillSource: toSource(it, feed?.fetchedAt || '') } })
  }

  const items = useMemo(
    () => (feed?.items || []).filter((it) => filter === 'all' || it.group === filter),
    [feed, filter],
  )

  const freshLabel = feed?.fetchedAt
    ? `Live · updated ${timeAgo(feed.fetchedAt)}`
    : loading
      ? 'Loading…'
      : 'Daily Pulse'

  return (
    <div>
      <PageHeader
        eyebrow="S1 · Daily Pulse — live"
        title="Today's Daily Pulse"
        subtitle="The latest snapshot from your Daily Market Pulse dashboard. Pick a move that matters, then hand it to Studio to draft a branded LinkedIn post + email."
        right={<ConnDot ok={!!feed} label={freshLabel} />}
      />

      {feed && <DailyPulseComposer feed={feed} health={health} />}

      {feed && (
        <div className="mb-4 mt-9 flex items-center gap-3">
          <MicroLabel tone="violet">Today's market data</MicroLabel>
          <span className="h-px flex-1 bg-border" />
          <span className="micro text-text-dim">the feed your post is built from</span>
        </div>
      )}

      <Card solid className="mb-6 flex flex-wrap items-center justify-between gap-3 p-4">
        <Segmented
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all', label: 'All' },
            { value: 'index', label: 'Indices' },
            { value: 'currency', label: 'Currencies' },
            { value: 'commodity', label: 'Commodities' },
            { value: 'holding', label: 'Holdings' },
          ]}
        />
        <Button variant="subtle" size="sm" onClick={load} disabled={loading}>
          {loading ? 'Refreshing…' : 'Refresh'}
        </Button>
      </Card>

      {error && (
        <Card className="mb-6 p-4">
          <p className="rounded-lg bg-[rgba(248,113,113,0.08)] px-3 py-2 text-[12.5px] text-[#f7a3a3] ring-1 ring-[rgba(248,113,113,0.2)]">
            {error}
          </p>
          <p className="mt-2 text-[11.5px] text-text-dim">
            The feed is <code>public/data/live.json</code> from the Daily Market Pulse repo. Override
            the source with <code>DAILY_PULSE_URL</code> if you moved it. See SETUP.md.
          </p>
        </Card>
      )}

      {loading && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Card key={i} className="h-[150px] animate-pulse p-5">
              <span className="sr-only">Loading…</span>
            </Card>
          ))}
        </div>
      )}

      {!loading && feed && items.length === 0 && (
        <Card className="grid min-h-[180px] place-items-center p-8 text-center">
          <p className="text-[14px] text-text-muted">No items in this group right now.</p>
        </Card>
      )}

      {!loading && items.length > 0 && (
        <>
          <div className="mb-3 flex items-center justify-between">
            <MicroLabel tone="violet">{items.length} items · biggest movers first</MicroLabel>
            <MicroLabel className="text-text-dim">Daily Market Pulse</MicroLabel>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((it) => {
              const up = it.d1 >= 0
              return (
                <Card key={it.id} className="flex flex-col p-5">
                  <div className="mb-1 flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-[14px] font-semibold text-text">{it.name}</p>
                      <p className="truncate text-[11.5px] text-text-dim">
                        {GROUP_LABEL[it.group]}
                        {it.sector ? ` · ${it.sector}` : ''} · {it.ticker}
                      </p>
                    </div>
                    <Sparkline points={it.spark} up={up} />
                  </div>

                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-[19px] font-semibold tabular-nums text-text">{fmt(it.current)}</span>
                    {it.unit && <span className="text-[11px] text-text-dim">{it.unit}</span>}
                    <span className={cn('ml-auto text-[14px] font-semibold tabular-nums', deltaColor(it.d1))}>
                      {pct(it.d1)}
                    </span>
                  </div>

                  <div className="mt-1.5 flex items-center gap-3 text-[11.5px] text-text-muted">
                    <span>
                      5d <span className={cn('tabular-nums', deltaColor(it.d5))}>{pct(it.d5)}</span>
                    </span>
                    <span>
                      1m <span className={cn('tabular-nums', deltaColor(it.m1))}>{pct(it.m1)}</span>
                    </span>
                  </div>

                  <div className="mt-4 flex justify-end">
                    <Button variant="subtle" size="sm" onClick={() => useThis(it)}>
                      <IconSparkle size={14} />
                      Use this → draft mine
                    </Button>
                  </div>
                </Card>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
