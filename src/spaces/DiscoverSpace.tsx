import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageHeader } from '../components/PageHeader'
import { Card } from '../components/Card'
import { Button } from '../components/Button'
import { MicroLabel } from '../components/MicroLabel'
import { IconSearch, IconExternal, IconSparkle, IconLinkedIn, IconPlus, IconCheck } from '../components/icons'
import { api, type DiscoveredPost, type HealthFlags, type Creator, type Freshness } from '../lib/api'
import {
  getTracked,
  setTracked as persistTracked,
  toggleTracked,
  upsertMany,
  trackedHandles,
  getRefreshedAt,
  markRefreshed,
} from '../lib/creators'
import { cn } from '../lib/cn'

const inputCls =
  'w-full rounded-lg border border-border bg-[rgba(255,255,255,0.02)] px-3 py-2.5 text-[14px] text-text ' +
  'placeholder:text-text-dim focus:outline-none focus-violet transition-colors disabled:opacity-50'

type Mode = 'topic' | 'creators'

function toSource(p: DiscoveredPost): string {
  return `${p.author} — on LinkedIn:\n\n"${p.snippet}"\n\n(Source: ${p.url})`
}

function ConnDot({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2 rounded-full border border-border px-3 py-1.5">
      <span className={cn('h-2 w-2 rounded-full', ok ? 'bg-[#54d98c]' : 'bg-text-dim')} />
      <span className="text-[12.5px] text-text-2">{label}</span>
    </div>
  )
}

/** Small two-option segmented control. */
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
    <div className="inline-flex w-fit rounded-lg border border-border p-0.5">
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

