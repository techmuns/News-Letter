import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  type Campaign,
  type ChannelKind,
  type ChannelStatus,
  type WorkspaceItem,
  type WorkspaceItemType,
} from '../types'
import {
  SEED_ITEMS,
  SEED_CAMPAIGNS,
  GENERATABLE,
  PROMOTIONS,
} from '../data/mockData'
import { postTitle, type ScrapedPost } from '../lib/linkedin'
import { composeFromSources } from '../lib/compose'

function uid(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
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
  /** Files real LinkedIn posts into the pile, skipping ones already there.
      Returns how many were new. */
  addScrapedPosts: (posts: ScrapedPost[], addedBy?: string) => number
  removeItem: (id: string) => void

  /** Mocked "Turn into content": creates a Campaign + 3 channel drafts. */
  turnIntoContent: (itemIds: string[]) => string

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
      items: SEED_ITEMS,
      campaigns: SEED_CAMPAIGNS,
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

      addScrapedPosts: (posts, addedBy = 'Firecrawl') => {
        // Re-scraping a profile returns posts already in the pile; the URL is
        // the identity, so the second pass is a no-op rather than a duplicate.
        const existing = new Set(
          get().items.map((i) => i.sourceUrl).filter((u): u is string => !!u),
        )
        const fresh = posts.filter((p) => !existing.has(p.url))
        if (fresh.length === 0) return 0

        const newItems: WorkspaceItem[] = fresh.map((p) => ({
          id: uid('item'),
          type: 'linkedin',
          title: postTitle(p),
          preview: p.text.split('\n')[0] ?? p.text,
          body: p.text,
          // The post's own image doubles as the pile thumbnail and, once the
          // item becomes a campaign, as that campaign's hero.
          imageUrl: p.imageUrl,
          sourceUrl: p.url,
          sourceAuthor: p.author,
          engagement:
            p.reactions === undefined && p.comments === undefined && p.reposts === undefined
              ? undefined
              : { reactions: p.reactions, comments: p.comments, reposts: p.reposts },
          addedBy,
          createdAt: new Date().toISOString(),
        }))
        set((s) => ({ items: [...newItems, ...s.items] }))
        return fresh.length
      },

      removeItem: (id) =>
        set((s) => ({ items: s.items.filter((i) => i.id !== id) })),

      turnIntoContent: (itemIds) => {
        const tpl = GENERATABLE[get().genIndex % GENERATABLE.length]
        const id = uid('camp')
        const now = new Date().toISOString()
        const items = get().items
        const selected = itemIds
          .map((iid) => items.find((it) => it.id === iid))
          .filter((it): it is WorkspaceItem => !!it)

        // Real source material composes a real campaign; a selection with no
        // usable text (a bare PDF, a screenshot) still falls back to a template
        // so the action never produces an empty draft.
        const composed = composeFromSources(selected)
        const heroFromSelection = selected.map((it) => it.imageUrl).find(Boolean)

        const campaign: Campaign = {
          id,
          name: composed?.name ?? tpl.name,
          topic: composed?.topic ?? tpl.topic,
          createdAt: now,
          sourceItemIds: itemIds,
          heroImage: composed?.heroImage ?? heroFromSelection ?? tpl.heroImage,
          // A templated campaign carries its scripted promo; a composed one is
          // about the source, so a Munshot pitch is not bolted onto it.
          promo: composed ? undefined : PROMOTIONS.find((p) => p.id === tpl.promoId),
          // Each channel awaits its own review before it distributes to its space.
          linkedin: {
            kind: 'linkedin',
            status: 'In Review',
            edited: false,
            approved: false,
            content: composed?.linkedin ?? tpl.linkedin,
          },
          email: {
            kind: 'email',
            status: 'In Review',
            edited: false,
            approved: false,
            content: composed?.email ?? tpl.email,
          },
          article: {
            kind: 'article',
            status: 'In Review',
            edited: false,
            approved: false,
            content: composed?.article ?? tpl.article,
          },
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
        const state = get()
        const campaign = state.campaigns.find((c) => c.id === campaignId)
        // Re-generate from the same source the campaign was built from, so a
        // composed campaign does not silently turn into a stock template on
        // its second pass.
        const sources = (campaign?.sourceItemIds ?? [])
          .map((iid) => state.items.find((it) => it.id === iid))
          .filter((it): it is WorkspaceItem => !!it)
        const composed = composeFromSources(sources)
        const tpl = GENERATABLE[state.genIndex % GENERATABLE.length]
        const content = composed?.[kind] ?? tpl[kind]

        set((s) => ({
          genIndex: composed ? s.genIndex : s.genIndex + 1,
          campaigns: s.campaigns.map((c) =>
            c.id === campaignId
              ? {
                  ...c,
                  [kind]: {
                    ...c[kind],
                    content,
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
      version: 3,
      partialize: (s) => ({
        items: s.items,
        campaigns: s.campaigns,
        genIndex: s.genIndex,
      }),
      // Schema changed (images, headlines, approval) — reset older stores to the
      // fresh seed rather than trying to backfill missing fields.
      migrate: () => ({
        items: SEED_ITEMS,
        campaigns: SEED_CAMPAIGNS,
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
