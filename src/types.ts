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
  /** short preview snippet or filename detail */
  preview: string
  addedBy: string
  createdAt: string // ISO
}

/* ---- Channel-specific content shapes ---- */

export interface LinkedInContent {
  authorName: string
  authorHandle: string
  authorAvatar: string // initials
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
  linkedin: ChannelVersion<LinkedInContent>
  email: ChannelVersion<EmailContent>
  article: ChannelVersion<ArticleContent>
  promo?: Promotion
  /** true during the mocked "turn into content" processing state */
  processing?: boolean
}

/** Convenience accessor for a campaign's channel version by kind. */
export function channelOf(campaign: Campaign, kind: ChannelKind): ChannelVersion {
  return campaign[kind]
}
