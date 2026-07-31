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
  heroForPromo,
} from '../data/mockData'
import type { HarvestSourceResult, HarvestedPost } from '../../shared/harvest'
import { DEFAULT_VOICE_IDS } from '../../shared/voices'
import { runHarvest, readPost } from '../lib/harvestClient'
import { composeFromPosts } from '../lib/compose'

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

/** A harvested post lands in the pile under a stable, dedupable id. */
function itemIdForPost(post: HarvestedPost): string {
  return `item-${post.id}`
}

const PROCESSING_MS = 2000
/** How many fresh posts auto-generate turns into campaigns in one harvest. */
const AUTO_GENERATE_CAP = 3

export type HarvestPhase = 'idle' | 'running' | 'done' | 'error'

export interface HarvestState {
  phase: HarvestPhase
  /** true when the last harvest actually came back from Firecrawl */
  live: boolean
  /** per-voice outcome — failures are surfaced, not swallowed */
  sources: HarvestSourceResult[]
  notice?: string
  error?: string
  lastRunAt?: string
  newPostCount: number
}

const IDLE_HARVEST: HarvestState = {
  phase: 'idle',
  live: false,
  sources: [],
  newPostCount: 0,
}

interface StoreState {
  items: WorkspaceItem[]
  campaigns: Campaign[]
  /** full harvested posts (incl. markdown once deep-read), keyed by post id */
  posts: Record<string, HarvestedPost>
  /** rotates through generatable templates for the mocked action */
  genIndex: number
  /** the last campaign generated from the pile (for surfacing/scroll) */
  lastGeneratedId: string | null

  // --- Auto-generator ---
  selectedVoiceIds: string[]
  autoGenerate: boolean
  harvest: HarvestState
  /** soft note from the last generation (e.g. deep read unavailable) */
  generationNotice: string | null

  toggleVoice: (voiceId: string) => void
  setSelectedVoices: (voiceIds: string[]) => void
  setAutoGenerate: (on: boolean) => void
  /** Scrape the selected finance voices and drop their posts into the pile. */
  runSignalHarvest: () => Promise<void>

  // --- Workspace actions ---
  addNote: (text: string, addedBy?: string) => void
  addFiles: (
    files: { name: string; sizeLabel?: string; imageUrl?: string }[],
    addedBy?: string,
  ) => void
  removeItem: (id: string) => void

  /** Turns pile items into a Campaign + 3 channel drafts. Harvested posts are
      composed from their real text; everything else uses the mock templates. */
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
      posts: {},
      genIndex: 0,
      lastGeneratedId: null,

      selectedVoiceIds: DEFAULT_VOICE_IDS,
      autoGenerate: false,
      harvest: IDLE_HARVEST,
      generationNotice: null,

      toggleVoice: (voiceId) =>
        set((s) => ({
          selectedVoiceIds: s.selectedVoiceIds.includes(voiceId)
            ? s.selectedVoiceIds.filter((id) => id !== voiceId)
            : [...s.selectedVoiceIds, voiceId],
        })),

      setSelectedVoices: (voiceIds) => set({ selectedVoiceIds: voiceIds }),

      setAutoGenerate: (on) => set({ autoGenerate: on }),

      runSignalHarvest: async () => {
        if (get().harvest.phase === 'running') return
        set((s) => ({ harvest: { ...s.harvest, phase: 'running', error: undefined } }))

        try {
          const res = await runHarvest({ voiceIds: get().selectedVoiceIds, perVoice: 3 })

          // Only posts we have not already piled count as new.
          const known = get().posts
          const fresh = res.posts.filter((p) => !known[p.id])

          const newItems: WorkspaceItem[] = fresh.map((p) => ({
            id: itemIdForPost(p),
            type: 'post',
            title: p.title,
            // May be empty — the card then just shows the attribution row
            // rather than padding with a raw URL.
            preview: p.excerpt,
            addedBy: p.author,
            createdAt: new Date().toISOString(),
            voiceId: p.voiceId,
            source: {
              author: p.author,
              authorRole: p.authorRole,
              outlet: p.outlet,
              title: p.title,
              url: p.url,
              publishedAt: p.publishedAt,
            },
          }))

          set((s) => ({
            items: [...newItems, ...s.items],
            posts: {
              ...s.posts,
              ...Object.fromEntries(res.posts.map((p) => [p.id, { ...s.posts[p.id], ...p }])),
            },
            harvest: {
              phase: 'done',
              live: res.live,
              sources: res.sources,
              notice: res.notice,
              lastRunAt: res.harvestedAt,
              newPostCount: fresh.length,
            },
          }))

          if (get().autoGenerate) {
            for (const post of fresh.slice(0, AUTO_GENERATE_CAP)) {
              get().turnIntoContent([itemIdForPost(post)])
            }
          }
        } catch (err) {
          set((s) => ({
            harvest: {
              ...s.harvest,
              phase: 'error',
              error: err instanceof Error ? err.message : 'Harvest failed',
              lastRunAt: new Date().toISOString(),
            },
          }))
        }
      },

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
        const id = uid('camp')
        const now = new Date().toISOString()
        const items = get().items
        const selected = itemIds
          .map((iid) => items.find((it) => it.id === iid))
          .filter((it): it is WorkspaceItem => Boolean(it))

