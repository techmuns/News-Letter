/* Bridges the drafts list and the Buffer compose box: clicking "Use this
   draft" on a preview drops its text into the LinkedIn compose box on the
   same page, instead of leaving you to copy-paste between two disconnected
   panels. Deliberately not persisted — it's a within-session handoff. */
import { create } from 'zustand'

interface ComposeTargetState {
  /** Text staged for the Buffer compose box, plus a nonce so re-sending the
      same draft still registers as a fresh handoff. */
  pending: { text: string; nonce: number } | null
  sendToCompose: (text: string) => void
  clear: () => void
}

export const useComposeTarget = create<ComposeTargetState>((set) => ({
  pending: null,
  sendToCompose: (text) => set({ pending: { text, nonce: Date.now() } }),
  clear: () => set({ pending: null }),
}))
