import {
  type GenerationBrief,
  type Persona,
  type Objective,
  type PillarId,
  type ContentType,
  type Depth,
  type LengthTarget,
  type Tone,
  type PointOfView,
  type DataIntensity,
  type MarketLens,
  type PromotionRatio,
  type ComplianceMode,
  type SourcingRigor,
  type Confidence,
  type PresetId,
} from '../types'

/* ============================================================
   Filter option catalogs — the labelled choices behind every
   control in the Content Brief. Mirrors content-filters.md.
   ============================================================ */

export interface Opt<T> {
  value: T
  label: string
}

export const AUDIENCE_OPTS: Opt<Persona>[] = [
  { value: 'hedge-fund-pm', label: 'Hedge-fund PMs' },
  { value: 'buy-side-analyst', label: 'Buy-side analysts' },
  { value: 'sell-side-analyst', label: 'Sell-side analysts' },
  { value: 'pe-investor', label: 'PE investors' },
  { value: 'vc-investor', label: 'VC investors' },
  { value: 'allocator', label: 'Allocators / LPs' },
  { value: 'cio', label: 'CIOs / Heads of Research' },
  { value: 'analyst-generalist', label: 'Generalist analysts' },
]

export const OBJECTIVE_OPTS: Opt<Objective>[] = [
  { value: 'authority', label: 'Build authority' },
  { value: 'educate', label: 'Educate' },
  { value: 'engagement', label: 'Drive engagement' },
  { value: 'nurture', label: 'Nurture' },
  { value: 'category', label: 'Category creation' },
]

export const PILLAR_OPTS: Opt<PillarId>[] = [
  { value: 'research-tradecraft', label: '01 · Research Tradecraft' },
  { value: 'market-science', label: '02 · Market Science' },
  { value: 'financial-forensics', label: '03 · Financial Forensics' },
  { value: 'decision-frameworks', label: '04 · Decision Frameworks' },
  { value: 'behavioral-edge', label: '05 · Behavioral Edge' },
  { value: 'governance-incentives', label: '06 · Governance & Incentives' },
  { value: 'portfolio-risk', label: '07 · Portfolio, Risk & Structure' },
  { value: 'ai-native', label: '08 · AI-Native Research Firm' },
]

/** Compact pillar labels for tight surfaces (the rail). */
export const PILLAR_SHORT: Record<PillarId, string> = {
  'research-tradecraft': 'Tradecraft',
  'market-science': 'Market Science',
  'financial-forensics': 'Forensics',
  'decision-frameworks': 'Frameworks',
  'behavioral-edge': 'Behavioral',
  'governance-incentives': 'Governance',
  'portfolio-risk': 'Risk',
  'ai-native': 'AI-Native',
}

export const CONTENT_TYPE_OPTS: Opt<ContentType>[] = [
  { value: 'framework', label: 'Framework / checklist' },
  { value: 'deep-dive', label: 'Deep dive' },
  { value: 'data-drop', label: 'Data drop' },
  { value: 'contrarian', label: 'Contrarian take' },
  { value: 'explainer', label: 'Explainer' },
  { value: 'case-study', label: 'Case study' },
  { value: 'myth-buster', label: 'Myth-buster' },
  { value: 'trend', label: 'Trend analysis' },
  { value: 'teardown', label: 'Teardown / Q&A' },
  { value: 'bookshelf', label: 'Bookshelf / curation' },
]

export const DEPTH_OPTS: Opt<Depth>[] = [
  { value: 'surface', label: 'Surface' },
  { value: 'standard', label: 'Standard' },
  { value: 'deep', label: 'Deep' },
  { value: 'technical', label: 'Technical' },
]

export const LENGTH_OPTS: Opt<LengthTarget>[] = [
  { value: 'micro', label: 'Micro' },
  { value: 'short', label: 'Short' },
  { value: 'standard', label: 'Standard' },
  { value: 'long', label: 'Long' },
  { value: 'deep', label: 'Deep' },
]