        // Real scraped posts take precedence — they are what the generator reads.
        const postsInSelection = selected
          .filter((it) => it.type === 'post' && it.source)
          .map((it) => get().posts[it.id.replace(/^item-/, '')])
          .filter((p): p is HarvestedPost => Boolean(p))

        const heroFromSelection = selected.map((it) => it.imageUrl).find(Boolean)

        // Base campaign, shown immediately in its processing state.
        const tpl = GENERATABLE[get().genIndex % GENERATABLE.length]
        const campaign: Campaign = {
          id,
          name: postsInSelection[0]?.title ?? tpl.name,
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
          generationNotice: null,
        }))

        if (postsInSelection.length === 0) {
          // No real source material — settle on the mock template.
          setTimeout(() => {
            set((s) => ({
              campaigns: s.campaigns.map((c) => (c.id === id ? { ...c, processing: false } : c)),
            }))
          }, PROCESSING_MS)
          return id
        }

        // Real material: deep-read the lead post, then compose from its own words.
        void (async () => {
          let notice: string | null = null
          let sourcePosts = postsInSelection
          const lead = postsInSelection[0]

          if (!lead.markdown) {
            try {
              const read = await readPost(lead.url)
              if (read.markdown) {
                const withText = { ...lead, markdown: read.markdown }
                sourcePosts = [withText, ...postsInSelection.slice(1)]
                set((s) => ({ posts: { ...s.posts, [lead.id]: withText } }))
              } else {
                notice = read.notice ?? 'Full text unavailable — composed from the published excerpt.'
              }
            } catch (err) {
              notice = `Full text unavailable (${
                err instanceof Error ? err.message : 'read failed'
              }) — composed from the published excerpt.`
            }
          }

          const draft = composeFromPosts(sourcePosts)
          set((s) => ({
            generationNotice: notice,
            campaigns: s.campaigns.map((c) =>
              c.id === id
                ? {
                    ...c,
                    name: draft.name,
                    topic: draft.topic,
                    sources: draft.sources,
                    heroImage: heroFromSelection ?? heroForPromo(draft.promoId),
                    promo: PROMOTIONS.find((p) => p.id === draft.promoId),
                    linkedin: { ...c.linkedin, content: draft.linkedin },
                    email: { ...c.email, content: draft.email },
                    article: { ...c.article, content: draft.article },
                    processing: false,
                  }
                : c,
            ),
          }))
        })()

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
        const campaign = get().campaigns.find((c) => c.id === campaignId)
        const posts = (campaign?.sourceItemIds ?? [])
          .map((iid) => get().posts[iid.replace(/^item-/, '')])
          .filter((p): p is HarvestedPost => Boolean(p))

        // Re-compose from the real source when there is one; otherwise rotate
        // through the mock templates as before.
        const content = posts.length
          ? composeFromPosts(posts)[kind]
          : GENERATABLE[get().genIndex % GENERATABLE.length][kind]

        set((s) => ({
          genIndex: posts.length ? s.genIndex : s.genIndex + 1,
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
      version: 4,
      partialize: (s) => ({
        items: s.items,
        campaigns: s.campaigns,
        posts: s.posts,
        genIndex: s.genIndex,
        selectedVoiceIds: s.selectedVoiceIds,
        autoGenerate: s.autoGenerate,
      }),
      // Schema changed (harvested posts, sources) — reset older stores to the
      // fresh seed rather than trying to backfill missing fields.
      migrate: () => ({
        items: SEED_ITEMS,
        campaigns: SEED_CAMPAIGNS,
        posts: {},
        genIndex: 0,
        selectedVoiceIds: DEFAULT_VOICE_IDS,
        autoGenerate: false,
      }),
      // Clear any in-flight processing flags that were persisted mid-action.
      onRehydrateStorage: () => (state) => {
        if (!state) return
        state.campaigns = state.campaigns.map((c) =>
          c.processing ? { ...c, processing: false } : c,
        )
        state.harvest = IDLE_HARVEST
      },
    },
  ),
)
