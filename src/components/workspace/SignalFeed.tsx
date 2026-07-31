import { useEffect, useMemo, useState } from 'react'
import { cn } from '../../lib/cn'
import { relativeTime } from '../../lib/date'
import { useStore } from '../../store/useStore'
import { fetchHarvestStatus } from '../../lib/harvestClient'
import { FINANCE_VOICES, type FinanceVoice } from '../../../shared/voices'
import { Button } from '../Button'
import { Card } from '../Card'
import { MicroLabel } from '../MicroLabel'
import { StatusDot } from '../StatusDot'
import { IconGlobe, IconRefresh, IconSparkle } from '../icons'

/* ---- roster chip ---- */

function VoiceChip({
  voice,
  selected,
  onToggle,
}: {
  voice: FinanceVoice
  selected: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={selected}
      title={`${voice.name} — ${voice.role} · ${voice.listingUrl}`}
      className={cn(
        'flex items-center gap-2 rounded-full border py-1 pl-1 pr-3 text-left',
        'transition-all duration-[350ms] ease-premium focus-violet',
        selected
          ? 'border-[rgba(170,152,248,0.45)] bg-[rgba(170,152,248,0.12)]'
          : 'border-border bg-transparent hover:border-border-strong',
      )}
    >
      <span
        className={cn(
          'grid h-6 w-6 shrink-0 place-items-center rounded-full text-[10px] font-semibold',
          selected ? 'bg-violet text-[#211a33]' : 'bg-[rgba(255,255,255,0.07)] text-text-muted',
        )}
      >
        {voice.initials}
      </span>
      <span className="min-w-0">
        <span
          className={cn(
            'block truncate text-[12.5px] leading-tight',
            selected ? 'text-text' : 'text-text-2',
          )}
        >
          {voice.name}
        </span>
        <span className="block truncate text-[10.5px] leading-tight text-text-dim">
          {voice.outlet}
        </span>
      </span>
    </button>
  )
}

/* ---- per-source outcome of the last harvest ---- */

function SourceResults() {
  const harvest = useStore((s) => s.harvest)
  if (harvest.phase !== 'done' && harvest.phase !== 'error') return null
  if (harvest.sources.length === 0) return null

  return (
    <div className="mt-4 flex flex-col gap-1.5 border-t border-[rgba(255,255,255,0.07)] pt-3">
      {harvest.sources.map((source) => {
        const voice = FINANCE_VOICES.find((v) => v.id === source.voiceId)
        const tone = !source.ok ? 'pink' : source.posts.length ? 'green' : 'amber'
        return (
          <div key={source.voiceId} className="flex items-start gap-2">
            <StatusDot tone={tone} size={6} className="mt-[5px]" />
            <span className="min-w-0 flex-1 text-[11.5px] leading-relaxed text-text-muted">
              <span className="text-text-2">{voice?.name ?? source.voiceId}</span>
              {source.ok && source.posts.length > 0
                ? ` · ${source.posts.length} post${source.posts.length > 1 ? 's' : ''}`
                : ` · ${source.error ?? 'nothing returned'}`}
            </span>
          </div>
        )
      })}
    </div>
  )
}

/* ---- the panel ---- */

/**
 * The auto-generator's intake: pick which real finance writers to listen to,
 * scrape their latest published posts through Firecrawl, and drop them into
 * the pile as source material the generator composes from.
 */
