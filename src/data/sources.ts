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

/* ---- Input-mix presets — the quick "what to pull from" chooser ---- */
export interface InputMix {
  id: string
  label: string
  /** which source groups this mix draws from ([] = fully custom) */
  kinds: SourceKind[]
  hint: string
}

export const INPUT_MIXES: InputMix[] = [
  { id: 'linkedin', label: 'LinkedIn posts', kinds: ['creator', 'page', 'post'], hint: 'Creators, pages and trending posts' },
  { id: 'news', label: 'News only', kinds: ['news'], hint: 'Current developments by category' },
  { id: 'linkedin-news', label: 'LinkedIn + News', kinds: ['creator', 'page', 'post', 'news'], hint: 'Social signal blended with the news cycle' },
  { id: 'creator-industry', label: 'Creator insights + Industry', kinds: ['creator', 'conversation'], hint: 'Voices plus ongoing discussions' },
  { id: 'custom', label: 'Custom mix', kinds: [], hint: 'Pick any combination of sources' },
]

export function mixById(id: string): InputMix {
  return INPUT_MIXES.find((m) => m.id === id) ?? INPUT_MIXES[0]
}

/** Sensible default selection when a preset mix is chosen (custom starts empty). */
export function defaultSelectionForMix(id: string): string[] {
  const mix = mixById(id)
  if (mix.kinds.length === 0) return []
  return ALL_SOURCES.filter((s) => mix.kinds.includes(s.kind)).map((s) => s.id)
}

/** Human-readable labels for a set of selected source ids. */
export function sourceLabels(ids: Iterable<string>): string[] {
  const set = new Set(ids)
  return ALL_SOURCES.filter((s) => set.has(s.id)).map((s) => s.name)
}
