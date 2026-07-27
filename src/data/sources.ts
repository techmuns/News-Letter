/* ============================================================
   Automatic Content Generator — monitored source catalog (mock).
   No real scraping/APIs: this is the selection structure and the
   realistic placeholder inventory the generator draws from.
   ============================================================ */

export type SourceKind = 'creator' | 'page' | 'post' | 'news' | 'conversation'

export interface MonitoredSource {
  id: string
  kind: SourceKind
  name: string
  /** handle, category or a short meta line */
  detail: string
  /** initials for the avatar tile */
  avatar: string
  /** a light "signal" line — followers, cadence or performance (placeholder) */
  signal?: string
}

export const SOURCE_KIND_LABEL: Record<SourceKind, string> = {
  creator: 'Creators & profiles',
  page: 'Company pages',
  post: 'Top-performing posts',
  news: 'News & categories',
  conversation: 'Industry conversations',
}

/* ---- LinkedIn creators / profiles being monitored ---- */
export const CREATORS: MonitoredSource[] = [
  { id: 'cr-aarti', kind: 'creator', name: 'Aarti Menon', detail: '@aarti.equity', avatar: 'AM', signal: 'Equity strategy · 48k' },
  { id: 'cr-james', kind: 'creator', name: 'James Whitfield', detail: '@jwhitfield', avatar: 'JW', signal: 'Macro & rates · 72k' },
  { id: 'cr-priya', kind: 'creator', name: 'Priya Raghavan', detail: '@priya.markets', avatar: 'PR', signal: 'Primary markets · 33k' },
  { id: 'cr-daniel', kind: 'creator', name: 'Daniel Cho', detail: '@dcho.credit', avatar: 'DC', signal: 'Credit & special sits · 21k' },
  { id: 'cr-neha', kind: 'creator', name: 'Neha Kapoor', detail: '@neha.research', avatar: 'NK', signal: 'Research tradecraft · 58k' },
]

/* ---- LinkedIn company pages being monitored ---- */
export const PAGES: MonitoredSource[] = [
  { id: 'pg-munshot', kind: 'page', name: 'Munshot Intelligence', detail: 'Financial data', avatar: 'MI', signal: 'Company page' },
  { id: 'pg-bharatbond', kind: 'page', name: 'BharatBond Advisors', detail: 'Fixed income', avatar: 'BB', signal: 'Company page' },
  { id: 'pg-meridian', kind: 'page', name: 'Meridian Capital', detail: 'Asset management', avatar: 'MC', signal: 'Company page' },
  { id: 'pg-ledgerline', kind: 'page', name: 'LedgerLine Analytics', detail: 'Fintech data', avatar: 'LL', signal: 'Company page' },
]

/* ---- Individual well-performing posts collected by the monitor ---- */
export const POSTS: MonitoredSource[] = [
  { id: 'po-ipo', kind: 'post', name: 'Why smaller IPOs are the real signal', detail: '@priya.markets', avatar: 'PR', signal: '1.2k reactions · trending' },
  { id: 'po-loss', kind: 'post', name: "The loss-ratio chart nobody's watching", detail: '@aarti.equity', avatar: 'AM', signal: '890 reactions' },
  { id: 'po-drhp', kind: 'post', name: '3 lines that kill a bad DRHP', detail: '@neha.research', avatar: 'NK', signal: '2.1k reactions · trending' },
]

/* ---- News categories / current developments ---- */
export const NEWS: MonitoredSource[] = [
  { id: 'nw-primary', kind: 'news', name: 'Primary markets & IPOs', detail: 'News category', avatar: '§', signal: '11 fresh today' },
  { id: 'nw-insurance', kind: 'news', name: 'Insurance & financials', detail: 'News category', avatar: '§', signal: '6 fresh today' },
  { id: 'nw-regulation', kind: 'news', name: 'Regulation & governance', detail: 'News category', avatar: '§', signal: '4 fresh today' },
  { id: 'nw-macro', kind: 'news', name: 'Macro & rates', detail: 'News category', avatar: '§', signal: '9 fresh today' },
  { id: 'nw-earnings', kind: 'news', name: 'Earnings & results', detail: 'News category', avatar: '§', signal: '18 fresh today' },
]

