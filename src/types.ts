/* ============================================================
   Domain model — Munshot Content System

   A Campaign is the master content item. It owns exactly three
   channel versions (LinkedIn, Email, Article). Each channel has
   its OWN independent status; editing one never touches the others.

   Note: author identity and the email "from" are NOT stored per
   campaign — they are brand configuration, in src/config.ts.
   ============================================================ */

export type ChannelKind = 'linkedin' | 'email' | 'article'

export const CHANNEL_ORDER: ChannelKind[] = ['linkedin', 'email', 'article']

export const CHANNEL_LABEL: Record<ChannelKind, string> = {
  linkedin: 'LinkedIn',
  email: 'Email',
  article: 'Article',
}

/** Per-channel status flow — independent per channel version. */
export type ChannelStatus =
  | 'Idea'
  | 'Draft'
  | 'In Review'
  | 'Ready'
  | 'Scheduled'
  | 'Published'

export const CHANNEL_STATUS_FLOW: ChannelStatus[] = [
  'Idea',
  'Draft',
  'In Review',
  'Ready',
  'Scheduled',
  'Published',
]

export type StatusTone = 'green' | 'amber' | 'grey' | 'violet'

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
  /** For notes this is the full text. For files it is a size/type detail line. */
  preview: string
  /** Small downscaled thumbnail (data URL) for images. Never the full file. */
  thumbnail?: string
  /** MIME type of the stored payload, when there is one. */
  mediaType?: string
  /** Raw byte size of the stored payload. */
  bytes?: number
  /** True when the full file lives in IndexedDB under this item's id. */
  hasPayload?: boolean
  addedBy: string
  createdAt: string // ISO
}

/* ---- Channel-specific content shapes ---- */

export interface LinkedInContent {
  /** Catchy phrase used as the post lead and on the branded graphic. */
  headline: string
  body: string
}

export interface EmailContent {
  subject: string
  preheader: string
  idea: string
  story: string
  takeaway: string
  ctaLabel: string
}

export interface ArticleSection {
  /** Optional — an opening section usually has no heading. */
  heading?: string
  body: string
}

export interface ArticleContent {
  title: string
  deck: string // standfirst / subtitle
  hero: string // short uppercase kicker, e.g. "IPO · PRIMARY MARKETS"
  readMinutes: number
  sections: ArticleSection[]
  ctaTitle: string
  ctaBody: string
  ctaLabel: string
}

export type ChannelContent = LinkedInContent | EmailContent | ArticleContent

/** Maps a channel kind to its content shape — used by the editor. */
export interface ChannelContentMap {
  linkedin: LinkedInContent
  email: EmailContent
  article: ArticleContent
}

export interface ChannelVersion<T extends ChannelContent = ChannelContent> {
  kind: ChannelKind
  status: ChannelStatus
  /** true once a human has edited this version — protects it from re-generate clobber */
  edited: boolean
  /** false while awaiting review; a channel only distributes once approved. */
  approved: boolean
  scheduledDate?: string // ISO date (yyyy-mm-dd)
  content: T
}

/** A quiet "thing to promote" that can attach to a campaign. */
export interface Promotion {
  id: string
  name: string
  benefit: string
  ctaLabel: string
}

export interface Campaign {
  id: string
  name: string
  topic: string
  createdAt: string // ISO
  /** workspace items this campaign was generated from */
  sourceItemIds: string[]
  /** hero image (data URL thumbnail of a selected screenshot), if any */
  heroImage?: string
  linkedin: ChannelVersion<LinkedInContent>
  email: ChannelVersion<EmailContent>
  article: ChannelVersion<ArticleContent>
  promo?: Promotion
}

/** State of the one-at-a-time generation job. */
export type GenerationState =
  | { status: 'idle' }
  | { status: 'running'; itemIds: string[] }
  | { status: 'error'; message: string }

/** A channel distributes once approved. */
export function channelApproved(ch: ChannelVersion): boolean {
  return ch.approved
}

/** A campaign needs review while any of its channels is still unapproved. */
export function campaignNeedsReview(campaign: Campaign): boolean {
  return CHANNEL_ORDER.some((k) => !campaign[k].approved)
}

/** Convenience accessor for a campaign's channel version by kind. */
export function channelOf(campaign: Campaign, kind: ChannelKind): ChannelVersion {
  return campaign[kind]
}
