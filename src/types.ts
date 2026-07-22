/* ============================================================
   Domain model — Munshot Content System
   A Campaign is the master content item. It owns exactly three
   channel versions (LinkedIn, Email, Article). Each channel has
   its OWN independent status; editing one never touches the others.
   ============================================================ */

export type ChannelKind = 'linkedin' | 'email' | 'article'

export const CHANNEL_ORDER: ChannelKind[] = ['linkedin', 'email', 'article']

export const CHANNEL_LABEL: Record<ChannelKind, string> = {
  linkedin: 'LinkedIn',
  email: 'Email',
  article: 'Article',
}

/** Per-channel status flow — independent per channel version.
    'Failed' sits outside the linear flow: a publish that needs attention. */
export type ChannelStatus =
  | 'Idea'
  | 'Draft'
  | 'In Review'
  | 'Ready'
  | 'Scheduled'
  | 'Published'
  | 'Failed'

/** The linear happy-path flow (Failed is handled separately, off-flow). */
export const CHANNEL_STATUS_FLOW: ChannelStatus[] = [
  'Idea',
  'Draft',
  'In Review',
  'Ready',
  'Scheduled',
  'Published',
]

export type StatusTone = 'green' | 'amber' | 'grey' | 'violet' | 'red'

/** Maps a status to the shared status-dot tone (see design §5.4). */
export function statusTone(status: ChannelStatus): StatusTone {
  switch (status) {
    case 'Ready':
    case 'Published':
      return 'green'
    case 'In Review':
      return 'amber'
    case 'Scheduled':
      return 'violet'
    case 'Failed':
      return 'red'
    case 'Draft':
    case 'Idea':
    default:
      return 'grey'
  }
}

export type WorkspaceItemType = 'pdf' | 'screenshot' | 'note'

export interface WorkspaceItem {
  id: string
  type: WorkspaceItemType
  title: string
  /** short preview snippet or filename detail */
  preview: string
  /** data URL for image items (screenshots) — shown as a thumbnail */
  imageUrl?: string
  addedBy: string
  createdAt: string // ISO
}

/* ---- Channel-specific content shapes ---- */

export interface LinkedInContent {
  authorName: string
  authorHandle: string
  authorAvatar: string // initials
  /** catchy phrase / hook shown as the post lead */
  headline: string
  body: string
  reactions: number
  comments: number
  reposts: number
}

export interface EmailContent {
  subject: string
  from: string
  preheader: string
  idea: string
  story: string
  takeaway: string
  ctaLabel: string
}

export interface ArticleSection {
  heading?: string
  body: string
}

export interface ArticleContent {
  title: string
  deck: string // standfirst / subtitle
  hero: string // emoji-ish label for the mock hero
  readMinutes: number
  sections: ArticleSection[]
  ctaTitle: string
  ctaBody: string
  ctaLabel: string
}

export type ChannelContent = LinkedInContent | EmailContent | ArticleContent

export interface ChannelVersion<T extends ChannelContent = ChannelContent> {
  kind: ChannelKind
  status: ChannelStatus
  /** true once a human has edited this version — protects it from re-generate clobber */
  edited: boolean
  /** false while awaiting review; a channel only distributes once approved.
      Undefined (seed content) is treated as approved. */
  approved?: boolean
  scheduledDate?: string // ISO date (yyyy-mm-dd)
  scheduledTime?: string // HH:mm (24h), paired with scheduledDate
  /** channel-specific caption/copy the user can tweak at schedule time.
      Falls back to a channel-derived string when unset (see captionOf). */
  caption?: string
  content: T
}

/** A quiet "thing to promote" that can attach to a campaign. */
export interface Promotion {
  id: string
  name: string
  benefit: string
  ctaLabel: string
}

/* ============================================================
   Generation brief — the pre-generation filter set a user
   configures before turning workspace items into content.
   Mirrors content-strategy/content-filters.md (a curated,
   UI-friendly subset). Stored on the Campaign for provenance.
   ============================================================ */

export type Persona =
  | 'hedge-fund-pm'
  | 'buy-side-analyst'
  | 'sell-side-analyst'
  | 'pe-investor'
  | 'vc-investor'
  | 'allocator'
  | 'cio'
  | 'analyst-generalist'

export type Objective =
  | 'authority'
  | 'educate'
  | 'engagement'
  | 'nurture'
  | 'category'

