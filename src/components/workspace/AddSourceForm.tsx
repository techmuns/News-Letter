import { useState } from 'react'
import { type SourceKind } from '../../data/sources'
import { cn } from '../../lib/cn'
import { Segmented } from '../Segmented'
import { IconPlus, IconClose } from '../icons'

interface AddSourceFormProps {
  /** returns the new id, or null when the name was empty */
  onAdd: (input: { name: string; handle: string; kind: SourceKind }) => string | null
}

const inputCls =
  'w-full rounded-lg border border-border bg-bg px-3 py-2 text-[13px] text-text placeholder:text-text-dim transition-colors focus:border-[color:var(--sky-border)] focus-violet'

/**
 * Adds a LinkedIn profile or company page to the monitored catalog.
 * Collapsed to a single quiet button until opened, so it never competes
 * with the source list itself.
 */
export function AddSourceForm({ onAdd }: AddSourceFormProps) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [handle, setHandle] = useState('')
  const [kind, setKind] = useState<SourceKind>('creator')
  const [error, setError] = useState<string | null>(null)

  function reset() {
    setName('')
    setHandle('')
    setKind('creator')
    setError(null)
  }

  function submit() {
    if (!name.trim()) {
      setError('Give the profile a name.')
      return
    }
    onAdd({ name, handle, kind })
    reset()
    setOpen(false)
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border-strong bg-surface-soft py-2.5 text-[12.5px] font-medium text-sky transition-colors hover:border-[color:var(--sky-border)] hover:bg-sky-soft focus-violet"
      >
        <IconPlus size={14} />
        Add a LinkedIn profile or page
      </button>
    )
  }

  return (
    <div className="rounded-xl border border-[color:var(--sky-border)] bg-surface-soft p-3.5 animate-fade-up">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-[12.5px] font-medium text-text">Add a source</span>
        <button
          type="button"
          onClick={() => {
            reset()
            setOpen(false)
          }}
          aria-label="Cancel"
          className="grid h-6 w-6 place-items-center rounded-md text-text-muted transition-colors hover:bg-surface-hover hover:text-text focus-violet"
        >
          <IconClose size={14} />
        </button>
      </div>

      <div className="flex flex-col gap-2.5">
        <Segmented
          value={kind}
          onChange={(k) => setKind(k)}
          options={[
            { value: 'creator' as SourceKind, label: 'Person' },
            { value: 'page' as SourceKind, label: 'Company page' },
          ]}
          dense
        />
        <input
          autoFocus
          value={name}
          onChange={(e) => {
            setName(e.target.value)
            setError(null)
          }}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          placeholder={kind === 'creator' ? 'Name — e.g. Aarti Menon' : 'Company — e.g. Meridian Capital'}
          className={cn(inputCls, error && 'border-red')}
        />
        <input
          value={handle}
          onChange={(e) => setHandle(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          placeholder="Profile URL or @handle (optional)"
          className={inputCls}
        />
        {error && <p className="text-[11.5px] text-red">{error}</p>}
        <button
          type="button"
          onClick={submit}
          className="mt-0.5 rounded-lg bg-violet px-3 py-2 text-[12.5px] font-semibold text-on-accent transition-all hover:brightness-110 focus-violet"
        >
          Add to monitored sources
        </button>
      </div>
    </div>
  )
}
