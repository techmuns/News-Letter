/* Remembers the last Daily Pulse generation (text only) so the preview survives
   a page refresh — it reappears on the Pulse page instead of vanishing. Images
   are NOT stored here; they re-render on the client from the restored post +
   the live feed. Guarded storage so a full quota can never crash the app. */
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import type { PulsePost, NewsItem } from '../lib/api'

export interface PulseDraft {
  post: PulsePost
  sources: NewsItem[]
  resultKind: 'market' | 'topic'
  historyId: string | null
}

interface PulseDraftState {
  draft: PulseDraft | null
  setDraft: (d: PulseDraft) => void
  clear: () => void
}

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
      /* quota/unavailable — skip persistence, never crash */
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

export const usePulseDraft = create<PulseDraftState>()(
  persist(
    (set) => ({
      draft: null,
      setDraft: (draft) => set({ draft }),
      clear: () => set({ draft: null }),
    }),
    { name: 'munshot-pulse-draft', storage: createJSONStorage(() => safeStorage) },
  ),
)
