/* The Studio "pile" — a persistent, growing collection of raw material
   (notes, pasted posts, extracted PDF text, screenshots) that you select from
   and generate content out of. Persisted to localStorage so it survives
   reloads; image writes are size-guarded so a full quota never crashes the UI. */
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

export type StudioItemKind = 'note' | 'post' | 'pdf' | 'image'

export interface StudioItem {
  id: string
  kind: StudioItemKind
  title: string
  /** text for note | post | pdf */
  text?: string
  /** base64 (no `data:` prefix) for image items — used for preview + vision */
  imageData?: string
  mediaType?: string
  createdAt: number
}

function rid(): string {
  return 'itm_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)
}

interface StudioState {
  items: StudioItem[]
  add: (item: Omit<StudioItem, 'id' | 'createdAt'>) => string
  remove: (id: string) => void
  clear: () => void
}

/** localStorage that never throws on a full quota (large screenshots) — a
    failed write just means that item won't survive a reload, not a crash. */
const safeStorage = {
  getItem: (name: string) => {
    try {
      return localStorage.getItem(name)
    } catch {
      return null
    }
  },
  setItem: (name: string, value: string) => {
    try {
      localStorage.setItem(name, value)
    } catch {
      /* quota exceeded — keep the in-memory pile, skip persistence */
    }
  },
  removeItem: (name: string) => {
    try {
      localStorage.removeItem(name)
    } catch {
      /* ignore */
    }
  },
}

export const useStudioStore = create<StudioState>()(
  persist(
    (set) => ({
      items: [],
      add: (item) => {
        const id = rid()
        set((s) => ({ items: [{ ...item, id, createdAt: Date.now() }, ...s.items] }))
        return id
      },
      remove: (id) => set((s) => ({ items: s.items.filter((i) => i.id !== id) })),
      clear: () => set({ items: [] }),
    }),
    { name: 'munshot-studio-pile', storage: createJSONStorage(() => safeStorage) },
  ),
)
