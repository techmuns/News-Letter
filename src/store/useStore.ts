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
  removeItem: (id: string) => void

  /** Mocked "Turn into content": creates a Campaign + 3 channel drafts. */
  turnIntoContent: (itemIds: string[]) => string

  // --- Campaign / channel actions ---
  /** Approve the generated drafts → channels move to Ready, distributed to spaces. */
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
          approved: false, // awaits review before it distributes to the channels
          promo: PROMOTIONS.find((p) => p.id === tpl.promoId),
          linkedin: { kind: 'linkedin', status: 'In Review', edited: false, content: tpl.linkedin },
          email: { kind: 'email', status: 'In Review', edited: false, content: tpl.email },
          article: { kind: 'article', status: 'In Review', edited: false, content: tpl.article },
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

      approveCampaign: (campaignId) =>
        set((s) => ({
          campaigns: s.campaigns.map((c) =>
            c.id === campaignId
              ? {
                  ...c,
                  approved: true,
                  linkedin: { ...c.linkedin, status: 'Ready' },
                  email: { ...c.email, status: 'Ready' },
                  article: { ...c.article, status: 'Ready' },
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
      version: 2,
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
