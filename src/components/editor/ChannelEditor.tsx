import { useStore } from '../../store/useStore'
import {
  type Campaign,
  type ChannelKind,
  type ArticleContent,
  type ArticleSection,
  type EmailContent,
  type LinkedInContent,
} from '../../types'
import { Button } from '../Button'
import { MicroLabel } from '../MicroLabel'
import { IconPlus, IconClose } from '../icons'
import { Field, NumberField } from './Field'

/**
 * Edits one channel version of a campaign in place. Every keystroke writes
 * through to the store and marks the version `edited`, which is what protects
 * it from being silently clobbered by a re-draft.
 */
export function ChannelEditor({ campaign, kind }: { campaign: Campaign; kind: ChannelKind }) {
  const update = useStore((s) => s.updateChannelContent)

  if (kind === 'linkedin') {
    const c = campaign.linkedin.content
    const set = (patch: Partial<LinkedInContent>) => update(campaign.id, 'linkedin', patch)
    return (
      <div className="flex flex-col gap-4">
        <Field
          label="Headline"
          hint="shown on the graphic"
          value={c.headline}
          onChange={(headline) => set({ headline })}
          placeholder="The claim, in under 60 characters"
        />
        <Field
          label="Post body"
          multiline
          minRows={10}
          value={c.body}
          onChange={(body) => set({ body })}
          placeholder="Open with the claim. Blank line between paragraphs."
        />
      </div>
    )
  }

  if (kind === 'email') {
    const c = campaign.email.content
    const set = (patch: Partial<EmailContent>) => update(campaign.id, 'email', patch)
    return (
      <div className="flex flex-col gap-4">
        <Field label="Subject" value={c.subject} onChange={(subject) => set({ subject })} />
        <Field
          label="Preheader"
          hint="inbox preview line"
          value={c.preheader}
          onChange={(preheader) => set({ preheader })}
        />
        <Field
          label="The idea"
          multiline
          value={c.idea}
          onChange={(idea) => set({ idea })}
        />
        <Field
          label="The story"
          multiline
          minRows={5}
          value={c.story}
          onChange={(story) => set({ story })}
        />
        <Field
          label="The takeaway"
          multiline
          value={c.takeaway}
          onChange={(takeaway) => set({ takeaway })}
        />
        <Field label="CTA label" value={c.ctaLabel} onChange={(ctaLabel) => set({ ctaLabel })} />
      </div>
    )
  }

  const c = campaign.article.content
  const set = (patch: Partial<ArticleContent>) => update(campaign.id, 'article', patch)

  const setSection = (index: number, patch: Partial<ArticleSection>) => {
    const sections = c.sections.map((s, i) => (i === index ? { ...s, ...patch } : s))
    set({ sections })
  }

  const addSection = () => set({ sections: [...c.sections, { heading: '', body: '' }] })

  const removeSection = (index: number) =>
    set({ sections: c.sections.filter((_, i) => i !== index) })

  return (
    <div className="flex flex-col gap-4">
      <Field label="Title" value={c.title} onChange={(title) => set({ title })} />
      <Field label="Standfirst" multiline value={c.deck} onChange={(deck) => set({ deck })} />
      <div className="flex flex-wrap items-end gap-4">
        <div className="min-w-[200px] flex-1">
          <Field
            label="Kicker"
            hint="uppercase"
            value={c.hero}
            onChange={(hero) => set({ hero })}
            placeholder="IPO · PRIMARY MARKETS"
          />
        </div>
        <NumberField
          label="Read minutes"
          value={c.readMinutes}
          onChange={(readMinutes) => set({ readMinutes })}
        />
      </div>

      <div className="border-t border-[rgba(255,255,255,0.07)] pt-4">
        <div className="flex items-center justify-between gap-3">
          <MicroLabel>Sections</MicroLabel>
          <Button variant="ghost" size="sm" onClick={addSection}>
            <IconPlus size={14} /> Add section
          </Button>
        </div>

        <div className="mt-3 flex flex-col gap-4">
          {c.sections.length === 0 && (
            <p className="text-[13px] text-text-muted">
              No sections yet. Add one to start the piece.
            </p>
          )}
          {c.sections.map((section, i) => (
            <div key={i} className="rounded-xl border border-border p-3">
              <div className="mb-3 flex items-center justify-between gap-3">
                <MicroLabel className="text-text-dim">
                  {String(i + 1).padStart(2, '0')}
                </MicroLabel>
                <button
                  type="button"
                  onClick={() => removeSection(i)}
                  aria-label={`Remove section ${i + 1}`}
                  className="text-text-dim transition-colors hover:text-text-2"
                >
                  <IconClose size={14} />
                </button>
              </div>
              <div className="flex flex-col gap-3">
                <Field
                  label="Heading"
                  hint="optional"
                  value={section.heading ?? ''}
                  onChange={(heading) => setSection(i, { heading: heading || undefined })}
                />
                <Field
                  label="Body"
                  multiline
                  minRows={5}
                  value={section.body}
                  onChange={(body) => setSection(i, { body })}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-4 border-t border-[rgba(255,255,255,0.07)] pt-4">
        <Field label="CTA title" value={c.ctaTitle} onChange={(ctaTitle) => set({ ctaTitle })} />
        <Field
          label="CTA body"
          multiline
          value={c.ctaBody}
          onChange={(ctaBody) => set({ ctaBody })}
        />
        <Field label="CTA label" value={c.ctaLabel} onChange={(ctaLabel) => set({ ctaLabel })} />
      </div>
    </div>
  )
}