/* ---- Ongoing industry conversations / discussion threads ---- */
export const CONVERSATIONS: MonitoredSource[] = [
  { id: 'cv-drhp', kind: 'conversation', name: 'DRHP amendment patterns', detail: 'Discussion', avatar: '◇', signal: 'Active thread' },
  { id: 'cv-margin', kind: 'conversation', name: 'Insurance margin compression', detail: 'Discussion', avatar: '◇', signal: 'Active thread' },
  { id: 'cv-ai', kind: 'conversation', name: 'AI in equity research', detail: 'Discussion', avatar: '◇', signal: 'Hot' },
  { id: 'cv-ofs', kind: 'conversation', name: 'Promoter OFS trends', detail: 'Discussion', avatar: '◇', signal: 'Active thread' },
]

/** All monitored sources, grouped in display order. */
export const SOURCE_GROUPS: { kind: SourceKind; sources: MonitoredSource[] }[] = [
  { kind: 'creator', sources: CREATORS },
  { kind: 'page', sources: PAGES },
  { kind: 'post', sources: POSTS },
  { kind: 'news', sources: NEWS },
  { kind: 'conversation', sources: CONVERSATIONS },
]

export const ALL_SOURCES: MonitoredSource[] = SOURCE_GROUPS.flatMap((g) => g.sources)

export function sourceById(id: string): MonitoredSource | undefined {
  return ALL_SOURCES.find((s) => s.id === id)
}

/** Initials for a user-added source's avatar tile ("Aarti Menon" → "AM"). */
export function initialsFor(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (!words.length) return '·'
  const letters = words.slice(0, 2).map((w) => w[0].toUpperCase())
  return letters.join('')
}

/** Normalise a pasted LinkedIn URL or handle into a short display detail. */
export function normaliseHandle(input: string): string {
  const raw = input.trim()
  if (!raw) return 'Added by you'
  const url = raw.match(/linkedin\.com\/(?:in|company)\/([^/?#]+)/i)
  if (url) return `@${url[1]}`
  return raw.startsWith('@') ? raw : `@${raw}`
}

/* ---- Input-mix presets — the quick "what to pull from" chooser ---- */
export interface InputMix {
  id: string
  label: string
  /** which source groups this mix draws from ([] = fully custom) */
  kinds: SourceKind[]
  hint: string
}

export const INPUT_MIXES: InputMix[] = [
  { id: 'linkedin', label: 'LinkedIn', kinds: ['creator', 'page', 'post'], hint: 'Creators, pages and trending posts' },
  { id: 'news', label: 'News', kinds: ['news'], hint: 'Current developments by category' },
  { id: 'custom', label: 'Custom', kinds: [], hint: 'Pick any combination of sources' },
]

export function mixById(id: string): InputMix {
  return INPUT_MIXES.find((m) => m.id === id) ?? INPUT_MIXES[0]
}

/** Human-readable labels for a set of selected source ids. */
export function sourceLabels(ids: Iterable<string>, custom: MonitoredSource[] = []): string[] {
  const set = new Set(ids)
  return [...custom, ...ALL_SOURCES].filter((s) => set.has(s.id)).map((s) => s.name)
}

/**
 * The catalog as the user has shaped it: their own additions folded in and any
 * removed catalog entries filtered out. Groups that end up empty are dropped.
 */
export function visibleGroups(
  custom: MonitoredSource[] = [],
  hidden: Iterable<string> = [],
): { kind: SourceKind; sources: MonitoredSource[] }[] {
  const gone = new Set(hidden)
  return SOURCE_GROUPS.map((g) => ({
    ...g,
    sources: [
      ...custom.filter((c) => c.kind === g.kind),
      ...g.sources.filter((s) => !gone.has(s.id)),
    ],
  })).filter((g) => g.sources.length > 0)
}

/** Every source the user can currently see, catalog + their own, minus removals. */
export function activeSources(
  custom: MonitoredSource[] = [],
  hidden: Iterable<string> = [],
): MonitoredSource[] {
  return visibleGroups(custom, hidden).flatMap((g) => g.sources)
}

/** Default selection for a mix, over the sources that are actually present. */
export function defaultSelectionWithCustom(
  id: string,
  custom: MonitoredSource[],
  hidden: Iterable<string> = [],
): string[] {
  const mix = mixById(id)
  if (mix.kinds.length === 0) return []
  return activeSources(custom, hidden)
    .filter((s) => mix.kinds.includes(s.kind))
    .map((s) => s.id)
}

/** How many catalog entries are currently removed (for the restore affordance). */
export function hiddenCount(hidden: Iterable<string>): number {
  const gone = new Set(hidden)
  return ALL_SOURCES.filter((s) => gone.has(s.id)).length
}