/** Reading-time hint per length target. */
export const LENGTH_HINT: Record<LengthTarget, string> = {
  micro: '<100 words',
  short: '~1 min',
  standard: '2–3 min',
  long: '5–7 min',
  deep: '10+ min',
}

export const TONE_OPTS: Opt<Tone>[] = [
  { value: 'authoritative', label: 'Authoritative' },
  { value: 'analytical', label: 'Analytical' },
  { value: 'provocative', label: 'Provocative' },
  { value: 'conversational', label: 'Conversational' },
  { value: 'academic', label: 'Academic' },
]

export const POV_OPTS: Opt<PointOfView>[] = [
  { value: 'consensus', label: 'Consensus' },
  { value: 'balanced', label: 'Balanced' },
  { value: 'variant', label: 'Variant' },
  { value: 'contrarian', label: 'Contrarian' },
]

export const DATA_OPTS: Opt<DataIntensity>[] = [
  { value: 'qualitative', label: 'Qualitative' },
  { value: 'illustrative', label: 'Illustrative' },
  { value: 'data-led', label: 'Data-led' },
  { value: 'quantitative', label: 'Quantitative' },
]

export const MARKET_OPTS: Opt<MarketLens>[] = [
  { value: 'global', label: 'Global' },
  { value: 'us', label: 'US' },
  { value: 'india-em', label: 'India / EM' },
  { value: 'europe', label: 'Europe' },
  { value: 'apac', label: 'APAC' },
]

export const RATIO_OPTS: Opt<PromotionRatio>[] = [
  { value: 100, label: '100 / 0' },
  { value: 90, label: '90 / 10' },
  { value: 80, label: '80 / 20' },
  { value: 70, label: '70 / 30' },
]

export const COMPLIANCE_OPTS: Opt<ComplianceMode>[] = [
  { value: 'off', label: 'Off (internal)' },
  { value: 'marketing-reviewed', label: 'Marketing-reviewed' },
  { value: 'no-forward-looking', label: 'No forward-looking claims' },
  { value: 'research-grade', label: 'Research-grade' },
  { value: 'no-advice', label: 'No investment advice' },
]

export const SOURCING_OPTS: Opt<SourcingRigor>[] = [
  { value: 'none', label: 'None' },
  { value: 'named', label: 'Named sources' },
  { value: 'fully-cited', label: 'Fully cited' },
  { value: 'munshot-only', label: 'Munshot data only' },
  { value: 'primary-only', label: 'Primary sources only' },
]

export const CONFIDENCE_OPTS: Opt<Confidence>[] = [
  { value: 'measured', label: 'Measured' },
  { value: 'balanced', label: 'Balanced' },
  { value: 'assertive', label: 'Assertive' },
  { value: 'strong', label: 'Strong' },
]

/** Look up a label from any option catalog. */
export function labelOf<T>(opts: Opt<T>[], value: T): string {
  return opts.find((o) => o.value === value)?.label ?? String(value)
}

/* ============================================================
   Default brief + presets — the "function keys".
   ============================================================ */

export const DEFAULT_BRIEF: GenerationBrief = {
  audience: 'buy-side-analyst',
  objective: 'authority',
  pillar: 'research-tradecraft',
  contentType: 'framework',
  depth: 'standard',
  dataIntensity: 'illustrative',
  pointOfView: 'balanced',
  tone: 'analytical',
  length: 'standard',
  promotionRatio: 90,
  compliance: 'off',
  sourcing: 'named',
  confidence: 'balanced',
  marketLens: 'global',
}

export interface Preset {
  id: PresetId
  label: string
  description: string
  brief: GenerationBrief
}