function timeAgo(ts: number): string {
  if (!ts) return 'never'
  const mins = Math.round((Date.now() - ts) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.round(hrs / 24)}d ago`
}

export function DiscoverSpace() {
  const navigate = useNavigate()
  const [topic, setTopic] = useState('')
  const [mode, setMode] = useState<Mode>('topic')
  const [freshness, setFreshness] = useState<Freshness>('week')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [posts, setPosts] = useState<DiscoveredPost[] | null>(null)
  const [health, setHealth] = useState<HealthFlags | null>(null)

  // tracked creators (localStorage) + last discovery leaderboard
  const [tracked, setTracked] = useState<Creator[]>([])
  const [discovered, setDiscovered] = useState<Creator[] | null>(null)
  const [discovering, setDiscovering] = useState(false)
  const [creatorsError, setCreatorsError] = useState('')
  const [refreshedAt, setRefreshedAt] = useState(0)

  useEffect(() => {
    api.health().then(setHealth).catch(() => setHealth(null))
    setTracked(getTracked())
    setRefreshedAt(getRefreshedAt())
  }, [])

  const trackedSet = new Set(tracked.map((c) => c.handle))

  async function runSearch() {
    if (loading) return
    setLoading(true)
    setError('')
    try {
      const { posts } = await api.searchPosts({
        topic: mode === 'topic' ? topic : undefined,
        mode,
        handles: mode === 'creators' ? trackedHandles() : undefined,
        freshness,
      })
      setPosts(posts)
    } catch (e) {
      setError((e as Error).message)
      setPosts(null)
    } finally {
      setLoading(false)
    }
  }

  async function findCreators() {
    if (discovering) return
    setDiscovering(true)
    setCreatorsError('')
    try {
      const { creators } = await api.discoverCreators({ freshness })
      setDiscovered(creators)
      const merged = upsertMany(creators) // auto-track the discovered set
      setTracked(merged)
      const now = Date.now()
      markRefreshed(now)
      setRefreshedAt(now)
    } catch (e) {
      setCreatorsError((e as Error).message)
    } finally {
      setDiscovering(false)
    }
  }

  function onToggle(c: Creator) {
    setTracked(toggleTracked(c))
  }

  function clearTracked() {
    persistTracked([])
    setTracked([])
  }

  function useThis(p: DiscoveredPost) {
    navigate('/studio', { state: { prefillSource: toSource(p) } })
  }

  const searchDisabled = loading || (!!health && !health.discover)
  const providerName =
    health?.discoverProvider === 'google'
      ? 'Google'
      : health?.discoverProvider === 'tavily'
        ? 'Tavily'
        : health?.discoverProvider === 'serper'
          ? 'Serper'
          : null
  const connLabel = !health
    ? 'Checking…'
    : health.discover && providerName
      ? `${providerName} connected`
      : 'Search key missing'

  const leaderboard = discovered ?? tracked

  return (
    <div>
      <PageHeader
        eyebrow="S1 · Discover — live"
        title="Find today's standout finance post"
        subtitle="Search public LinkedIn posts by topic, or auto-discover the finance voices worth tracking and scan their recent posts. Pick one, then hand it to Studio."
        right={<ConnDot ok={!!health?.discover} label={connLabel} />}
      />

      {/* search controls */}
      <Card solid className="mb-6 p-4">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <Segmented
              value={mode}
              onChange={setMode}
              options={[
                { value: 'topic', label: 'By topic' },
                { value: 'creators', label: 'Top creators' },
              ]}
            />
            <Segmented
              value={freshness}
              onChange={setFreshness}
              options={[
                { value: 'week', label: 'Past week' },
                { value: 'day', label: 'Today' },
              ]}
            />
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              className={inputCls}
              placeholder={
                mode === 'creators'
                  ? `Scanning ${tracked.length || 'your'} tracked creators…`
                  : 'e.g. unit economics, fundraising, margins, IPO…'
              }
              value={topic}
              disabled={mode === 'creators'}
              onChange={(e) => setTopic(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && runSearch()}
            />
            <Button variant="primary" onClick={runSearch} disabled={searchDisabled} className="shrink-0">
              <IconSearch size={16} />
              {loading ? 'Searching…' : 'Search'}
            </Button>
          </div>

          {!!health && !health.discover && (
            <p className="text-[11.5px] text-text-dim">
              Search key missing — add <code>GOOGLE_API_KEY</code> + <code>GOOGLE_CSE_ID</code> (or{' '}
              <code>SERPER_API_KEY</code> / <code>TAVILY_API_KEY</code>) and redeploy. See SETUP.md.
            </p>
          )}
          {error && (
            <p className="rounded-lg bg-[rgba(248,113,113,0.08)] px-3 py-2 text-[12.5px] text-[#f7a3a3] ring-1 ring-[rgba(248,113,113,0.2)]">
              {error}
            </p>
          )}
        </div>
      </Card>

      {/* creators leaderboard (creators mode) */}
      {mode === 'creators' && (
        <Card className="mb-6 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <MicroLabel tone="violet">Tracked creators · {tracked.length}</MicroLabel>
              <span className="micro text-text-dim">refreshed {timeAgo(refreshedAt)}</span>
            </div>
            <div className="flex items-center gap-2">
              {tracked.length > 0 && (
                <Button variant="ghost" size="sm" onClick={clearTracked}>
                  Clear
                </Button>
              )}
              <Button
                variant="subtle"
                size="sm"
                onClick={findCreators}
                disabled={discovering || (!!health && !health.creators)}
              >
                <IconSparkle size={14} />
                {discovering ? 'Finding…' : 'Find top creators'}
              </Button>
            </div>
          </div>

          {!!health && !health.creators && (
            <p className="mt-2 text-[11.5px] text-text-dim">
              Auto-discovery needs <code>GOOGLE_API_KEY</code> + <code>GOOGLE_CSE_ID</code> (or{' '}
              <code>SERPER_API_KEY</code>) — it reads the post handle + comment counts Google exposes.
            </p>
          )}
          {creatorsError && (
            <p className="mt-2 rounded-lg bg-[rgba(248,113,113,0.08)] px-3 py-2 text-[12.5px] text-[#f7a3a3] ring-1 ring-[rgba(248,113,113,0.2)]">
              {creatorsError}
            </p>
          )}

          {leaderboard.length === 0 ? (
            <p className="mt-3 max-w-[52ch] text-[13px] text-text-muted">
              No creators yet. Hit <strong>Find top creators</strong> — it runs broad finance searches
              and ranks the voices that show up most (by appearances + total comments). Or just{' '}
              <strong>Search</strong> to scan the built-in finance list.
            </p>
          ) : (
            <div className="mt-3 grid gap-1.5 sm:grid-cols-2">
              {leaderboard.map((c, i) => {
                const on = trackedSet.has(c.handle)
                return (
                  <div
                    key={c.handle}
                    className="flex items-center gap-3 rounded-lg border border-border bg-[rgba(255,255,255,0.02)] px-3 py-2"
                  >
                    <span className="micro w-5 shrink-0 text-center text-text-dim">{i + 1}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13.5px] font-medium text-text">{c.name}</p>
                      <p className="truncate text-[11.5px] text-text-dim">
                        {c.appearances} post{c.appearances === 1 ? '' : 's'} ·{' '}
                        {c.totalComments.toLocaleString()} comments
                      </p>
                    </div>
                    <button
                      onClick={() => onToggle(c)}
                      title={on ? 'Tracked — click to remove' : 'Add to tracked'}
                      className={cn(
                        'grid h-7 w-7 shrink-0 place-items-center rounded-md border transition-colors',
                        on
                          ? 'border-[rgba(84,217,140,0.4)] bg-[rgba(84,217,140,0.12)] text-[#54d98c]'
                          : 'border-border text-text-muted hover:text-text-2',
                      )}
                    >
                      {on ? <IconCheck size={14} /> : <IconPlus size={14} />}
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </Card>
      )}

      {/* results */}
      {!posts && !loading && (
        <Card className="grid min-h-[200px] place-items-center p-8 text-center">
          <div>
            <IconSearch size={26} className="mx-auto text-text-dim" />
            <p className="mt-3 text-[14px] text-text-muted">
              {mode === 'creators'
                ? 'Scan your tracked creators, or switch to a topic search.'
                : 'Search a finance topic to surface recent public posts.'}
            </p>
          </div>
        </Card>
      )}

      {loading && (
        <div className="grid gap-3 sm:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <Card key={i} className="h-[150px] animate-pulse p-5">
              <span className="sr-only">Loading…</span>
            </Card>
          ))}
        </div>
      )}

      {posts && !loading && posts.length === 0 && (
        <Card className="grid min-h-[180px] place-items-center p-8 text-center">
          <p className="max-w-[48ch] text-[14px] text-text-muted">
            No posts found — try another topic, widen the window to “Past week”, or scan “Top
            creators”. Search only sees <em>public</em> LinkedIn posts, so coverage is partial.
          </p>
        </Card>
      )}

      {posts && posts.length > 0 && (
        <>
          <div className="mb-3 flex items-center justify-between">
            <MicroLabel tone="violet">
              {posts.length} posts · {freshness === 'day' ? 'today' : 'past week'} · newest first
            </MicroLabel>
            <MicroLabel className="text-text-dim">public search</MicroLabel>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {posts.map((p) => (
              <Card key={p.url} className="flex flex-col p-5">
                <div className="mb-2 flex items-center gap-2">
                  <IconLinkedIn size={14} className="text-[#0a66c2]" />
                  <span className="truncate text-[13.5px] font-semibold text-text">{p.author}</span>
                  {p.date && <span className="ml-auto shrink-0 micro text-text-dim">{p.date}</span>}
                </div>
                <p className="line-clamp-4 text-[13.5px] leading-relaxed text-text-2">{p.snippet}</p>
                <div className="mt-4 flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <a
                      href={p.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 text-[12.5px] text-text-muted transition-colors hover:text-text-2"
                    >
                      <IconExternal size={14} />
                      LinkedIn
                    </a>
                    {!!p.comments && (
                      <span className="micro text-text-dim">· {p.comments.toLocaleString()} comments</span>
                    )}
                  </div>
                  <Button variant="subtle" size="sm" onClick={() => useThis(p)}>
                    <IconSparkle size={14} />
                    Use this → draft mine
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
