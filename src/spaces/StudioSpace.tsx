import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { PageHeader } from '../components/PageHeader'
import { Card } from '../components/Card'
import { Button } from '../components/Button'
import { MicroLabel } from '../components/MicroLabel'
import { LinkedInPost } from '../components/preview/LinkedInPost'
import { EmailPreview } from '../components/preview/EmailPreview'
import { IconSparkle, IconLinkedIn, IconEmail, IconCheck, IconClose } from '../components/icons'
import { api, type GeneratedContent, type HealthFlags } from '../lib/api'
import { buildEmailHtml } from '../lib/emailTemplate'
import { renderBrandedCard } from '../lib/brandedImage'
import { fileToDownscaledImage } from '../lib/ingest'
import { useStudioStore, type StudioItem } from '../store/useStudioStore'
import { useStore } from '../store/useStore'
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

function KindBadge({ kind }: { kind: StudioItem['kind'] }) {
  const label = kind === 'pdf' ? 'PDF' : kind === 'image' ? 'IMG' : kind === 'post' ? 'POST' : 'NOTE'
  return (
    <span className="micro rounded bg-[rgba(160,140,220,0.14)] px-1.5 py-0.5 text-violet">
      {label}
    </span>
  )
}

/** One card in the pile — click to (de)select, × to remove. */
function PileCard({
  item,
  selected,
  onToggle,
  onRemove,
}: {
  item: StudioItem
  selected: boolean
  onToggle: () => void
  onRemove: () => void
}) {
  const src = item.imageData ? `data:${item.mediaType || 'image/jpeg'};base64,${item.imageData}` : ''
  return (
    <div
      onClick={onToggle}
      className={cn(
        'group relative cursor-pointer rounded-xl border p-3 transition-all duration-200',
        selected
          ? 'chip-active border-transparent'
          : 'border-border bg-[rgba(255,255,255,0.02)] hover:border-border-strong',
      )}
    >
      <div className="flex items-start gap-2">
        <span
          className={cn(
            'mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded border transition-colors',
            selected ? 'border-transparent bg-white' : 'border-border-strong',
          )}
        >
          {selected && <IconCheck size={12} className="text-[#3c3167]" />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <KindBadge kind={item.kind} />
            <span className="truncate text-[13px] font-medium text-text">{item.title}</span>
          </div>
          {src ? (
            <img
              src={src}
              alt=""
              className="mt-2 max-h-[92px] w-full rounded-md border border-border object-cover"
            />
          ) : (
            <p className="mt-1 line-clamp-2 text-[12px] leading-relaxed text-text-muted">
              {item.text}
            </p>
          )}
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation()
            onRemove()
          }}
          className="shrink-0 text-text-dim transition-colors hover:text-text-2"
          aria-label="Remove from pile"
        >
          <IconClose size={14} />
        </button>
      </div>
    </div>
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
  const location = useLocation()

  // the persistent pile
  const pile = useStudioStore((s) => s.items)
  const addToPile = useStudioStore((s) => s.add)
  const removeFromPile = useStudioStore((s) => s.remove)
  const clearPile = useStudioStore((s) => s.clear)

  // channel history (LinkedIn / Email / Articles tabs read this)
  const recordGeneration = useStore((s) => s.recordGeneration)
  const setHeroImage = useStore((s) => s.setHeroImage)
  const setChannelStatus = useStore((s) => s.setChannelStatus)
  const scheduleChannel = useStore((s) => s.scheduleChannel)
  const [historyId, setHistoryId] = useState<string | null>(null)

  // intake + selection
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [draftText, setDraftText] = useState('')
  const [ingestNote, setIngestNote] = useState('')
  const [ingesting, setIngesting] = useState(false)
  const pdfInputRef = useRef<HTMLInputElement>(null)
  const imgInputRef = useRef<HTMLInputElement>(null)

  // generation options
  const [snippet, setSnippet] = useState('')
  const [tone, setTone] = useState(TONES[0])
  const [imageUrl, setImageUrl] = useState('')

  // generation
  const [draft, setDraft] = useState<GeneratedContent | null>(null)
  const [generating, setGenerating] = useState(false)
  const [genError, setGenError] = useState('')
  /** auto-rendered branded card (headline baked in) — the default post image */
  const [card, setCard] = useState<{ dataUrl: string; blob: Blob } | null>(null)
  const previewRef = useRef<HTMLDivElement | null>(null)

  // publish / send
  const [scheduleLocal, setScheduleLocal] = useState('')
  const [publishing, setPublishing] = useState(false)
  const [publishNote, setPublishNote] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const [recipientsText, setRecipientsText] = useState('')
  const [sending, setSending] = useState(false)
  const [sendNote, setSendNote] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const [copied, setCopied] = useState(false)

  const [health, setHealth] = useState<HealthFlags | null>(null)

  useEffect(() => {
    api.health().then(setHealth).catch(() => setHealth(null))
  }, [])

  // Arriving from Daily Pulse's "Use this → draft mine" seeds one pile item.
  const prefilled = useRef(false)
  useEffect(() => {
    if (prefilled.current) return
    prefilled.current = true
    const s = (location.state as { prefillSource?: string } | null)?.prefillSource
    if (typeof s === 'string' && s.trim()) {
      const id = addToPile({ kind: 'note', title: 'From Daily Pulse', text: s.trim() })
      setSelected(new Set([id]))
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

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

  // Once the branded card renders, attach it to the recorded history entry.
  useEffect(() => {
    if (historyId && card?.dataUrl) setHeroImage(historyId, card.dataUrl)
  }, [card, historyId]) // eslint-disable-line react-hooks/exhaustive-deps

  const fullLinkedInText = useMemo(() => {
    if (!draft) return ''
    const tags = normalizeTags(draft.linkedin.hashtags)
    return [draft.linkedin.body.trim(), tags.join(' ')].filter(Boolean).join('\n\n')
  }, [draft])

  const effectiveImage = imageUrl.trim() || card?.dataUrl

  const allSelected = pile.length > 0 && pile.every((i) => selected.has(i.id))

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

  /* --- pile intake --------------------------------------------------------- */

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function selectAllToggle() {
    setSelected(allSelected ? new Set() : new Set(pile.map((i) => i.id)))
  }

  function removeItem(id: string) {
    removeFromPile(id)
    setSelected((prev) => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })
  }

  function addText() {
    const t = draftText.trim()
    if (!t) return
    const title = (t.split('\n')[0] || 'Note').slice(0, 56)
    const id = addToPile({ kind: t.length > 220 ? 'post' : 'note', title, text: t })
    setSelected((prev) => new Set(prev).add(id))
    setDraftText('')
    setIngestNote('')
  }

  async function onPickPdf(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setIngesting(true)
    setIngestNote(`Reading “${file.name}”…`)
    try {
      const { extractPdfText } = await import('../lib/pdfText')
      const text = await extractPdfText(file)
      const id = addToPile({ kind: 'pdf', title: file.name, text })
      setSelected((prev) => new Set(prev).add(id))
      setIngestNote(`Added “${file.name}” — ${text.length.toLocaleString()} chars of text.`)
    } catch (err) {
      setIngestNote((err as Error).message)
    } finally {
      setIngesting(false)
    }
  }

  async function onPickImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setIngesting(true)
    setIngestNote(`Processing “${file.name}”…`)
    try {
      const { base64, mediaType } = await fileToDownscaledImage(file)
      const id = addToPile({ kind: 'image', title: file.name, imageData: base64, mediaType })
      setSelected((prev) => new Set(prev).add(id))
      setIngestNote(`Added screenshot “${file.name}”.`)
    } catch (err) {
      setIngestNote((err as Error).message)
    } finally {
      setIngesting(false)
    }
  }

  async function handleGenerate() {
    if (generating) return
    let chosen = pile.filter((i) => selected.has(i.id))
    // Fold any text still sitting in the box into the pile, so you never have to
    // click "Add text" (or use the data-point field) just to generate.
    const pending = draftText.trim()
    if (pending) {
      const title = (pending.split('\n')[0] || 'Note').slice(0, 56)
      const kind: StudioItem['kind'] = pending.length > 220 ? 'post' : 'note'
      const id = addToPile({ kind, title, text: pending })
      setSelected((prev) => new Set(prev).add(id))
      setDraftText('')
      chosen = [...chosen, { id, kind, title, text: pending, createdAt: Date.now() }]
    }
    if (chosen.length === 0 && !snippet.trim()) {
      setGenError('Add a note, document, or screenshot — or a data point — to generate from.')
      return
    }
    setGenerating(true)
    setGenError('')
    setPublishNote(null)
    setSendNote(null)
    try {
      const textItems = chosen.filter((i) => i.text && i.text.trim())
      const imageItems = chosen.filter((i) => i.kind === 'image' && i.imageData)
      const sourceText = textItems
        .map((i) => `--- ${i.title} [${i.kind}] ---\n${i.text!.trim()}`)
        .join('\n\n')
      const images = imageItems
        .slice(0, 6)
        .map((i) => ({ mediaType: i.mediaType || 'image/jpeg', data: i.imageData! }))
      const { content } = await api.generate({
        sourceText,
        dashboardSnippet: snippet || undefined,
        tone,
        images: images.length ? images : undefined,
      })
      setDraft(content)
      const body = [content.linkedin.body.trim(), normalizeTags(content.linkedin.hashtags).join(' ')]
        .filter(Boolean)
        .join('\n\n')
      setHistoryId(
        recordGeneration({
          name: content.topic,
          topic: content.topic,
          headline: content.linkedin.headline,
          body,
          email: content.email,
          source: 'Studio',
        }),
      )
      setTimeout(() => previewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60)
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
          imageNote = ' (posted as text — image hosting isn’t set up)'
        }
      }
      const r = await api.publishLinkedIn({
        text: fullLinkedInText,
        imageUrl: finalImageUrl,
        scheduledAt: toIsoUtc(scheduleLocal),
      })
      if (historyId) {
        const date = scheduleLocal ? scheduleLocal.slice(0, 10) : ''
        if (date) scheduleChannel(historyId, 'linkedin', date)
        else setChannelStatus(historyId, 'linkedin', 'Published')
      }
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
      if (historyId) setChannelStatus(historyId, 'email', 'Published')
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
        title="Studio — build a pile, generate in one go"
        subtitle="Collect raw material as it comes — paste posts, drop PDFs, add screenshots. Select the pieces that matter and generate a branded LinkedIn post + email in one go, then publish to your LinkedIn page and email your list."
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
        {/* ---- left: pile intake + selection ---- */}
        <div className="space-y-4">
          {/* intake */}
          <Card className="p-5">
            <MicroLabel tone="violet">Add to the pile</MicroLabel>
            <div className="mt-3 space-y-3">
              <textarea
                className={cn(inputCls, 'min-h-[90px] resize-y leading-relaxed')}
                placeholder="Paste a post to riff on, or type a note… then add it to the pile."
                value={draftText}
                onChange={(e) => setDraftText(e.target.value)}
              />
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="subtle" size="sm" onClick={addText} disabled={!draftText.trim()}>
                  + Add text
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => pdfInputRef.current?.click()}
                  disabled={ingesting}
                >
                  + PDF
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => imgInputRef.current?.click()}
                  disabled={ingesting}
                >
                  + Screenshot
                </Button>
                <input
                  ref={pdfInputRef}
                  type="file"
                  accept="application/pdf,.pdf"
                  hidden
                  onChange={onPickPdf}
                />
                <input ref={imgInputRef} type="file" accept="image/*" hidden onChange={onPickImage} />
              </div>
              {ingestNote && <p className="text-[11.5px] text-text-dim">{ingestNote}</p>}

              <div className="grid gap-3 border-t border-border pt-3 sm:grid-cols-2">
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
                  <Label>Key data point to feature (optional)</Label>
                  <input
                    className={inputCls}
                    placeholder="e.g. energy inflows at a 14-month high"
                    value={snippet}
                    onChange={(e) => setSnippet(e.target.value)}
                  />
                </div>
                <div className="sm:col-span-2">
                  <Label>Custom image URL (optional — blank = auto-branded)</Label>
                  <input
                    className={inputCls}
                    placeholder="blank = auto-branded image"
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                  />
                </div>
              </div>
            </div>
          </Card>

          {/* the pile */}
          <Card className="p-5">
            <div className="flex items-center justify-between">
              <MicroLabel tone="violet">The pile · {pile.length}</MicroLabel>
              {pile.length > 0 && (
                <div className="flex items-center gap-3">
                  <button
                    className="micro text-text-dim transition-colors hover:text-text-2"
                    onClick={selectAllToggle}
                  >
                    {allSelected ? 'Clear selection' : 'Select all'}
                  </button>
                  <button
                    className="micro text-text-dim transition-colors hover:text-text-2"
                    onClick={() => {
                      clearPile()
                      setSelected(new Set())
                    }}
                  >
                    Empty pile
                  </button>
                </div>
              )}
            </div>

            {pile.length === 0 ? (
              <div className="mt-4 rounded-xl border border-dashed border-border p-8 text-center">
                <p className="mx-auto max-w-[40ch] text-[13px] leading-relaxed text-text-muted">
                  Nothing here yet. Paste a post, add a PDF, or drop a screenshot above — items stack
                  up here and stick around across sessions.
                </p>
              </div>
            ) : (
              <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {pile.map((item) => (
                  <PileCard
                    key={item.id}
                    item={item}
                    selected={selected.has(item.id)}
                    onToggle={() => toggle(item.id)}
                    onRemove={() => removeItem(item.id)}
                  />
                ))}
              </div>
            )}

            <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-border pt-4">
              <Button
                variant="primary"
                onClick={handleGenerate}
                disabled={
                  generating ||
                  (selected.size === 0 && !snippet.trim() && !draftText.trim()) ||
                  (!!health && !health.ai)
                }
              >
                <IconSparkle size={16} />
                {generating ? 'Generating…' : draft ? 'Regenerate in one go' : 'Generate in one go'}
              </Button>
              <span className="text-[12px] text-text-dim">
                {selected.size > 0
                  ? `${selected.size} item${selected.size > 1 ? 's' : ''} selected → one post + email`
                  : draftText.trim()
                    ? 'Your note will be used → one post + email'
                    : 'Add or select something to include'}
              </span>
            </div>
            {genError && <Note kind="err">{genError}</Note>}
            {!!health && !health.ai && (
              <p className="mt-2 text-[11.5px] text-text-dim">Generation isn’t available right now.</p>
            )}
          </Card>
        </div>

        {/* ---- right: previews + publish ---- */}
        <div className="space-y-6" ref={previewRef}>
          {!draft && (
            <Card className="grid min-h-[260px] place-items-center p-8 text-center">
              <div>
                <IconSparkle size={26} className="mx-auto text-text-dim" />
                <p className="mt-3 text-[14px] text-text-muted">
                  Your LinkedIn post and newsletter preview will appear here.
                </p>
                <p className="mt-1 text-[12.5px] text-text-dim">
                  Add material to the pile, select it, and hit Generate.
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
                    LinkedIn publishing isn’t connected yet — use “Copy text” to post manually.
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
                  <p className="text-[11.5px] text-text-dim">Email sending isn’t connected yet.</p>
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
