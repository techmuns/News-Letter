import { useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { PageHeader } from '../components/PageHeader'
import { Card } from '../components/Card'
import { Button } from '../components/Button'
import { MicroLabel } from '../components/MicroLabel'
import { LinkedInPost } from '../components/preview/LinkedInPost'
import { EmailPreview } from '../components/preview/EmailPreview'
import { IconSparkle, IconLinkedIn, IconEmail, IconCheck } from '../components/icons'
import {
  api,
  getAppSecret,
  setAppSecret,
  type GeneratedContent,
  type HealthFlags,
} from '../lib/api'
import { buildEmailHtml } from '../lib/emailTemplate'
import { renderBrandedCard } from '../lib/brandedImage'
import { type LinkedInContent, type EmailContent } from '../types'
import { cn } from '../lib/cn'

const TONES = [
  'Sharp & insightful',
  'Contrarian',
  'Data-led & neutral',
  'Punchy & bold',
  'Warm & conversational',
]

/* --- small building blocks ---------------------------------------------- */

function Label({ children }: { children: React.ReactNode }) {
  return <MicroLabel className="mb-1.5 block text-text-muted">{children}</MicroLabel>
}

const inputCls =
  'w-full rounded-lg border border-border bg-[rgba(255,255,255,0.02)] px-3 py-2 text-[14px] text-text ' +
  'placeholder:text-text-dim focus:outline-none focus-violet transition-colors'

function StatusRow({ ok, label, hint }: { ok: boolean; label: string; hint?: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className={cn('h-2 w-2 shrink-0 rounded-full', ok ? 'bg-[#54d98c]' : 'bg-text-dim')} />
      <span className="text-[13px] text-text-2">{label}</span>
      {!ok && hint && <span className="text-[11px] text-text-dim">· {hint}</span>}
    </div>
  )
}

function Note({ kind, children }: { kind: 'ok' | 'err'; children: React.ReactNode }) {
  return (
    <p
      className={cn(
        'mt-2 rounded-lg px-3 py-2 text-[12.5px] leading-relaxed',
        kind === 'ok'
          ? 'bg-[rgba(84,217,140,0.08)] text-[#8ce3ad] ring-1 ring-[rgba(84,217,140,0.2)]'
          : 'bg-[rgba(248,113,113,0.08)] text-[#f7a3a3] ring-1 ring-[rgba(248,113,113,0.2)]',
      )}
    >
      {children}
    </p>
  )
}

/* --- helpers ------------------------------------------------------------- */

function normalizeTags(tags: string[]): string[] {
  return tags
    .filter(Boolean)
    .map((t) => '#' + String(t).replace(/^#+/, '').trim())
    .filter((t) => t.length > 1)
}

function toIsoUtc(local: string): string | undefined {
  if (!local) return undefined
  const d = new Date(local)
  return isNaN(d.getTime()) ? undefined : d.toISOString()
}

/* --- the space ----------------------------------------------------------- */

export function StudioSpace() {
  // inputs — sourceText may be prefilled when arriving from the Daily Pulse tab
  const location = useLocation()
  const [sourceText, setSourceText] = useState<string>(() => {
    const s = (location.state as { prefillSource?: string } | null)?.prefillSource
    return typeof s === 'string' ? s : ''
  })
  const [snippet, setSnippet] = useState('')
  const [tone, setTone] = useState(TONES[0])
  const [imageUrl, setImageUrl] = useState('')

  // generation
  const [draft, setDraft] = useState<GeneratedContent | null>(null)
  const [generating, setGenerating] = useState(false)
  const [genError, setGenError] = useState('')
  /** auto-rendered branded card (headline baked in) — the default post image */
  const [card, setCard] = useState<{ dataUrl: string; blob: Blob } | null>(null)

  // publish / send
  const [scheduleLocal, setScheduleLocal] = useState('')
  const [publishing, setPublishing] = useState(false)
  const [publishNote, setPublishNote] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const [recipientsText, setRecipientsText] = useState('')
  const [sending, setSending] = useState(false)
  const [sendNote, setSendNote] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const [copied, setCopied] = useState(false)

  // connection status
  const [health, setHealth] = useState<HealthFlags | null>(null)
  const [healthError, setHealthError] = useState('')
  const [secretInput, setSecretInput] = useState(getAppSecret())

  useEffect(() => {
    api
      .health()
      .then(setHealth)
      .catch((e: Error) => setHealthError(e.message))
  }, [])

  // Re-render the branded post image whenever the headline/topic changes.
  useEffect(() => {
    if (!draft) {
      setCard(null)
      return
    }
    let cancelled = false
    renderBrandedCard({ headline: draft.linkedin.headline, topic: draft.topic })
      .then((c) => {
        if (!cancelled) setCard(c)
      })
      .catch(() => {
        if (!cancelled) setCard(null)
      })
    return () => {
      cancelled = true
    }
  }, [draft?.linkedin.headline, draft?.topic]) // eslint-disable-line react-hooks/exhaustive-deps

  const fullLinkedInText = useMemo(() => {
    if (!draft) return ''
    const tags = normalizeTags(draft.linkedin.hashtags)
    return [draft.linkedin.body.trim(), tags.join(' ')].filter(Boolean).join('\n\n')
  }, [draft])

  const effectiveImage = imageUrl.trim() || card?.dataUrl

  const liPreview: LinkedInContent | null = draft && {
    authorName: 'Munshot',
    authorHandle: 'Munshot Intelligence · Market data',
    authorAvatar: 'M',
    headline: draft.linkedin.headline,
    body: fullLinkedInText,
    reactions: 0,
    comments: 0,
    reposts: 0,
  }

  const emailPreview: EmailContent | null = draft && {
    subject: draft.email.subject,
    from: 'Munshot Intelligence',
    preheader: draft.email.preheader,
    idea: draft.email.idea,
    story: draft.email.story,
    takeaway: draft.email.takeaway,
    ctaLabel: draft.email.ctaLabel,
  }

  /* patch nested draft fields immutably */
  function patchLinkedIn(p: Partial<GeneratedContent['linkedin']>) {
    setDraft((d) => (d ? { ...d, linkedin: { ...d.linkedin, ...p } } : d))
  }
  function patchEmail(p: Partial<GeneratedContent['email']>) {
    setDraft((d) => (d ? { ...d, email: { ...d.email, ...p } } : d))
  }

  async function handleGenerate() {
    if (!sourceText.trim() || generating) return
    setGenerating(true)
    setGenError('')
    setPublishNote(null)
    setSendNote(null)
    try {
      const { content } = await api.generate({
        sourceText,
        dashboardSnippet: snippet || undefined,
        tone,
      })
      setDraft(content)
    } catch (e) {
      setGenError((e as Error).message)
    } finally {
      setGenerating(false)
    }
  }

  async function handlePublish() {
    if (!draft || publishing) return
    setPublishing(true)
    setPublishNote(null)
    try {
      // A pasted URL wins; otherwise host the branded card (needs the KV STORE
      // binding). No host available → publish text-only.
      let finalImageUrl = imageUrl.trim() || undefined
      let imageNote = ''
      if (!finalImageUrl && card) {
        if (health?.images) {
          try {
            finalImageUrl = (await api.uploadImage(card.blob)).url
          } catch (e) {
            imageNote = ` (image not hosted: ${(e as Error).message})`
          }
        } else {
          imageNote = ' (text-only — add the KV STORE binding to auto-attach the branded image)'
        }
      }
      const r = await api.publishLinkedIn({
        text: fullLinkedInText,
        imageUrl: finalImageUrl,
        scheduledAt: toIsoUtc(scheduleLocal),
      })
      setPublishNote({
        kind: 'ok',
        text:
          (r.scheduled
            ? `Scheduled on the Munshot LinkedIn page via Buffer${r.dueAt ? ` for ${new Date(r.dueAt).toLocaleString()}` : ''}.`
            : 'Sent to Buffer — it will publish to the Munshot LinkedIn page at the next queue slot.') +
          imageNote,
      })
    } catch (e) {
      setPublishNote({ kind: 'err', text: (e as Error).message })
    } finally {
      setPublishing(false)
    }
  }

  async function handleSend() {
    if (!draft || sending) return
    setSending(true)
    setSendNote(null)
    try {
      const html = buildEmailHtml(draft.email)
      const recipients = recipientsText
        .split(/[\n,;]+/)
        .map((s) => s.trim())
        .filter(Boolean)
      const r = await api.sendEmail({
        subject: draft.email.subject,
        html,
        recipients: recipients.length ? recipients : undefined,
      })
      setSendNote({ kind: 'ok', text: `Sent to ${r.sent} recipient(s) via ${r.provider}.` })
    } catch (e) {
      setSendNote({ kind: 'err', text: (e as Error).message })
    } finally {
      setSending(false)
    }
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(fullLinkedInText)
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch {
      /* ignore */
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="S2 · Studio — live"
        title="Turn a standout finance post into a Munshot post + email"
        subtitle="Paste the post you want to riff on and a dashboard data point. The engine writes a short, branded LinkedIn post and a matching newsletter — then publishes to your LinkedIn page (via Buffer) and emails your list."
      />

      {/* connection status */}
      <Card solid className="mb-6 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <MicroLabel tone="violet">Connections</MicroLabel>
          {health && (
            <span className="micro text-text-dim">
              AI via {health.aiProvider} · {health.model} · email via {health.emailProvider}
            </span>
          )}
        </div>
        {healthError ? (
          <Note kind="err">
            Backend not reachable yet. Deploy to Cloudflare or run it locally with the API attached
            — see <code>SETUP.md</code>. You can still draft copy once it's wired.
          </Note>
        ) : (
          <div className="mt-3 flex flex-wrap gap-x-8 gap-y-2">
            <StatusRow ok={!!health?.ai} label="AI generation" hint="add BEDROCK_API_KEY" />
            <StatusRow
              ok={!!health?.linkedin}
              label="LinkedIn (Buffer)"
              hint="add Buffer token + channel id"
            />
            <StatusRow ok={!!health?.email} label="Email" hint="add provider key + sender" />
          </div>
        )}

        {health?.authRequired && (
          <div className="mt-4 flex flex-wrap items-end gap-2 border-t border-border pt-3">
            <div className="min-w-[220px] flex-1">
              <Label>App secret (required)</Label>
              <input
                className={inputCls}
                type="password"
                placeholder="paste the APP_SECRET you set"
                value={secretInput}
                onChange={(e) => setSecretInput(e.target.value)}
              />
            </div>
            <Button variant="ghost" size="sm" onClick={() => setAppSecret(secretInput.trim())}>
              Save secret
            </Button>
          </div>
        )}
      </Card>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
        {/* ---- left: source + generate ---- */}
        <div className="space-y-4">
          <Card className="p-5">
            <MicroLabel tone="violet">Source</MicroLabel>
            <div className="mt-3 space-y-4">
              <div>
                <Label>Standout finance post / notes to riff on</Label>
                <textarea
                  className={cn(inputCls, 'min-h-[130px] resize-y leading-relaxed')}
                  placeholder="Paste the top influencer post (or your own notes) here…"
                  value={sourceText}
                  onChange={(e) => setSourceText(e.target.value)}
                />
              </div>
              <div>
                <Label>Munshot dashboard data point (optional — gets featured)</Label>
                <textarea
                  className={cn(inputCls, 'min-h-[70px] resize-y leading-relaxed')}
                  placeholder="e.g. Our Sector Flows dashboard shows energy net inflows hit a 14-month high this week."
                  value={snippet}
                  onChange={(e) => setSnippet(e.target.value)}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label>Tone</Label>
                  <select
                    className={cn(inputCls, 'appearance-none')}
                    value={tone}
                    onChange={(e) => setTone(e.target.value)}
                  >
                    {TONES.map((t) => (
                      <option key={t} value={t} className="bg-surface-solid">
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label>Custom image URL (optional)</Label>
                  <input
                    className={inputCls}
                    placeholder="blank = auto-branded image"
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                  />
                </div>
              </div>
              <p className="text-[11.5px] leading-relaxed text-text-dim">
                Every post gets an auto-generated <strong>branded image</strong> (hosted for you when
                you publish). Leave the field blank to use it, or paste a public image URL to override.
                {!!health && !health.images && ' Auto-image hosting needs the KV STORE binding — see SETUP.md.'}
              </p>

              <Button
                variant="primary"
                onClick={handleGenerate}
                disabled={generating || !sourceText.trim() || (!!health && !health.ai)}
                className="w-full"
              >
                <IconSparkle size={16} />
                {generating ? 'Generating…' : draft ? 'Regenerate' : 'Generate with AI'}
              </Button>
              {genError && <Note kind="err">{genError}</Note>}
              {!!health && !health.ai && (
                <p className="text-[11.5px] text-text-dim">
                  Add <code>BEDROCK_API_KEY</code> to enable generation (SETUP.md).
                </p>
              )}
            </div>
          </Card>
        </div>

        {/* ---- right: previews + publish ---- */}
        <div className="space-y-6">
          {!draft && (
            <Card className="grid min-h-[260px] place-items-center p-8 text-center">
              <div>
                <IconSparkle size={26} className="mx-auto text-text-dim" />
                <p className="mt-3 text-[14px] text-text-muted">
                  Your LinkedIn post and newsletter preview will appear here.
                </p>
                <p className="mt-1 text-[12.5px] text-text-dim">
                  Paste a source on the left and hit Generate.
                </p>
              </div>
            </Card>
          )}

          {draft && liPreview && (
            <Card className="p-5">
              <div className="mb-3 flex items-center gap-2">
                <IconLinkedIn size={15} className="text-[#0a66c2]" />
                <MicroLabel tone="violet">LinkedIn post</MicroLabel>
              </div>

              <LinkedInPost content={liPreview} image={effectiveImage} topic={draft.topic} plainImage />

              {/* editable fields */}
              <div className="mt-4 space-y-3">
                <div>
                  <Label>Graphic headline</Label>
                  <input
                    className={inputCls}
                    value={draft.linkedin.headline}
                    onChange={(e) => patchLinkedIn({ headline: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Post text</Label>
                  <textarea
                    className={cn(inputCls, 'min-h-[150px] resize-y leading-relaxed')}
                    value={draft.linkedin.body}
                    onChange={(e) => patchLinkedIn({ body: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Hashtags (space-separated)</Label>
                  <input
                    className={inputCls}
                    value={draft.linkedin.hashtags.join(' ')}
                    onChange={(e) =>
                      patchLinkedIn({ hashtags: e.target.value.split(/\s+/).filter(Boolean) })
                    }
                  />
                </div>
                <div className="flex flex-wrap items-end gap-2">
                  <div className="min-w-[190px] flex-1">
                    <Label>Schedule (optional — else next queue slot)</Label>
                    <input
                      type="datetime-local"
                      className={inputCls}
                      value={scheduleLocal}
                      onChange={(e) => setScheduleLocal(e.target.value)}
                    />
                  </div>
                  <Button variant="ghost" size="sm" onClick={handleCopy}>
                    {copied ? <IconCheck size={15} /> : null}
                    {copied ? 'Copied' : 'Copy text'}
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handlePublish}
                    disabled={publishing || (!!health && !health.linkedin)}
                  >
                    <IconLinkedIn size={15} />
                    {publishing ? 'Publishing…' : scheduleLocal ? 'Schedule' : 'Publish'}
                  </Button>
                </div>
                {!!health && !health.linkedin && (
                  <p className="text-[11.5px] text-text-dim">
                    Connect Buffer to publish — add <code>BUFFER_ACCESS_TOKEN</code> and{' '}
                    <code>BUFFER_LINKEDIN_CHANNEL_ID</code> (SETUP.md). Meanwhile, use “Copy text”.
                  </p>
                )}
                {publishNote && <Note kind={publishNote.kind}>{publishNote.text}</Note>}
              </div>
            </Card>
          )}

          {draft && emailPreview && (
            <Card className="p-5">
              <div className="mb-3 flex items-center gap-2">
                <IconEmail size={15} className="text-violet" />
                <MicroLabel tone="violet">Email newsletter</MicroLabel>
              </div>

              <EmailPreview content={emailPreview} />

              <div className="mt-4 space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <Label>Subject</Label>
                    <input
                      className={inputCls}
                      value={draft.email.subject}
                      onChange={(e) => patchEmail({ subject: e.target.value })}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <Label>Preheader</Label>
                    <input
                      className={inputCls}
                      value={draft.email.preheader}
                      onChange={(e) => patchEmail({ preheader: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>The idea</Label>
                    <textarea
                      className={cn(inputCls, 'min-h-[70px] resize-y')}
                      value={draft.email.idea}
                      onChange={(e) => patchEmail({ idea: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>The story</Label>
                    <textarea
                      className={cn(inputCls, 'min-h-[70px] resize-y')}
                      value={draft.email.story}
                      onChange={(e) => patchEmail({ story: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>The takeaway</Label>
                    <textarea
                      className={cn(inputCls, 'min-h-[70px] resize-y')}
                      value={draft.email.takeaway}
                      onChange={(e) => patchEmail({ takeaway: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>CTA label</Label>
                    <input
                      className={inputCls}
                      value={draft.email.ctaLabel}
                      onChange={(e) => patchEmail({ ctaLabel: e.target.value })}
                    />
                  </div>
                </div>
                <div>
                  <Label>Recipients (comma / newline separated — blank uses your saved list)</Label>
                  <textarea
                    className={cn(inputCls, 'min-h-[60px] resize-y')}
                    placeholder={
                      health?.hasDefaultRecipients
                        ? 'Leave blank to use your EMAIL_RECIPIENTS list…'
                        : 'jane@fund.com, ravi@capital.com'
                    }
                    value={recipientsText}
                    onChange={(e) => setRecipientsText(e.target.value)}
                  />
                </div>
                <div className="flex justify-end">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleSend}
                    disabled={sending || (!!health && !health.email)}
                  >
                    <IconEmail size={15} />
                    {sending ? 'Sending…' : 'Send to list'}
                  </Button>
                </div>
                {!!health && !health.email && (
                  <p className="text-[11.5px] text-text-dim">
                    Connect an email provider to send — add the provider key and{' '}
                    <code>EMAIL_FROM</code> (SETUP.md).
                  </p>
                )}
                {sendNote && <Note kind={sendNote.kind}>{sendNote.text}</Note>}
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