export const PRESETS: Preset[] = [
  {
    id: 'terminal-note',
    label: 'Terminal Note',
    description: 'A Bloomberg-style market note — dense, cited, chart-led.',
    brief: {
      ...DEFAULT_BRIEF,
      audience: 'buy-side-analyst',
      objective: 'authority',
      pillar: 'market-science',
      contentType: 'data-drop',
      depth: 'technical',
      dataIntensity: 'quantitative',
      pointOfView: 'balanced',
      tone: 'authoritative',
      length: 'short',
      sourcing: 'fully-cited',
      confidence: 'balanced',
      preset: 'terminal-note',
    },
  },
  {
    id: 'executive-memo',
    label: 'Executive Memo',
    description: 'A McKinsey-style one-pager for time-poor decision-makers.',
    brief: {
      ...DEFAULT_BRIEF,
      audience: 'cio',
      objective: 'authority',
      pillar: 'decision-frameworks',
      contentType: 'framework',
      depth: 'standard',
      dataIntensity: 'illustrative',
      tone: 'analytical',
      length: 'standard',
      sourcing: 'named',
      confidence: 'assertive',
      preset: 'executive-memo',
    },
  },
  {
    id: 'contrarian-take',
    label: 'Contrarian Take',
    description: 'A sharp, non-consensus hook — still fully defensible.',
    brief: {
      ...DEFAULT_BRIEF,
      audience: 'hedge-fund-pm',
      objective: 'engagement',
      pillar: 'market-science',
      contentType: 'contrarian',
      depth: 'standard',
      dataIntensity: 'data-led',
      pointOfView: 'contrarian',
      tone: 'provocative',
      length: 'short',
      sourcing: 'named',
      confidence: 'assertive',
      preset: 'contrarian-take',
    },
  },
  {
    id: 'explainer',
    label: 'Explainer',
    description: 'A teaching post that makes one concept click.',
    brief: {
      ...DEFAULT_BRIEF,
      audience: 'analyst-generalist',
      objective: 'educate',
      pillar: 'research-tradecraft',
      contentType: 'explainer',
      depth: 'standard',
      dataIntensity: 'illustrative',
      pointOfView: 'consensus',
      tone: 'conversational',
      length: 'standard',
      sourcing: 'named',
      confidence: 'balanced',
      preset: 'explainer',
    },
  },
  {
    id: 'data-drop',
    label: 'Data Drop',
    description: 'A single-chart insight — minimal prose, primary data.',
    brief: {
      ...DEFAULT_BRIEF,
      audience: 'buy-side-analyst',
      objective: 'authority',
      pillar: 'market-science',
      contentType: 'data-drop',
      depth: 'technical',
      dataIntensity: 'quantitative',
      tone: 'authoritative',
      length: 'micro',
      sourcing: 'primary-only',
      confidence: 'balanced',
      preset: 'data-drop',
    },
  },
  {
    id: 'governance-alert',
    label: 'Governance Alert',
    description: 'A forensic red-flag note under research-grade compliance.',
    brief: {
      ...DEFAULT_BRIEF,
      audience: 'buy-side-analyst',
      objective: 'authority',
      pillar: 'governance-incentives',
      contentType: 'case-study',
      depth: 'deep',
      dataIntensity: 'data-led',
      pointOfView: 'balanced',
      tone: 'authoritative',
      length: 'standard',
      promotionRatio: 100,
      compliance: 'research-grade',
      sourcing: 'primary-only',
      confidence: 'measured',
      marketLens: 'india-em',
      preset: 'governance-alert',
    },
  },
  {
    id: 'category-pov',
    label: 'Category POV',
    description: 'A thought-leadership flagship — the one lane where product may lead.',
    brief: {
      ...DEFAULT_BRIEF,
      audience: 'cio',
      objective: 'category',
      pillar: 'ai-native',
      contentType: 'trend',
      depth: 'standard',
      dataIntensity: 'illustrative',
      pointOfView: 'variant',
      tone: 'authoritative',
      length: 'long',
      promotionRatio: 70,
      sourcing: 'named',
      confidence: 'assertive',
      preset: 'category-pov',
    },
  },
]

