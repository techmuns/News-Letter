import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  type Campaign,
  type ChannelContent,
  type ChannelKind,
  type ChannelStatus,
  type ChannelVersion,
  type GenerationBrief,
  type MaterialGroup,
  type MaterialOutline,
  type SourceMode,
  type WorkspaceAttachment,
  type WorkspaceItem,
  type WorkspaceItemType,
} from '../types'
import {
  SEED_ITEMS,
  SEED_CAMPAIGNS,
  GENERATABLE,
  PROMOTIONS,
} from '../data/mockData'
import {
  type MonitoredSource,
  type SourceKind,
  initialsFor,
  normaliseHandle,
} from '../data/sources'
import { DEFAULT_BRIEF } from '../lib/brief'
import { extractUrl } from '../lib/extract'
import { composeDraft } from '../lib/generate'
import { type ComposedOutline, composeOutline } from '../lib/outline'

/** The opening line of a read document — used as its on-card preview. */
function firstLineOf(text: string, max = 120): string {
  const line = text.replace(/\f/g, ' ').replace(/\s+/g, ' ').trim()
  return line.length > max ? `${line.slice(0, max - 1)}…` : line
}

/**
 * How much extracted text is kept per material when the store is written to
 * localStorage. Forty pages of a prospectus is ~100 KB of text, and a browser
 * gives the whole origin about 5 MB — a handful of documents would blow the
 * quota, and a failed write loses the author's write-up along with it.
 *
 * The quotes the post uses come from the front of the document, so keeping the
 * opening is what preserves the write-up across a reload.
 */
const PERSIST_TEXT_LIMIT = 24_000

function trimGroupForStorage(g: MaterialGroup): MaterialGroup {
  if (!g.items.some((it) => (it.extracted?.length ?? 0) > PERSIST_TEXT_LIMIT)) return g
  return {
    ...g,
    items: g.items.map((it) =>
      (it.extracted?.length ?? 0) > PERSIST_TEXT_LIMIT
        ? { ...it, extracted: it.extracted!.slice(0, PERSIST_TEXT_LIMIT) }
        : it,
    ),
  }
}

/** A freshly composed write-up as it's stored: unedited, provenance kept. */
function asOutline(c: ComposedOutline): MaterialOutline {
  return {
    headline: c.headline,
    body: c.body,
    edited: false,
    pattern: c.pattern,
    ...(c.dashboard ? { dashboard: c.dashboard } : {}),
  }
}

/** Input the Workspace hands to the draft generator. */
export interface GenerateInput {
  sourceMode: SourceMode
  /** material ids (manual) — used to carry a hero image through */
  sourceItemIds?: string[]
  /** human-readable labels of the inputs (material titles or monitored sources) */
  sourceLabels?: string[]
  /** the step-one write-up the author approved, when generating from materials */
  outline?: { headline: string; body: string; pattern?: string; dashboard?: string }
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

/**
 * Appends materials to the open group, starting a group if none is open.
 * Returned as a set-updater so every add path shares the same behaviour.
 */
function pushIntoOpenGroup(...items: WorkspaceItem[]) {
  return (s: StoreState): Partial<StoreState> => {
    const openId = s.openGroupId
    if (openId && s.groups.some((g) => g.id === openId)) {
      return {
        groups: s.groups.map((g) =>
          g.id === openId ? { ...g, items: [...g.items, ...items] } : g,
        ),
      }
    }
    const group: MaterialGroup = {
      id: uid('grp'),
      items,
      createdAt: new Date().toISOString(),
    }
    return { groups: [group, ...s.groups], openGroupId: group.id }
  }
}

interface StoreState {
  items: WorkspaceItem[]
  /** material groups, newest first — each is the source set for one post */
  groups: MaterialGroup[]
  /** the group currently being collected, if the panel is mid-flow */
  openGroupId: string | null
  campaigns: Campaign[]
  /** rotates through generatable templates for the mocked action */
  genIndex: number
  /** the last campaign generated from your materials (for surfacing/scroll) */
  lastGeneratedId: string | null
  /** the campaign currently being composed & edited in the Workspace */
  draftId: string | null
  /** the persisted content-settings brief applied to every generation */
  brief: GenerationBrief
  /** LinkedIn profiles/pages the user added themselves, on top of the catalog */
  customSources: MonitoredSource[]
  /** ids of built-in catalog sources the user removed */
  hiddenSourceIds: string[]