export function SignalFeed() {
  const selectedVoiceIds = useStore((s) => s.selectedVoiceIds)
  const autoGenerate = useStore((s) => s.autoGenerate)
  const harvest = useStore((s) => s.harvest)
  const toggleVoice = useStore((s) => s.toggleVoice)
  const setAutoGenerate = useStore((s) => s.setAutoGenerate)
  const runSignalHarvest = useStore((s) => s.runSignalHarvest)

  // null while we're still asking the server whether a key is configured.
  const [configured, setConfigured] = useState<boolean | null>(null)

  useEffect(() => {
    let alive = true
    fetchHarvestStatus()
      .then((status) => alive && setConfigured(status.configured))
      .catch(() => alive && setConfigured(false))
    return () => {
      alive = false
    }
  }, [])

  const [india, global] = useMemo(
    () => [
      FINANCE_VOICES.filter((v) => v.region === 'india'),
      FINANCE_VOICES.filter((v) => v.region === 'global'),
    ],
    [],
  )

  const running = harvest.phase === 'running'
  const selectedCount = selectedVoiceIds.length

  return (
    <Card className="p-5 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <IconGlobe size={15} className="text-violet-dim" />
          <MicroLabel>Auto-generator · signal feed</MicroLabel>
        </div>

        {configured === null ? (
          <MicroLabel className="text-text-dim">Checking Firecrawl…</MicroLabel>
        ) : configured ? (
          <span className="flex items-center gap-2">
            <StatusDot tone="green" size={6} />
            <MicroLabel className="text-green">Firecrawl connected</MicroLabel>
          </span>
        ) : (
          <span className="flex items-center gap-2">
            <StatusDot tone="amber" size={6} />
            <MicroLabel className="text-amber">Firecrawl not connected</MicroLabel>
          </span>
        )}
      </div>

      <p className="mt-3 max-w-[62ch] text-[13px] leading-relaxed text-text-muted">
        Reads what real finance writers actually published — on their own blogs and
        newsletters, where the thinking lands first — and drops those posts into the pile
        as source material. Drafts quote them directly, with attribution and a link.
      </p>

      {/* roster */}
      <div className="mt-5 flex flex-col gap-4">
        <div>
          <MicroLabel className="text-text-dim">India</MicroLabel>
          <div className="mt-2 flex flex-wrap gap-2">
            {india.map((voice) => (
              <VoiceChip
                key={voice.id}
                voice={voice}
                selected={selectedVoiceIds.includes(voice.id)}
                onToggle={() => toggleVoice(voice.id)}
              />
            ))}
          </div>
        </div>
        <div>
          <MicroLabel className="text-text-dim">Global</MicroLabel>
          <div className="mt-2 flex flex-wrap gap-2">
            {global.map((voice) => (
              <VoiceChip
                key={voice.id}
                voice={voice}
                selected={selectedVoiceIds.includes(voice.id)}
                onToggle={() => toggleVoice(voice.id)}
              />
            ))}
          </div>
        </div>
      </div>

      {/* actions */}
      <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-[rgba(255,255,255,0.07)] pt-4">
        <Button
          variant="primary"
          size="sm"
          onClick={() => void runSignalHarvest()}
          disabled={running || selectedCount === 0}
        >
          {running ? (
            <>
              <IconRefresh size={14} className="animate-spin" /> Scraping {selectedCount}…
            </>
          ) : (
            <>
              <IconRefresh size={14} /> Scrape latest posts
            </>
          )}
        </Button>

        <button
          type="button"
          onClick={() => setAutoGenerate(!autoGenerate)}
          aria-pressed={autoGenerate}
          className={cn(
            'flex items-center gap-2 rounded-lg border px-3 py-1.5 text-[13px]',
            'transition-all duration-[350ms] ease-premium focus-violet',
            autoGenerate
              ? 'border-[rgba(170,152,248,0.4)] bg-[rgba(170,152,248,0.1)] text-violet'
              : 'border-border text-text-2 hover:border-border-strong',
          )}
        >
          <IconSparkle size={14} />
          Auto-draft new posts
          <span
            className={cn(
              'ml-1 h-3.5 w-6 rounded-full transition-colors',
              autoGenerate ? 'bg-violet' : 'bg-[rgba(255,255,255,0.14)]',
            )}
          >
            <span
              className={cn(
                'block h-3 w-3 translate-y-[1px] rounded-full bg-white transition-transform',
                autoGenerate ? 'translate-x-[13px]' : 'translate-x-[2px]',
              )}
            />
          </span>
        </button>

        {harvest.lastRunAt && !running && (
          <MicroLabel className="text-text-dim">
            Last run {relativeTime(harvest.lastRunAt)}
            {harvest.newPostCount > 0 && ` · ${harvest.newPostCount} new`}
          </MicroLabel>
        )}
      </div>

      {/* not-connected guidance — honest about why nothing was scraped */}
      {configured === false && (
        <p className="mt-3 text-[12px] leading-relaxed text-amber">
          Set <code className="font-mono text-[11.5px]">FIRECRAWL_API_KEY</code> on the server
          (<code className="font-mono text-[11.5px]">.env</code> locally, a Cloudflare Pages
          secret in production) to harvest real posts. Nothing is scraped until then.
        </p>
      )}

      {harvest.phase === 'error' && harvest.error && (
        <p className="mt-3 text-[12px] leading-relaxed text-pink">{harvest.error}</p>
      )}

      {harvest.phase === 'done' && harvest.notice && (
        <p className="mt-3 text-[12px] leading-relaxed text-amber">{harvest.notice}</p>
      )}

      <SourceResults />
    </Card>
  )
}
