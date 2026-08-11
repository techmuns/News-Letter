import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  type ArticleContent,
  type Campaign,
  type ChannelKind,
  type ChannelStatus,
  type EmailKeyPoint,
  type EmailSpotlight,
  type WorkspaceItem,
  type WorkspaceItemType,
} from '../types'
import { GENERATABLE, PROMOTIONS } from '../data/mockData'

function uid(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

/** A real generation from Daily Pulse / Studio, normalized before it becomes a
    Campaign in the history the channel spaces render. */
export interface GeneratedRecord {
  name: string
  topic: string
  headline: string
  body: string
  email: {
    subject: string
    preheader: string
    idea: string
    story: string
    takeaway: string
    ctaLabel: string
    keyPoints?: EmailKeyPoint[]
    spotlight?: EmailSpotlight
  }
  heroImage?: string
  /** where it came from, e.g. "Studio" or "Daily Pulse · Topic" */
  source?: string
}

/** Guess a workspace item type from a (mock) filename. */
export function typeFromName(name: string): WorkspaceItemType {
  const lower = name.toLowerCase()
  if (lower.endsWith('.pdf')) return 'pdf'
  if (/\.(png|jpe?g|gif|webp|heic)$/.test(lower)) return 'screenshot'
  return 'note'
}

const PROCESSING_MS = 2000

interface StoreState {
  items: WorkspaceItem[]
  campaigns: Campaign[]
  /** rotates through generatable templates for the mocked action */
  genIndex: number
  /** the last campaign generated from the pile (for surfacing/scroll) */
  lastGeneratedId: string | null

  // --- Workspace actions ---
  addNote: (text: string, addedBy?: string) => void
  addFiles: (
    files: { name: string; sizeLabel?: string; imageUrl?: string }[],
    addedBy?: string,
  ) => void
  removeItem: (id: string) => void

  /** Mocked "Turn into content": creates a Campaign + 3 channel drafts. */
  turnIntoContent: (itemIds: string[]) => string

  /** Record a REAL generation (Daily Pulse / Studio) into the channel history. */
  recordGeneration: (input: GeneratedRecord) => string
  /** Attach the branded image to a recorded generation once it's rendered. */
  setHeroImage: (campaignId: string, dataUrl: string) => void
  /** Replace a campaign's article with a full, AI-written long-form piece. */
  setArticleContent: (campaignId: string, content: ArticleContent) => void

  // --- Campaign / channel actions ---
  /** Approve one channel → it moves to Ready and distributes to its space. */
  approveChannel: (campaignId: string, kind: ChannelKind) => void
  /** Approve all three channels at once. */
  approveCampaign: (campaignId: string) => void
  setChannelStatus: (campaignId: string, kind: ChannelKind, status: ChannelStatus) => void
  scheduleChannel: (campaignId: string, kind: ChannelKind, date: string) => void
  markChannelEdited: (campaignId: string, kind: ChannelKind, edited?: boolean) => void
  /** Replaces a channel's content from a fresh template (drops edited flag). */
  regenerateChannel: (campaignId: string, kind: ChannelKind) => void
}

export const useStore = create<StoreState>()(
  persist(
    (set, get) => ({
      items: [],
      campaigns: [],
      genIndex: 0,
      lastGeneratedId: null,

      addNote: (text, addedBy = 'You') => {
        const trimmed = text.trim()
        if (!trimmed) return
        const firstLine = trimmed.split('\n')[0]
        const item: WorkspaceItem = {
          id: uid('item'),
          type: 'note',
          title: firstLine.length > 60 ? `${firstLine.slice(0, 57)}…` : firstLine,
          preview: trimmed,
          addedBy,
          createdAt: new Date().toISOString(),
        }
        set((s) => ({ items: [item, ...s.items] }))
      },

      addFiles: (files, addedBy = 'You') => {
        const newItems: WorkspaceItem[] = files.map((f) => {
          const type = f.imageUrl ? 'screenshot' : typeFromName(f.name)
          return {
            id: uid('item'),
            type,
            title: f.name,
            preview:
              f.sizeLabel ??
              (type === 'pdf'
                ? 'PDF · dropped into workspace'
                : type === 'screenshot'
                  ? 'Screenshot · dropped into workspace'
                  : 'Note · dropped into workspace'),
            imageUrl: f.imageUrl,
            addedBy,
            createdAt: new Date().toISOString(),
          }
        })
        if (newItems.length) set((s) => ({ items: [...newItems, ...s.items] }))
      },

      removeItem: (id) =>
        set((s) => ({ items: s.items.filter((i) => i.id !== id) })),

      turnIntoContent: (itemIds) => {
        const tpl = GENERATABLE[get().genIndex % GENERATABLE.length]
        const id = uid('camp')
        const now = new Date().toISOString()
        // Prefer a picture from the selected items; fall back to the template hero.
        const items = get().items
        const heroFromSelection = itemIds
          .map((iid) => items.find((it) => it.id === iid)?.imageUrl)
          .find(Boolean)
        const campaign: Campaign = {
          id,
          name: tpl.name,
          topic: tpl.topic,
          createdAt: now,
          sourceItemIds: itemIds,
          heroImage: heroFromSelection ?? tpl.heroImage,
          promo: PROMOTIONS.find((p) => p.id === tpl.promoId),
          // Each channel awaits its own review before it distributes to its space.
          linkedin: { kind: 'linkedin', status: 'In Review', edited: false, approved: false, content: tpl.linkedin },
          email: { kind: 'email', status: 'In Review', edited: false, approved: false, content: tpl.email },
          article: { kind: 'article', status: 'In Review', edited: false, approved: false, content: tpl.article },
          processing: true,
        }
        set((s) => ({
          campaigns: [campaign, ...s.campaigns],
          genIndex: s.genIndex + 1,
          lastGeneratedId: id,
        }))
        // Mocked processing: settle after a brief beat.
        setTimeout(() => {
          set((s) => ({
            campaigns: s.campaigns.map((c) =>
              c.id === id ? { ...c, processing: false } : c,
            ),
          }))
        }, PROCESSING_MS)
        return id
      },

      recordGeneration: (input) => {
        const id = uid('gen')
        const now = new Date().toISOString()
        const words = input.body.split(/\s+/).filter(Boolean).length
        const campaign: Campaign = {
          id,
          name: input.name || input.topic || 'Untitled',
          topic: input.topic || input.name || '',
          createdAt: now,
          sourceItemIds: [],
          heroImage: input.heroImage,
          linkedin: {
            kind: 'linkedin',
            status: 'Draft',
            edited: false,
            content: {
              authorName: 'Munshot',
              authorHandle: `Munshot Intelligence · ${input.source || 'Studio'}`,
              authorAvatar: 'M',
              headline: input.headline,
              body: input.body,
              reactions: 0,
              comments: 0,
              reposts: 0,
            },
          },
          email: {
            kind: 'email',
            status: 'Draft',
            edited: false,
            content: {
              subject: input.email.subject,
              from: 'Munshot Intelligence',
              preheader: input.email.preheader,
              idea: input.email.idea,
              story: input.email.story,
              takeaway: input.email.takeaway,
              ctaLabel: input.email.ctaLabel,
              keyPoints: input.email.keyPoints,
              spotlight: input.email.spotlight,
            },
          },
          // The long-form version is assembled from the same generation.
          article: {
            kind: 'article',
            status: 'Draft',
            edited: false,
            content: {
              title: input.name || input.topic || 'Untitled',
              deck: input.email.preheader,
              hero: '📊',
              readMinutes: Math.max(2, Math.round(words / 180)),
              sections: [
                { heading: 'The idea', body: input.email.idea },
                { heading: 'The story', body: input.email.story },
                { heading: 'The takeaway', body: input.email.takeaway },
              ],
              ctaTitle: 'From Munshot Intelligence',
              ctaBody: 'Turn market moves into decision-ready insight.',
              ctaLabel: input.email.ctaLabel,
            },
          },
        }
        set((s) => ({ campaigns: [campaign, ...s.campaigns].slice(0, 50), lastGeneratedId: id }))
        return id
      },

      setHeroImage: (campaignId, dataUrl) =>
        set((s) => ({
          campaigns: s.campaigns.map((c) =>
            c.id === campaignId ? { ...c, heroImage: dataUrl } : c,
          ),
        })),

      // `edited: true` marks the article as a real, AI-written long-form piece
      // (vs. the quick draft assembled at generation time).
      setArticleContent: (campaignId, content) =>
        set((s) => ({
          campaigns: s.campaigns.map((c) =>
            c.id === campaignId
              ? { ...c, article: { ...c.article, content, edited: true, status: 'Ready' } }
              : c,
          ),
        })),

      approveChannel: (campaignId, kind) =>
        set((s) => ({
          campaigns: s.campaigns.map((c) =>
            c.id === campaignId
              ? { ...c, [kind]: { ...c[kind], approved: true, status: 'Ready' } }
              : c,
          ),
        })),

      approveCampaign: (campaignId) =>
        set((s) => ({
          campaigns: s.campaigns.map((c) =>
            c.id === campaignId
              ? {
                  ...c,
                  linkedin: { ...c.linkedin, approved: true, status: 'Ready' },
                  email: { ...c.email, approved: true, status: 'Ready' },
                  article: { ...c.article, approved: true, status: 'Ready' },
                }
              : c,
          ),
        })),

      setChannelStatus: (campaignId, kind, status) =>
        set((s) => ({
          campaigns: s.campaigns.map((c) =>
            c.id === campaignId
              ? { ...c, [kind]: { ...c[kind], status } }
              : c,
          ),
        })),

      scheduleChannel: (campaignId, kind, date) =>
        set((s) => ({
          campaigns: s.campaigns.map((c) =>
            c.id === campaignId
              ? { ...c, [kind]: { ...c[kind], scheduledDate: date, status: 'Scheduled' as ChannelStatus } }
              : c,
          ),
        })),

      markChannelEdited: (campaignId, kind, edited = true) =>
        set((s) => ({
          campaigns: s.campaigns.map((c) =>
            c.id === campaignId
              ? { ...c, [kind]: { ...c[kind], edited } }
              : c,
          ),
        })),

      regenerateChannel: (campaignId, kind) => {
        const tpl = GENERATABLE[get().genIndex % GENERATABLE.length]
        set((s) => ({
          genIndex: s.genIndex + 1,
          campaigns: s.campaigns.map((c) =>
            c.id === campaignId
              ? {
                  ...c,
                  [kind]: {
                    ...c[kind],
                    content: tpl[kind],
                    edited: false,
                    status: 'Draft' as ChannelStatus,
                  },
                }
              : c,
          ),
        }))
      },
    }),
    {
      name: 'munshot-content-store',
      version: 4,
      partialize: (s) => ({
        items: s.items,
        campaigns: s.campaigns,
        genIndex: s.genIndex,
      }),
      // The channel spaces now show REAL generated history, not demo campaigns —
      // drop any previously-seeded store so the fake examples don't linger.
      migrate: () => ({
        items: [],
        campaigns: [],
        genIndex: 0,
      }),
      // Clear any in-flight processing flags that were persisted mid-action.
      onRehydrateStorage: () => (state) => {
        if (!state) return
        state.campaigns = state.campaigns.map((c) =>
          c.processing ? { ...c, processing: false } : c,
        )
      },
    },
  ),
)
