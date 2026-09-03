import { useEffect, useState } from 'react'
import { type Campaign } from '../../types'
import { useStore } from '../../store/useStore'
import { Button } from '../Button'
import { MicroLabel } from '../MicroLabel'
import { LinkedInPost } from '../preview/LinkedInPost'
import { cn } from '../../lib/cn'

/** LinkedIn rejects posts past this length, so warn before Buffer does. */
const LINKEDIN_LIMIT = 3000

const fieldCls =
  'w-full rounded-lg border border-border bg-[rgba(255,255,255,0.02)] px-3 py-2 text-[14px] text-text ' +
  'placeholder:text-text-dim focus:outline-none focus-violet transition-colors'

/**
 * The LinkedIn draft, either previewed as it will appear in-feed or opened for
 * hand-editing. Generated copy is a starting point — this is where a line gets
 * cut or a sentence added before it goes to the compose box.
 */
export function LinkedInDraftEditor({ campaign }: { campaign: Campaign }) {
  const setLinkedInText = useStore((s) => s.setLinkedInText)
  const { headline, body } = campaign.linkedin.content

  const [editing, setEditing] = useState(false)
  const [draftHeadline, setDraftHeadline] = useState(headline)
  const [draftBody, setDraftBody] = useState(body)

  // Selecting a different draft (or regenerating this one) must not leave the
  // previous post's text sitting in the editor.
  useEffect(() => {
    setEditing(false)
    setDraftHeadline(headline)
    setDraftBody(body)
  }, [campaign.id, headline, body])

  const total = draftHeadline.trim().length + draftBody.trim().length + 2
  const overLimit = total > LINKEDIN_LIMIT
  const dirty = draftHeadline !== headline || draftBody !== body

  function save() {
    setLinkedInText(campaign.id, { headline: draftHeadline, body: draftBody })
    setEditing(false)
  }

  function cancel() {
    setDraftHeadline(headline)
    setDraftBody(body)
    setEditing(false)
  }

  if (!editing) {
    return (
      <div>
        <div className="mb-3 flex items-center justify-end">
          <Button variant="subtle" size="sm" onClick={() => setEditing(true)}>
            ✎ Edit text
          </Button>
        </div>
        <LinkedInPost
          content={campaign.linkedin.content}
          image={campaign.heroImage}
          topic={campaign.topic}
          // heroImage is already a fully rendered branded card (Studio and
          // Daily Pulse both produce one). Without this the preview draws the
          // branding template over it a second time — two brand marks and a
          // ghosted duplicate headline.
          plainImage
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <MicroLabel tone="violet">Editing draft</MicroLabel>
        <span
          className={cn(
            'micro',
            overLimit
              ? 'text-[#f7a3a3]'
              : total > LINKEDIN_LIMIT * 0.9
                ? 'text-[#f2c566]'
                : 'text-text-dim',
          )}
        >
          {total} / {LINKEDIN_LIMIT}
        </span>
      </div>

      <label className="flex flex-col gap-1.5">
        <MicroLabel className="text-text-dim">Hook (first line)</MicroLabel>
        <input
          className={fieldCls}
          value={draftHeadline}
          onChange={(e) => setDraftHeadline(e.target.value)}
          placeholder="The opening line that stops the scroll…"
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <MicroLabel className="text-text-dim">Post body</MicroLabel>
        <textarea
          className={cn(fieldCls, 'min-h-[320px] resize-y whitespace-pre-wrap leading-relaxed')}
          value={draftBody}
          onChange={(e) => setDraftBody(e.target.value)}
          placeholder="Bullets, closing line, hashtags…"
        />
      </label>

      <p className="text-[12.5px] leading-relaxed text-text-dim">
        Delete a bullet by deleting its line. Blank lines are kept exactly as you type them, so the
        spacing here is the spacing LinkedIn shows.
      </p>

      {overLimit && (
        <p className="text-[12.5px] leading-relaxed text-[#f7a3a3]">
          This is {total - LINKEDIN_LIMIT} characters over LinkedIn's {LINKEDIN_LIMIT}-character
          limit — trim it or the publish will be rejected.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="primary" size="sm" onClick={save} disabled={!dirty}>
          Save changes
        </Button>
        <Button variant="ghost" size="sm" onClick={cancel}>
          {dirty ? 'Discard changes' : 'Done'}
        </Button>
      </div>
    </div>
  )
}