  // --- Monitored source actions ---
  /** Add a LinkedIn profile or company page to the monitored catalog. */
  addSource: (input: { name: string; handle: string; kind: SourceKind }) => string | null
  /** Remove any source — deletes user-added ones, hides catalog ones. */
  removeSource: (id: string) => void
  /** Bring every removed catalog source back. */
  restoreSources: () => void

  // --- Workspace actions ---
  /** patch one or more fields of the persisted content-settings brief */
  updateBrief: (patch: Partial<GenerationBrief>) => void
  addNote: (
    text: string,
    opts?: { addedBy?: string; attachments?: { name: string; sizeLabel?: string; imageUrl?: string }[] },
  ) => void
  addFiles: (
    files: { name: string; sizeLabel?: string; imageUrl?: string }[],
    addedBy?: string,
  ) => void
  /** attach one or more files onto an existing material (e.g. a note) */
  addAttachments: (itemId: string, files: { name: string; sizeLabel?: string; imageUrl?: string }[]) => void
  removeItem: (id: string) => void

  // --- Material groups (one group = one post) ---
  /** Add a note/link/pasted-text material to the open group; returns its ids. */
  addGroupNote: (input: {
    type: 'note' | 'link'
    text: string
    url?: string
  }) => { groupId: string; itemId: string } | null
  /** Add one or more files to the open group, text included when it was read. */
  addGroupFiles: (
    files: {
      name: string
      sizeLabel?: string
      imageUrl?: string
      extracted?: string
      pages?: number
      readError?: string
    }[],
  ) => void
  /** Fetch a pasted link's article text, then recompose the write-up around it. */
  readGroupLink: (groupId: string, itemId: string) => Promise<void>
  /** Rename or retitle a material inside a group. */
  updateGroupItem: (groupId: string, itemId: string, patch: Partial<WorkspaceItem>) => void
  /** Drop a material out of a group. */
  removeGroupItem: (groupId: string, itemId: string) => void
  /** Close the open group and compose its step-one write-up. */
  finishGroup: () => void
  /** Edit the group's write-up by hand. */
  updateOutline: (groupId: string, patch: Partial<Pick<MaterialOutline, 'headline' | 'body'>>) => void
  /** Throw the author's edits away and recompose from the materials. */
  recomposeOutline: (groupId: string) => void
  /** Reopen a finished group to add or edit its materials. */
  reopenGroup: (groupId: string) => void
  /** Throw a whole group away. */
  discardGroup: (groupId: string) => void

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
      groups: [],
      openGroupId: null,
      campaigns: SEED_CAMPAIGNS,
      genIndex: 0,
      lastGeneratedId: null,
      draftId: null,
      brief: DEFAULT_BRIEF,
      customSources: [],
      hiddenSourceIds: [],

      addSource: ({ name, handle, kind }) => {
        const trimmed = name.trim()
        if (!trimmed) return null
        const detail = normaliseHandle(handle)
        // Don't add the same profile twice.
        const existing = get().customSources.find(
          (s) => s.name.toLowerCase() === trimmed.toLowerCase() || s.detail === detail,
        )
        if (existing) return existing.id
        const source: MonitoredSource = {
          id: uid('src'),
          kind,
          name: trimmed,
          detail,
          avatar: initialsFor(trimmed),
          signal: 'Added by you',
        }
        set((s) => ({ customSources: [source, ...s.customSources] }))
        return source.id
      },

      // A user-added source is deleted outright; a built-in one is remembered as
      // hidden so "Restore" can bring the catalog back.
      removeSource: (id) =>
        set((s) =>
          s.customSources.some((c) => c.id === id)
            ? { customSources: s.customSources.filter((c) => c.id !== id) }
            : s.hiddenSourceIds.includes(id)
              ? s
              : { hiddenSourceIds: [...s.hiddenSourceIds, id] },
        ),

      restoreSources: () => set({ hiddenSourceIds: [] }),

      // The panel promises these settings apply to everything you generate, so
      // changing one has to reshape the write-ups that are still waiting. Only
      // the untouched ones: an author's own words are never overwritten by a
      // dropdown — those carry a "Rebuild" button instead.
      updateBrief: (patch) =>
        set((s) => {
          const brief = { ...s.brief, ...patch }
          return {
            brief,
            groups: s.groups.map((g) =>
              g.outline && !g.outline.edited && g.items.length > 0
                ? { ...g, outline: asOutline(composeOutline(g, brief)) }
                : g,
            ),
          }
        }),

