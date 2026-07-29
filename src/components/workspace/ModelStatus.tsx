import { useEffect, useState } from 'react'
import { type AiConfig, aiConfig, forgetAiConfig } from '../../lib/ai'
import { IconAlert, IconRefresh } from '../icons'

/**
 * Says, in the Workspace, whether uploads are actually being read.
 *
 * This exists because the failure is invisible without it. With no model
 * reachable the app still produces a post — composed from the write-up, with
 * the playbook's bracketed gaps where figures belong — and that draft looks
 * like a working feature that wrote something bland. The only way to tell it
 * apart from a real generation is to know the model was never called, so the
 * app says so rather than leaving it to be inferred from the copy.
 *
 * Silent when everything is wired up: a banner confirming that things work is
 * noise on every visit.
 */
export function ModelStatus() {
  const [config, setConfig] = useState<AiConfig | null>(null)

  useEffect(() => {
    let live = true
    aiConfig().then((c) => live && setConfig(c))
    return () => {
      live = false
    }
  }, [])

  function recheck() {
    setConfig(null)
    forgetAiConfig()
    aiConfig().then(setConfig)
  }

  if (!config || config.configured) return null

  return (
    <div className="mt-4 flex items-start gap-3 rounded-xl border border-[color:var(--amber)]/30 bg-amber-soft px-4 py-3">
      <IconAlert size={15} className="mt-px shrink-0 text-amber" />
      <div className="min-w-0">
        <p className="text-[12.5px] font-medium text-amber">
          Uploads are not being read — no model is reachable.
        </p>
        <p className="mt-1 text-[11.5px] leading-relaxed text-text-2">
          {config.reason} Posts will still be composed from your own write-up, but nothing in
          your files or screenshots is being looked at.
        </p>
      </div>
      <button
        type="button"
        onClick={recheck}
        className="ml-auto flex shrink-0 items-center gap-1.5 text-[11.5px] text-amber transition-colors hover:text-text focus-violet"
      >
        <IconRefresh size={12} /> Re-check
      </button>
    </div>
  )
}
