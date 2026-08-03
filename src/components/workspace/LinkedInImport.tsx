import { useMemo, useState } from 'react'
import { cn } from '../../lib/cn'
import { useStore } from '../../store/useStore'
import { classifyLinkedInUrl } from '../../lib/linkedin'
import { scrapeLinkedInUrl } from '../../lib/scrapeApi'
import { Button } from '../Button'
import { MicroLabel } from '../MicroLabel'
import { IconLinkedIn, IconSparkle } from '../icons'

type Phase =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'done'; added: number; found: number; warnings: string[] }
  | { kind: 'error'; message: string }

const LIMITS = [3, 5, 10]

/**
 * Pulls real posts off LinkedIn via Firecrawl and drops them into the pile.
 *
 * LinkedIn blocks unauthenticated scrapers hard — an authwall comes back as a
 * 200, not an error — so "reached Firecrawl but got nothing" is a routine
 * outcome here and is reported as plainly as a success.
 */
export function LinkedInImport() {
  const addScrapedPosts = useStore((s) => s.addScrapedPosts)
  const [url, setUrl] = useState('')
  const [limit, setLimit] = useState(5)
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' })

  const target = useMemo(() => classifyLinkedInUrl(url), [url])
  const dirty = url.trim().length > 0
  const busy = phase.kind === 'loading'

  async function run() {
    if (!target || busy) return
    setPhase({ kind: 'loading' })
    try {
      const res = await scrapeLinkedInUrl(target.url, target.kind === 'post' ? undefined : limit)
      const added = addScrapedPosts(res.posts)
      setPhase({ kind: 'done', added, found: res.posts.length, warnings: res.warnings })
      if (added > 0) setUrl('')
    } catch (err) {
      setPhase({ kind: 'error', message: err instanceof Error ? err.message : 'Scrape failed.' })
    }
  }

  return (
    <div className="border-t border-border pt-5">
      <div className="flex items-center gap-2">
        <IconLinkedIn size={15} className="text-violet-dim" />
        <MicroLabel>Or pull a real post from LinkedIn</MicroLabel>
      </div>

      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <input
          value={url}
          onChange={(e) => {
            setUrl(e.target.value)
            if (phase.kind !== 'loading') setPhase({ kind: 'idle' })
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              void run()
            }
          }}
          spellCheck={false}
          placeholder="linkedin.com/posts/… or /in/someone or /company/…"
          className={cn(
            'min-w-0 flex-1 rounded-xl border bg-[rgba(255,255,255,0.02)] px-4 py-3',
            'text-[14px] text-text placeholder:text-text-dim',
            'focus-violet transition-all duration-[350ms] ease-premium',
            dirty && !target ? 'border-pink' : 'border-border',
          )}
        />

        {/* How many posts to pull — only meaningful for a feed page. */}
        {target && target.kind !== 'post' && (
          <select
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
            className={cn(
              'rounded-xl border border-border bg-[rgba(255,255,255,0.02)] px-3 py-3',
              'text-[13px] text-text-2 focus-violet transition-all duration-[350ms] ease-premium',
            )}
          >
            {LIMITS.map((n) => (
              <option key={n} value={n} className="bg-surface-solid">
                {n} posts
              </option>
            ))}
          </select>
        )}

        <Button variant="subtle" onClick={() => void run()} disabled={!target || busy}>
          <IconSparkle size={15} />
          {busy ? 'Scraping…' : 'Scrape'}
        </Button>
      </div>

      <div className="mt-2.5 min-h-[18px]">
        {dirty && !target && (
          <MicroLabel className="text-pink">
            Not a LinkedIn post, profile or company URL
          </MicroLabel>
        )}

        {target && phase.kind === 'idle' && (
          <MicroLabel className="text-text-dim">
            {target.kind === 'post'
              ? 'Single post — the most reliable thing to scrape'
              : `Recent posts from ${target.label} · feed pages are gated harder than permalinks`}
          </MicroLabel>
        )}

        {busy && (
          <MicroLabel className="micro-violet">
            Asking Firecrawl — LinkedIn can take a few seconds, or refuse outright
          </MicroLabel>
        )}

        {phase.kind === 'error' && <MicroLabel className="text-pink">{phase.message}</MicroLabel>}

        {phase.kind === 'done' && (
          <div className="space-y-1 animate-fade-up">
            <MicroLabel className={phase.added > 0 ? 'text-green' : 'text-amber'}>
              {phase.added > 0
                ? `Added ${phase.added} post${phase.added > 1 ? 's' : ''} to the pile`
                : phase.found > 0
                  ? 'Already in the pile — nothing new added'
                  : 'Nothing came through'}
            </MicroLabel>
            {phase.warnings.map((w, i) => (
              <p key={i} className="text-[11.5px] leading-relaxed text-text-muted">
                {w}
              </p>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
