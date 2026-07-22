import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  type Campaign,
  type ChannelContent,
  type ChannelKind,
  type ChannelStatus,
  type ChannelVersion,
  type GenerationBrief,
  type SourceMode,
  type WorkspaceItem,
  type WorkspaceItemType,
} from '../types'
import {
  SEED_ITEMS,
  SEED_CAMPAIGNS,
  GENERATABLE,
  PROMOTIONS,
} from '../data/mockData'
import { DEFAULT_BRIEF } from '../lib/brief'
import { composeDraft } from '../lib/generate'

/** Input the Workspace hands to the draft generator. */
export interface GenerateInput {
  sourceMode: SourceMode
  /** pile item ids (manual) — used to carry a hero image through */
  sourceItemIds?: string[]
  /** human-readable labels of the inputs (pile titles or monitored sources) */
  sourceLabels?: string[]
}

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
  /** the campaign currently being composed & edited in the Workspace */
  draftId: string | null
  /** the persisted content-settings brief applied to every generation */
  brief: GenerationBrief

  // --- Workspace actions ---
  /** patch one or more fields of the persisted content-settings brief */
  updateBrief: (patch: Partial<GenerationBrief>) => void
  addNote: (text: string, addedBy?: string) => void
  addFiles: (
    files: { name: string; sizeLabel?: string; imageUrl?: string }[],
    addedBy?: string,
  ) => void
  removeItem: (id: string) => void

  /** Mocked "Turn into content": creates a Campaign + 3 channel drafts. */
  turnIntoContent: (itemIds: string[], brief?: GenerationBrief) => string

  // --- Workspace draft (generate-inside-the-workspace) ---
  /** Generate a fresh draft campaign (hidden from Preview until committed). */
  generateDraft: (input: GenerateInput) => string
  /** Re-run generation for the active draft using the latest settings + sources. */
  regenerateDraft: (input: GenerateInput) => void
  /** Manually edit the active draft's primary copy (headline / body). */
  updateDraftContent: (patch: { title?: string; body?: string }) => void
  /** Throw the active draft away. */
  discardDraft: () => void
  /** Mark the draft ready and reveal it in Preview; returns its id to navigate. */
  commitDraft: () => string | null

  // --- Campaign / channel actions ---
  /** Simulated "Publish Now" — pushes the given channels to Published. */
  publishChannels: (campaignId: string, kinds: ChannelKind[]) => void
  /** "Schedule for Later" — sends the given channels to the Scheduling queue. */
  sendChannelsToScheduling: (campaignId: string, kinds: ChannelKind[]) => void
  /** Schedule a channel at a specific date + time. */
  scheduleChannelAt: (campaignId: string, kind: ChannelKind, date: string, time: string) => void
  /** Set a channel's editable caption/copy (used in the schedule composer). */
  setChannelCaption: (campaignId: string, kind: ChannelKind, caption: string) => void
  /** Approve one channel → it moves to Ready and distributes to its space. */
  approveChannel: (campaignId: string, kind: ChannelKind) => void
  /** Approve all three channels at once. */
  approveCampaign: (campaignId: string) => void
  setChannelStatus: (campaignId: string, kind: ChannelKind, status: ChannelStatus) => void
  scheduleChannel: (campaignId: string, kind: ChannelKind, date: string) => void
  /** Pulls a Scheduled channel back to Ready and clears its date. */
  unscheduleChannel: (campaignId: string, kind: ChannelKind) => void
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
      draftId: null,
      brief: DEFAULT_BRIEF,

      updateBrief: (patch) => set((s) => ({ brief: { ...s.brief, ...patch } })),

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

      turnIntoContent: (itemIds, brief) => {
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
          brief,
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

      generateDraft: ({ sourceMode, sourceItemIds = [], sourceLabels = [] }) => {
        const seed = get().genIndex
        const brief = get().brief
        const d = composeDraft({ brief, sourceMode, sourceLabels, seed })
        const id = uid('camp')
        const items = get().items
        const heroFromSelection = sourceItemIds
          .map((iid) => items.find((it) => it.id === iid)?.imageUrl)
          .find(Boolean)
        const mk = <T extends ChannelContent>(kind: ChannelKind, content: T): ChannelVersion<T> => ({
          kind,
          status: 'Draft',
          edited: false,
          approved: false,
          content,
        })
        const campaign: Campaign = {
          id,
          name: d.name,
          topic: d.topic,
          createdAt: new Date().toISOString(),
          sourceItemIds,
          heroImage: heroFromSelection ?? d.heroImage,
          promo: PROMOTIONS.find((p) => p.id === d.promoId),
          brief,
          sourceMode,
          sources: sourceLabels.length ? sourceLabels : undefined,
          draft: true,
          linkedin: mk('linkedin', d.linkedin),
          email: mk('email', d.email),
          article: mk('article', d.article),
        }
        set((s) => ({
          campaigns: [campaign, ...s.campaigns],
          genIndex: s.genIndex + 1,
          draftId: id,
          lastGeneratedId: id,
        }))
        return id
      },

      regenerateDraft: ({ sourceMode, sourceLabels = [] }) => {
        const { draftId, genIndex, brief } = get()
        if (!draftId) return
        const d = composeDraft({ brief, sourceMode, sourceLabels, seed: genIndex })
        set((s) => ({
          genIndex: s.genIndex + 1,
          campaigns: s.campaigns.map((c) =>
            c.id === draftId
              ? {
                  ...c,
                  name: d.name,
                  topic: d.topic,
                  heroImage: c.heroImage ?? d.heroImage,
                  brief,
                  sourceMode,
                  sources: sourceLabels.length ? sourceLabels : undefined,
                  promo: PROMOTIONS.find((p) => p.id === d.promoId),
                  linkedin: { ...c.linkedin, edited: false, content: d.linkedin },
                  email: { ...c.email, edited: false, content: d.email },
                  article: { ...c.article, edited: false, content: d.article },
                }
              : c,
          ),
        }))
      },

      updateDraftContent: (patch) =>
        set((s) => ({
          campaigns: s.campaigns.map((c) =>
            c.id === s.draftId
              ? {
                  ...c,
                  linkedin: {
                    ...c.linkedin,
                    edited: true,
                    content: {
                      ...c.linkedin.content,
                      ...(patch.title !== undefined ? { headline: patch.title } : {}),
                      ...(patch.body !== undefined ? { body: patch.body } : {}),
                    },
                  },
                }
              : c,
          ),
        })),

      discardDraft: () =>
        set((s) => ({
          campaigns: s.campaigns.filter((c) => c.id !== s.draftId),
          draftId: null,
        })),

      commitDraft: () => {
        const id = get().draftId
        if (!id) return null
        const ready = <T extends ChannelContent>(ch: ChannelVersion<T>): ChannelVersion<T> =>
          ch.status === 'Scheduled' || ch.status === 'Published'
            ? { ...ch, approved: true }
            : { ...ch, approved: true, status: 'Ready' as ChannelStatus }
        set((s) => ({
          draftId: null,
          campaigns: s.campaigns.map((c) =>
            c.id === id
              ? {
                  ...c,
                  draft: false,
                  linkedin: ready(c.linkedin),
                  email: ready(c.email),
                  article: ready(c.article),
                }
              : c,
          ),
        }))
        return id
      },

      publishChannels: (campaignId, kinds) =>
        set((s) => ({
          campaigns: s.campaigns.map((c) => {
            if (c.id !== campaignId) return c
            let next: Campaign = c
            for (const k of kinds) {
              next = { ...next, [k]: { ...next[k], approved: true, status: 'Published' as ChannelStatus } }
            }
            return next
          }),
        })),

      sendChannelsToScheduling: (campaignId, kinds) =>
        set((s) => ({
          campaigns: s.campaigns.map((c) => {
            if (c.id !== campaignId) return c
            let next: Campaign = c
            for (const k of kinds) {
              // keep an existing schedule; otherwise park it in the Ready queue
              next =
                next[k].status === 'Scheduled'
                  ? { ...next, [k]: { ...next[k], approved: true } }
                  : { ...next, [k]: { ...next[k], approved: true, status: 'Ready' as ChannelStatus } }
            }
            return next
          }),
        })),

      scheduleChannelAt: (campaignId, kind, date, time) =>
        set((s) => ({
          campaigns: s.campaigns.map((c) =>
            c.id === campaignId
              ? {
                  ...c,
                  [kind]: {
                    ...c[kind],
                    approved: true,
                    scheduledDate: date,
                    scheduledTime: time,
                    status: 'Scheduled' as ChannelStatus,
                  },
                }
              : c,
          ),
        })),

      setChannelCaption: (campaignId, kind, caption) =>
        set((s) => ({
          campaigns: s.campaigns.map((c) =>
            c.id === campaignId ? { ...c, [kind]: { ...c[kind], caption } } : c,
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

      unscheduleChannel: (campaignId, kind) =>
        set((s) => ({
          campaigns: s.campaigns.map((c) =>
            c.id === campaignId
              ? { ...c, [kind]: { ...c[kind], scheduledDate: undefined, status: 'Ready' as ChannelStatus } }
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
      version: 6,
      partialize: (s) => ({
        items: s.items,
        campaigns: s.campaigns,
        genIndex: s.genIndex,
        brief: s.brief,
      }),
      // Schema changed (images, headlines, approval, briefs, settings, drafts) —
      // reset older stores to the fresh seed rather than backfilling fields.
      migrate: () => ({
        items: SEED_ITEMS,
        campaigns: SEED_CAMPAIGNS,
        genIndex: 0,
        brief: DEFAULT_BRIEF,
      }),
      // Drop any half-composed drafts and clear in-flight processing flags that
      // were persisted mid-action.
      onRehydrateStorage: () => (state) => {
        if (!state) return
        state.draftId = null
        state.campaigns = state.campaigns
          .filter((c) => !c.draft)
          .map((c) => (c.processing ? { ...c, processing: false } : c))
      },
    },
  ),
)