/* ============================================================
   Guardrails — the dependency graph. Some selections bound
   others; the engine enforces them before generation and
   surfaces exactly what it adjusted (never a silent edit).
   ============================================================ */

export interface EffectiveBrief {
  brief: GenerationBrief
  notes: string[]
}

export function applyGuardrails(raw: GenerationBrief): EffectiveBrief {
  const b: GenerationBrief = { ...raw }
  const notes: string[] = []

  // Promotion is pillar-bounded: only the AI-Native pillar may exceed 90/10.
  if (b.pillar !== 'ai-native' && b.promotionRatio < 90) {
    b.promotionRatio = 90
    notes.push('Only the AI-Native Research Firm pillar may exceed 90/10 — promotion capped to 90/10.')
  }

  // Compliance dominates every conflict.
  const strict = b.compliance === 'research-grade' || b.compliance === 'no-forward-looking'
  if (strict) {
    if (b.promotionRatio < 90) {
      b.promotionRatio = 90
      notes.push('Compliance mode caps promotion at 90/10.')
    }
    if (b.confidence === 'assertive' || b.confidence === 'strong') {
      b.confidence = 'balanced'
      notes.push('Compliance mode caps confidence at Balanced.')
    }
    if (b.sourcing === 'none') {
      b.sourcing = 'named'
      notes.push('Compliance mode requires at least named sources.')
    }
  }
  if (b.compliance === 'no-advice' && b.confidence === 'strong') {
    b.confidence = 'assertive'
    notes.push('“No investment advice” mode softens Strong confidence to Assertive.')
  }

  // Evidence scales with spice: a non-consensus stance must be sourced.
  if ((b.pointOfView === 'contrarian' || b.pointOfView === 'variant') && b.sourcing === 'none') {
    b.sourcing = 'named'
    notes.push('A non-consensus stance requires at least named sources.')
  }

  // Quantitative claims must be traceable.
  if (b.dataIntensity === 'quantitative' && b.sourcing === 'none') {
    b.sourcing = 'named'
    notes.push('Quantitative pieces must cite their data — sourcing raised to named.')
  }

  return { brief: b, notes }
}

/* ============================================================
   Human-readable summary of a brief.
   ============================================================ */

const OBJECTIVE_VERB: Record<Objective, string> = {
  authority: 'build authority',
  educate: 'educate',
  engagement: 'drive engagement',
  nurture: 'nurture the relationship',
  category: 'define the category',
}

/** One-line, plain-English restatement of the brief. */
export function briefSentence(b: GenerationBrief): string {
  const type = labelOf(CONTENT_TYPE_OPTS, b.contentType).replace(/ \/.*$/, '').toLowerCase()
  const audience = labelOf(AUDIENCE_OPTS, b.audience).toLowerCase()
  return `A ${type} for ${audience}, written to ${OBJECTIVE_VERB[b.objective]}.`
}

/** Key attributes of a brief as compact chips. */
export function briefChips(b: GenerationBrief): string[] {
  return [
    labelOf(PILLAR_OPTS, b.pillar).replace(/^\d+ · /, ''),
    `${labelOf(DEPTH_OPTS, b.depth)} depth`,
    labelOf(DATA_OPTS, b.dataIntensity),
    `${labelOf(TONE_OPTS, b.tone)} tone`,
    `${labelOf(LENGTH_OPTS, b.length)} · ${LENGTH_HINT[b.length]}`,
    labelOf(SOURCING_OPTS, b.sourcing),
    `${labelOf(RATIO_OPTS, b.promotionRatio)} insight`,
  ]
}

/** Very compact descriptor for the campaigns rail. */
export function briefRailLine(b: GenerationBrief): string {
  const type = labelOf(CONTENT_TYPE_OPTS, b.contentType).replace(/ \/.*$/, '')
  return `${PILLAR_SHORT[b.pillar]} · ${type}`
}