export type PillarId =
  | 'research-tradecraft'
  | 'market-science'
  | 'financial-forensics'
  | 'decision-frameworks'
  | 'behavioral-edge'
  | 'governance-incentives'
  | 'portfolio-risk'
  | 'ai-native'

export type ContentType =
  | 'framework'
  | 'deep-dive'
  | 'data-drop'
  | 'contrarian'
  | 'explainer'
  | 'case-study'
  | 'myth-buster'
  | 'trend'
  | 'teardown'
  | 'bookshelf'

export type Depth = 'surface' | 'standard' | 'deep' | 'technical'

export type LengthTarget = 'micro' | 'short' | 'standard' | 'long' | 'deep'

export type Tone =
  | 'authoritative'
  | 'analytical'
  | 'provocative'
  | 'conversational'
  | 'academic'

export type PointOfView = 'consensus' | 'balanced' | 'variant' | 'contrarian'

export type DataIntensity = 'qualitative' | 'illustrative' | 'data-led' | 'quantitative'

export type MarketLens = 'global' | 'us' | 'india-em' | 'europe' | 'apac'

/** % insight (the remainder is the quiet product pointer). */
export type PromotionRatio = 100 | 90 | 80 | 70

export type ComplianceMode =
  | 'off'
  | 'marketing-reviewed'
  | 'no-forward-looking'
  | 'research-grade'
  | 'no-advice'

export type SourcingRigor = 'none' | 'named' | 'fully-cited' | 'munshot-only' | 'primary-only'

export type Confidence = 'measured' | 'balanced' | 'assertive' | 'strong'

export type PresetId =
  | 'terminal-note'
  | 'executive-memo'
  | 'contrarian-take'
  | 'explainer'
  | 'data-drop'
  | 'governance-alert'
  | 'category-pov'

/** The structured brief that drives (and is stored with) a generation. */
export interface GenerationBrief {
  // Intent
  audience: Persona
  objective: Objective
  pillar: PillarId
  // Substance
  contentType: ContentType
  depth: Depth
  dataIntensity: DataIntensity
  pointOfView: PointOfView
  // Voice & format
  tone: Tone
  length: LengthTarget
  // Governance
  promotionRatio: PromotionRatio
  compliance: ComplianceMode
  sourcing: SourcingRigor
  confidence: Confidence
  // Context
  marketLens: MarketLens
  /** the preset this brief started from, if any (provenance) */
  preset?: PresetId
}

export interface Campaign {
  id: string
  name: string
  topic: string
  createdAt: string // ISO
  /** workspace items this campaign was generated from */
  sourceItemIds: string[]
  /** hero image (data URL) carried into LinkedIn + the article hero */
  heroImage?: string
  linkedin: ChannelVersion<LinkedInContent>
  email: ChannelVersion<EmailContent>
  article: ChannelVersion<ArticleContent>
  promo?: Promotion
  /** the pre-generation brief that produced this campaign (provenance) */
  brief?: GenerationBrief
  /** how this campaign was sourced — manual upload vs the automatic generator */
  sourceMode?: SourceMode
  /** human-readable labels of the inputs this was generated from (provenance) */
  sources?: string[]
  /** true while still being composed in the Workspace — hidden from Preview
      and Scheduling until the author hits "Continue to Preview". */
  draft?: boolean
  /** true during the mocked "turn into content" processing state */
  processing?: boolean
}

/** Where a campaign's raw material came from. */
export type SourceMode = 'manual' | 'auto'

/** The caption shown for a channel in scheduling/publish contexts — the
    author's override if set, else a sensible channel-derived default. */
export function captionOf(ch: ChannelVersion): string {
  if (ch.caption) return ch.caption
  switch (ch.kind) {
    case 'linkedin':
      return (ch.content as LinkedInContent).body
    case 'email':
      return (ch.content as EmailContent).subject
    case 'article':
      return (ch.content as ArticleContent).title
    default:
      return ''
  }
}

/** A channel distributes once approved; seed content (undefined) counts as approved. */
export function channelApproved(ch: ChannelVersion): boolean {
  return ch.approved !== false
}

/** A campaign needs review while any of its channels is still unapproved. */
export function campaignNeedsReview(campaign: Campaign): boolean {
  return CHANNEL_ORDER.some((k) => campaign[k].approved === false)
}

/** Convenience accessor for a campaign's channel version by kind. */
export function channelOf(campaign: Campaign, kind: ChannelKind): ChannelVersion {
  return campaign[kind]
}