      addNote: (text, opts = {}) => {
        const trimmed = text.trim()
        if (!trimmed) return
        const firstLine = trimmed.split('\n')[0]
        const attachments: WorkspaceAttachment[] = (opts.attachments ?? []).map((f) => ({
          id: uid('att'),
          name: f.name,
          sizeLabel: f.sizeLabel,
          imageUrl: f.imageUrl,
        }))
        const item: WorkspaceItem = {
          id: uid('item'),
          type: 'note',
          title: firstLine.length > 60 ? `${firstLine.slice(0, 57)}…` : firstLine,
          preview: trimmed,
          addedBy: opts.addedBy ?? 'You',
          createdAt: new Date().toISOString(),
          ...(attachments.length ? { attachments } : {}),
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

      addAttachments: (itemId, files) => {
        if (!files.length) return
        const newAttachments: WorkspaceAttachment[] = files.map((f) => ({
          id: uid('att'),
          name: f.name,
          sizeLabel: f.sizeLabel,
          imageUrl: f.imageUrl,
        }))
        set((s) => ({
          items: s.items.map((it) =>
            it.id === itemId
              ? { ...it, attachments: [...(it.attachments ?? []), ...newAttachments] }
              : it,
          ),
        }))
      },

      removeItem: (id) =>
        set((s) => ({ items: s.items.filter((i) => i.id !== id) })),

      /* ---- Material groups ----------------------------------------------
         Materials land in the open group. If none is open, adding the first
         material starts one, so the user never has to "create a group"
         before they can begin.
         ------------------------------------------------------------------ */

      addGroupNote: ({ type, text, url }) => {
        const trimmed = text.trim()
        if (!trimmed && !url) return null
        const firstLine = (trimmed || url || '').split('\n')[0]
        const item: WorkspaceItem = {
          id: uid('item'),
          type,
          title: firstLine.length > 60 ? `${firstLine.slice(0, 57)}…` : firstLine,
          preview: trimmed,
          ...(url ? { url } : {}),
          addedBy: 'You',
          createdAt: new Date().toISOString(),
        }
        set(pushIntoOpenGroup(item))
        // The caller needs the ids so a pasted link can be read straight away.
        return { groupId: get().openGroupId as string, itemId: item.id }
      },

      addGroupFiles: (files) => {
        if (!files.length) return
        const newItems: WorkspaceItem[] = files.map((f) => {
          const type = f.imageUrl ? 'screenshot' : typeFromName(f.name)
          return {
            id: uid('item'),
            type,
            title: f.name,
            // Once a document has been read, its own first line is a better
            // preview than its size — the author can see we opened it.
            preview: f.extracted ? firstLineOf(f.extracted) : (f.sizeLabel ?? ''),
            imageUrl: f.imageUrl,
            addedBy: 'You',
            createdAt: new Date().toISOString(),
            ...(f.extracted ? { extracted: f.extracted, readState: 'read' as const } : {}),
            ...(f.pages ? { pages: f.pages } : {}),
            ...(f.readError
              ? { readState: 'failed' as const, readError: f.readError }
              : f.extracted
                ? {}
                : { readState: 'none' as const }),
          }
        })
        set(pushIntoOpenGroup(...newItems))
      },

      // A pasted link is only a link until it has been read. The fetch happens
      // after the material is on screen so the author is never waiting on a
      // network round-trip before they can keep typing — the card shows the
      // reading state, and the write-up is recomposed once the text lands.
      readGroupLink: async (groupId, itemId) => {
        const item = get()
          .groups.find((g) => g.id === groupId)
          ?.items.find((it) => it.id === itemId)
        if (!item?.url || item.readState === 'reading' || item.extracted) return

        get().updateGroupItem(groupId, itemId, { readState: 'reading', readError: undefined })
        const { text, title, error } = await extractUrl(item.url)

        set((s) => ({
          groups: s.groups.map((g) => {
            if (g.id !== groupId) return g
            const items = g.items.map((it) =>
              it.id === itemId
                ? {
                    ...it,
                    ...(text
                      ? {
                          extracted: text,
                          readState: 'read' as const,
                          readError: undefined,
                          preview: firstLineOf(text),
                          // The page's own title beats the raw URL as a name.
                          title: title?.trim() ? title.trim().slice(0, 120) : it.title,
                        }
                      : { readState: 'failed' as const, readError: error }),
                  }
                : it,
            )
            // A write-up already composed without this text is now out of date.
            const outline =
              text && g.outline && !g.outline.edited
                ? asOutline(composeOutline({ items }, s.brief))
                : g.outline
            return { ...g, items, ...(outline ? { outline } : {}) }
          }),
        }))
      },

      updateGroupItem: (groupId, itemId, patch) =>
        set((s) => ({
          groups: s.groups.map((g) =>
            g.id === groupId
              ? {
                  ...g,
                  items: g.items.map((it) => (it.id === itemId ? { ...it, ...patch } : it)),
                }
              : g,
          ),
        })),

      // Emptying a group removes it outright — an empty post group is noise.
      removeGroupItem: (groupId, itemId) =>
        set((s) => {
          const groups = s.groups
            .map((g) =>
              g.id === groupId ? { ...g, items: g.items.filter((it) => it.id !== itemId) } : g,
            )
            .filter((g) => g.items.length > 0)
          return {
            groups,
            openGroupId: groups.some((g) => g.id === s.openGroupId) ? s.openGroupId : null,
          }
        }),

      // Closing a group is step one of generating: the materials are in, so a
      // basic write-up is composed for the author to correct. An outline they
      // already edited is left alone — reopening to add a file must not wipe
      // their words.
      finishGroup: () =>
        set((s) => {
          const brief = s.brief
          return {
            openGroupId: null,
            groups: s.groups.map((g) =>
              g.id === s.openGroupId && g.items.length > 0 && !g.outline?.edited
                ? { ...g, outline: asOutline(composeOutline(g, brief)) }
                : g,
            ),
          }
        }),

      updateOutline: (groupId, patch) =>
        set((s) => ({
          groups: s.groups.map((g) =>
            g.id === groupId && g.outline
              ? { ...g, outline: { ...g.outline, ...patch, edited: true } }
              : g,
          ),
        })),

      recomposeOutline: (groupId) =>
        set((s) => ({
          groups: s.groups.map((g) =>
            g.id === groupId ? { ...g, outline: asOutline(composeOutline(g, s.brief)) } : g,
          ),
        })),

      reopenGroup: (groupId) => set({ openGroupId: groupId }),

      discardGroup: (groupId) =>
        set((s) => ({
          groups: s.groups.filter((g) => g.id !== groupId),
          openGroupId: s.openGroupId === groupId ? null : s.openGroupId,
        })),

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

      generateDraft: ({ sourceMode, sourceItemIds = [], sourceLabels = [], outline }) => {
        const seed = get().genIndex
        const brief = get().brief
        const d = composeDraft({ brief, sourceMode, sourceLabels, seed, outline })
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

      regenerateDraft: ({ sourceMode, sourceLabels = [], outline }) => {
        const { draftId, genIndex, brief } = get()
        if (!draftId) return
        const d = composeDraft({ brief, sourceMode, sourceLabels, seed: genIndex, outline })
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
      version: 9,
      partialize: (s) => ({
        items: s.items,
        groups: s.groups.map(trimGroupForStorage),
        openGroupId: s.openGroupId,
        campaigns: s.campaigns,
        genIndex: s.genIndex,
        brief: s.brief,
        customSources: s.customSources,
        hiddenSourceIds: s.hiddenSourceIds,
      }),
      // Schema changed (images, headlines, approval, briefs, settings, drafts) —
      // reset older stores to the fresh seed rather than backfilling fields.
      // Schema changed — reset seeded content, but keep the user's source edits.
      migrate: (persisted) => {
        const prev = persisted as
          | { customSources?: MonitoredSource[]; hiddenSourceIds?: string[] }
          | undefined
        return {
          items: SEED_ITEMS,
          groups: [],
          openGroupId: null,
          campaigns: SEED_CAMPAIGNS,
          genIndex: 0,
          brief: DEFAULT_BRIEF,
          customSources: prev?.customSources ?? [],
          hiddenSourceIds: prev?.hiddenSourceIds ?? [],
        }
      },
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
