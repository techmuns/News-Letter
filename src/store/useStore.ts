import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  type Campaign,
  type ChannelKind,
  type ChannelContentMap,
  type ChannelStatus,
  type GenerationState,
  type WorkspaceItem,
  type WorkspaceItemType,
} from '../types'
import { promotionById, MAX_FILE_BYTES } from '../config'
import { deleteFile, putFile } from '../lib/fileStore'
import { makeThumbnail } from '../lib/thumbnail'
import { generateCampaign, toSections, GenerateError } from '../lib/generate'

function uid(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

/** Classifies an upload for display purposes. */
export function typeFromFile(file: File): WorkspaceItemType {
  if (file.type === 'application/pdf') return 'pdf'
  if (file.type.startsWith('image/')) return 'screenshot'
  return 'note'
}

function formatBytes(n: number): string {
  if (!n) return ''
  const kb = n / 1024
  if (kb < 1024) return `${Math.max(1, Math.round(kb))} KB`
  return `${(kb / 1024).toFixed(1)} MB`
}

interface StoreState {
  items: WorkspaceItem[]
  campaigns: Campaign[]
  generation: GenerationState
  /** the last campaign generated (for surfacing/scroll) */
  lastGeneratedId: string | null

  // --- Workspace actions ---
  addNote: (text: string, addedBy?: string) => void
  /** Reads real files, stores payloads in IndexedDB. Returns any rejections. */
  addFiles: (files: File[], addedBy?: string) => Promise<string[]>
  removeItem: (id: string) => void

  // --- Generation ---
  /** Drafts a campaign from the selected items. Resolves to the new id, or null on failure. */
  turnIntoContent: (itemIds: string[]) => Promise<string | null>
  /** Re-drafts every channel of an existing campaign from its original sources. */
  regenerateCampaign: (campaignId: string) => Promise<boolean>
  clearGenerationError: () => void

  // --- Campaign / channel actions ---
  approveChannel: (campaignId: string, kind: ChannelKind) => void
  approveCampaign: (campaignId: string) => void
  setChannelStatus: (campaignId: string, kind: ChannelKind, status: ChannelStatus) => void
  scheduleChannel: (campaignId: string, kind: ChannelKind, date: string) => void
  /** Applies a human edit and marks the version as edited. */
  updateChannelContent: <K extends ChannelKind>(
    campaignId: string,
    kind: K,
    patch: Partial<ChannelContentMap[K]>,
  ) => void
}

export const useStore = create<StoreState>()(
  persist(
    (set, get) => ({
      items: [],
      campaigns: [],
      generation: { status: 'idle' },
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

      addFiles: async (files, addedBy = 'You') => {
        const rejected: string[] = []
        const accepted: WorkspaceItem[] = []

        for (const file of files) {
          if (file.size > MAX_FILE_BYTES) {
            rejected.push(`${file.name} is ${formatBytes(file.size)} — the limit is 8 MB.`)
            continue
          }

          const id = uid('item')
          const type = typeFromFile(file)
          const mediaType = file.type || 'application/octet-stream'

          try {
            await putFile({ id, mediaType, filename: file.name, blob: file })
          } catch {
            rejected.push(`${file.name} could not be saved to local storage.`)
            continue
          }

          accepted.push({
            id,
            type,
            title: file.name,
            preview: `${type === 'pdf' ? 'PDF' : type === 'screenshot' ? 'Image' : 'File'} · ${formatBytes(file.size)}`,
            thumbnail: await makeThumbnail(file),
            mediaType,
            bytes: file.size,
            hasPayload: true,
            addedBy,
            createdAt: new Date().toISOString(),
          })
        }

        if (accepted.length) set((s) => ({ items: [...accepted, ...s.items] }))
        return rejected
      },

      removeItem: (id) => {
        const item = get().items.find((i) => i.id === id)
        if (item?.hasPayload) void deleteFile(id)
        set((s) => ({ items: s.items.filter((i) => i.id !== id) }))
      },

      turnIntoContent: async (itemIds) => {
        const items = get().items.filter((i) => itemIds.includes(i.id))
        if (items.length === 0) return null

        set({ generation: { status: 'running', itemIds } })

        try {
          const draft = await generateCampaign(items)
          const id = uid('camp')
          // Carry a selected screenshot through as the campaign's hero image.
          const heroImage = items.map((i) => i.thumbnail).find(Boolean)

          const campaign: Campaign = {
            id,
            name: draft.name,
            topic: draft.topic,
            createdAt: new Date().toISOString(),
            sourceItemIds: itemIds,
            heroImage,
            promo: promotionById(draft.promoId),
            // Each channel awaits its own review before it distributes.
            linkedin: {
              kind: 'linkedin',
              status: 'In Review',
              edited: false,
              approved: false,
              content: draft.linkedin,
            },
            email: {
              kind: 'email',
              status: 'In Review',
              edited: false,
              approved: false,
              content: draft.email,
            },
            article: {
              kind: 'article',
              status: 'In Review',
              edited: false,
              approved: false,
              content: { ...draft.article, sections: toSections(draft.article.sections) },
            },
          }

          set((s) => ({
            campaigns: [campaign, ...s.campaigns],
            generation: { status: 'idle' },
            lastGeneratedId: id,
          }))
          return id
        } catch (err) {
          set({
            generation: {
              status: 'error',
              message:
                err instanceof GenerateError
                  ? err.message
                  : 'Something went wrong while drafting. Try again.',
            },
          })
          return null
        }
      },

      regenerateCampaign: async (campaignId) => {
        const campaign = get().campaigns.find((c) => c.id === campaignId)
        if (!campaign) return false

        const items = get().items.filter((i) => campaign.sourceItemIds.includes(i.id))
        if (items.length === 0) {
          set({
            generation: {
              status: 'error',
              message:
                'The source material for this campaign is no longer in the pile, so it cannot be re-drafted.',
            },
          })
          return false
        }

        set({ generation: { status: 'running', itemIds: campaign.sourceItemIds } })

        try {
          const draft = await generateCampaign(items)
          set((s) => ({
            campaigns: s.campaigns.map((c) =>
              c.id === campaignId
                ? {
                    ...c,
                    name: draft.name,
                    topic: draft.topic,
                    promo: promotionById(draft.promoId),
                    linkedin: {
                      ...c.linkedin,
                      content: draft.linkedin,
                      edited: false,
                      approved: false,
                      status: 'In Review' as ChannelStatus,
                    },
                    email: {
                      ...c.email,
                      content: draft.email,
                      edited: false,
                      approved: false,
                      status: 'In Review' as ChannelStatus,
                    },
                    article: {
                      ...c.article,
                      content: {
                        ...draft.article,
                        sections: toSections(draft.article.sections),
                      },
                      edited: false,
                      approved: false,
                      status: 'In Review' as ChannelStatus,
                    },
                  }
                : c,
            ),
            generation: { status: 'idle' },
          }))
          return true
        } catch (err) {
          set({
            generation: {
              status: 'error',
              message:
                err instanceof GenerateError
                  ? err.message
                  : 'Something went wrong while re-drafting. Try again.',
            },
          })
          return false
        }
      },

      clearGenerationError: () => set({ generation: { status: 'idle' } }),

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
            c.id === campaignId ? { ...c, [kind]: { ...c[kind], status } } : c,
          ),
        })),

      scheduleChannel: (campaignId, kind, date) =>
        set((s) => ({
          campaigns: s.campaigns.map((c) =>
            c.id === campaignId
              ? {
                  ...c,
                  [kind]: { ...c[kind], scheduledDate: date, status: 'Scheduled' as ChannelStatus },
                }
              : c,
          ),
        })),

      updateChannelContent: (campaignId, kind, patch) =>
        set((s) => ({
          campaigns: s.campaigns.map((c) =>
            c.id === campaignId
              ? {
                  ...c,
                  [kind]: {
                    ...c[kind],
                    content: { ...c[kind].content, ...patch },
                    edited: true,
                  },
                }
              : c,
          ),
        })),
    }),
    {
      name: 'munshot-content-store',
      // v4 removed all seeded mock content and changed the content shapes.
      version: 4,
      partialize: (s) => ({
        items: s.items,
        campaigns: s.campaigns,
      }),
      // Older stores held mock campaigns in the previous shape — drop them
      // rather than trying to backfill fields that never had real values.
      migrate: () => ({ items: [], campaigns: [] }),
      // A generation in flight when the tab closed is not resumable.
      onRehydrateStorage: () => (state) => {
        if (state) state.generation = { status: 'idle' }
      },
    },
  ),
)
