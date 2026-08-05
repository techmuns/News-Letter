import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageHeader } from '../components/PageHeader'
import { Card } from '../components/Card'
import { Button } from '../components/Button'
import { MicroLabel } from '../components/MicroLabel'
import { IconSearch, IconExternal, IconSparkle, IconLinkedIn } from '../components/icons'
import { api, type DiscoveredPost, type HealthFlags } from '../lib/api'
import { cn } from '../lib/cn'

const inputCls =
  'w-full rounded-lg border border-border bg-[rgba(255,255,255,0.02)] px-3 py-2.5 text-[14px] text-text ' +
  'placeholder:text-text-dim focus:outline-none focus-violet transition-colors disabled:opacity-50'

type Mode = 'topic' | 'creators'

/** Build the text handed to Studio as the source to riff on. */
function toSource(p: DiscoveredPost): string {
  return `${p.author} — on LinkedIn:\n\n"${p.snippet}"\n\n(Source: ${p.url})`
}

/** Serper/Tavily connection pill — green when a Discover key is wired. */
function ConnDot({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2 rounded-full border border-border px-3 py-1.5">
      <span className={cn('h-2 w-2 rounded-full', ok ? 'bg-[#54d98c]' : 'bg-text-dim')} />
      <span className="text-[12.5px] text-text-2">{label}</span>
    </div>
  )
}

export function DiscoverSpace() {
  const navigate = useNavigate()
  const [topic, setTopic] = useState('')
  const [mode, setMode] = useState<Mode>('topic')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [posts, setPosts] = useState<DiscoveredPost[] | null>(null)
  const [health, setHealth] = useState<HealthFlags | null>(null)

  useEffect(() => {
    api.health().then(setHealth).catch(() => setHealth(null))
  }, [])

  async function runSearch() {
    if (loading) return
    setLoading(true)
    setError('')
    try {
      const { posts } = await api.searchPosts({
        topic: mode === 'topic' ? topic : undefined,
        mode,
      })
      setPosts(posts)
    } catch (e) {
      setError((e as Error).message)
      setPosts(null)
    } finally {
      setLoading(false)
    }
  }

  function useThis(p: DiscoveredPost) {
    navigate('/studio', { state: { prefillSource: toSource(p) } })
  }

  const disabled = loading || (!!health && !health.discover)
  const provider = health?.discoverProvider === 'tavily' ? 'Tavily' : 'Serper'
  const connLabel = !health
    ? 'Checking…'
    : health.discover
      ? `${provider} connected`
      : `${provider} key missing`

  return (
    <div>
      <PageHeader
        eyebrow="S1 · Discover — live"
        title="Find today's standout finance post"
        subtitle="Searches public LinkedIn posts via Google (Serper) — by topic, or across a curated set of finance & fintech voices. Pick the one worth a Munshot take, then hand it to Studio."
        right={<ConnDot ok={!!health?.discover} label={connLabel} />}
      />

      {/* search controls */}
      <Card solid className="mb-6 p-4">
        <div className="flex flex-col gap-3">
          {/* mode toggle */}
          <div className="inline-flex w-fit rounded-lg border border-border p-0.5">
            {(['topic', 'creators'] as Mode[]).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={cn(
                  'rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors',
                  mode === m ? 'bg-[rgba(157,140,245,0.16)] text-violet' : 'text-text-muted hover:text-text-2',
                )}
              >
                {m === 'topic' ? 'By topic' : 'Top creators'}
              </button>
            ))}
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              className={inputCls}
              placeholder={
                mode === 'creators'
                  ? 'Scanning your curated finance creators…'
                  : 'e.g. unit economics, fundraising, margins, IPO…'
              }
              value={topic}
              disabled={mode === 'creators'}
              onChange={(e) => setTopic(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && runSearch()}
            />
            <Button variant="primary" onClick={runSearch} disabled={disabled} className="shrink-0">
              <IconSearch size={16} />
              {loading ? 'Searching…' : 'Discover'}
            </Button>
          </div>

          {mode === 'creators' && (
            <p className="text-[11.5px] text-text-dim">
              Searches recent public posts from the curated handle list (edit it in{' '}
              <code>functions/api/_lib/discover.ts</code>).
            </p>
          )}
          {!!health && !health.discover && (
            <p className="text-[11.5px] text-text-dim">
              Serper key missing — add <code>SERPER_API_KEY</code> (or <code>TAVILY_API_KEY</code>) and
              redeploy. See SETUP.md.
            </p>
          )}
          {error && (
            <p className="rounded-lg bg-[rgba(248,113,113,0.08)] px-3 py-2 text-[12.5px] text-[#f7a3a3] ring-1 ring-[rgba(248,113,113,0.2)]">
              {error}
            </p>
          )}
        </div>
      </Card>

      {/* results */}
      {!posts && !loading && (
        <Card className="grid min-h-[220px] place-items-center p-8 text-center">
          <div>
            <IconSearch size={26} className="mx-auto text-text-dim" />
            <p className="mt-3 text-[14px] text-text-muted">
              Search a topic, or scan your top creators, to surface recent finance posts.
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
            No posts found — try another topic (or the “Top creators” scan). Search only sees{' '}
            <em>public</em> LinkedIn posts, so coverage is partial.
          </p>
        </Card>
      )}

      {posts && posts.length > 0 && (
        <>
          <div className="mb-3 flex items-center justify-between">
            <MicroLabel tone="violet">{posts.length} posts · newest first</MicroLabel>
            <MicroLabel className="text-text-dim">public search · no engagement metrics</MicroLabel>
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
