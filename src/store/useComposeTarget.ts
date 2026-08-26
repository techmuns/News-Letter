/* Bridges the drafts list and the Buffer compose box: clicking "Use this
   draft" on a preview drops its text into the LinkedIn compose box on the
   same page, instead of leaving you to copy-paste between two disconnected
   panels. Deliberately not persisted — it's a within-session handoff. */
import { create } from 'zustand'

export interface ComposeHandoff {
  text: string
  /** Headline + topic are carried alongside the text so the compose box can
      re-render the same branded graphic the preview showed. */
  headline?: string
  topic?: string
  /** A nonce so re-sending the same draft still registers as a fresh handoff. */
  nonce: number
}

interface ComposeTargetState {
  pending: ComposeHandoff | null
  sendToCompose: (input: { text: string; headline?: string; topic?: string }) => void
  clear: () => void
}

export const useComposeTarget = create<ComposeTargetState>((set) => ({
  pending: null,
  sendToCompose: (input) => set({ pending: { ...input, nonce: Date.now() } }),
  clear: () => set({ pending: null }),
}))
