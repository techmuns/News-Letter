import { useEffect, useMemo, useRef, useState } from 'react'
import { Card } from '../../components/Card'
import { Button } from '../../components/Button'
import { MicroLabel } from '../../components/MicroLabel'
import { LinkedInPost } from '../../components/preview/LinkedInPost'
import { EmailPreview } from '../../components/preview/EmailPreview'
import { IconSparkle, IconLinkedIn, IconEmail, IconCheck } from '../../components/icons'
import {
  api,
  getAppSecret,
  setAppSecret,
  type PulsePost,
  type PulseFeed,
  type PulseItem,
  type HealthFlags,
} from '../../lib/api'
import { buildEmailHtml } from '../../lib/emailTemplate'
import { renderPulseImage, type PulseImageStyle } from '../../lib/pulseImage'
import { type LinkedInContent, type EmailContent } from '../../types'
import { cn } from '../../lib/cn'

const TONES = ['Sharp & market-savvy', 'Neutral & data-led', 'Punchy & bold', 'Calm & measured']

const GROUP_LABEL: Record<PulseItem['group'], string> = {
  index: 'Indices',
  currency: 'Currencies',
  commodity: 'Commodities',
  holding: 'Holdings',
}
const GROUP_ORDER: PulseItem['group'][] = ['index', 'currency', 'commodity', 'holding']

const inputCls =
  'w-full rounded-lg border border-border bg-[rgba(255,255,255,0.02)] px-3 py-2 text-[14px] text-text ' +
  'placeholder:text-text-dim focus:outline-none focus-violet transition-colors'

function Label({ children }: { children: React.ReactNode }) {
  return <MicroLabel className="mb-1.5 block text-text-muted">{children}</MicroLabel>
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

function StatusRow({ ok, label, hint }: { ok: boolean; label: string; hint?: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className={cn('h-2 w-2 shrink-0 rounded-full', ok ? 'bg-[#54d98c]' : 'bg-text-dim')} />
      <span className="text-[13px] text-text-2">{label}</span>
      {!ok && hint && <span className="text-[11px] text-text-dim">· {hint}</span>}
    </div>
  )
}

function normalizeTags(tags: string[]): string[] {
  return tags
    .filter(Boolean)
    .map((t) => '#' + String(t).replace(/^#+/, '').trim().replace(/\s+/g, ''))
    .filter((t) => t.length > 1)
}

function toIsoUtc(local: string): string | undefined {
  if (!local) return undefined
  const d = new Date(local)
  return isNaN(d.getTime()) ? undefined : d.toISOString()
}

function dateLabelFrom(iso: string): string {
  const d = iso ? new Date(iso) : new Date()
  const use = isNaN(d.getTime()) ? new Date() : d
  return use.toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })
}

/** hook + bulleted lines + hashtags → the full LinkedIn caption text. */
function composeCaption(post: PulsePost): string {
  const bullets = post.linkedin.bullets
    .map((b) => b.trim())
    .filter(Boolean)
    .map((b) => `• ${b.replace(/^•\s*/, '')}`)
    .join('\n')
  const tags = normalizeTags(post.linkedin.hashtags).join(' ')
  return [post.linkedin.hook.trim(), bullets, tags].filter(Boolean).join('\n\n')
}

export function DailyPulseComposer({ feed, health }: { feed: PulseFeed; health: HealthFlags | null }) {
  const [focusId, setFocusId] = useState('')
  const [tone, setTone] = useState(TONES[0])
  const [imageStyle, setImageStyle] = useState<PulseImageStyle>('gainers')

  const [post, setPost] = useState<PulsePost | null>(null)
  const [generating, setGenerating] = useState(false)
  const [genError, setGenError] = useState('')
  const [card, setCard] = useState<{ dataUrl: string; blob: Blob } | null>(null)

  const [scheduleLocal, setScheduleLocal] = useState('')
  const [publishing, setPublishing] = useState(false)
  const [publishNote, setPublishNote] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const [copied, setCopied] = useState(false)
  const [recipientsText, setRecipientsText] = useState('')
  const [sending, setSending] = useState(false)
  const [sendNote, setSendNote] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const [secretInput, setSecretInput] = useState(getAppSecret())

  const previewRef = useRef<HTMLDivElement | null>(null)

  const focusOptions = useMemo(() => {
    const groups: { group: PulseItem['group']; items: PulseItem[] }[] = []
    for (const g of GROUP_ORDER) {
      const items = feed.items.filter((it) => it.group === g)
      if (items.length) groups.push({ group: g, items })
    }
    return groups
  }, [feed])

  // Render the branded image from the feed whenever a post exists or the style changes.
  useEffect(() => {
    if (!post) {
      setCard(null)
      return
    }
    let cancelled = false
    renderPulseImage(imageStyle, feed.items, { dateLabel: dateLabelFrom(feed.fetchedAt) })
      .then((c) => !cancelled && setCard(c))
      .catch(() => !cancelled && setCard(null))
    return () => {
      cancelled = true
    }
  }, [post, imageStyle, feed])

  const caption = useMemo(() => (post ? composeCaption(post) : ''), [post])

  function patchLinkedIn(p: Partial<PulsePost['linkedin']>) {
    setPost((d) => (d ? { ...d, linkedin: { ...d.linkedin, ...p } } : d))
  }
  function patchEmail(p: Partial<PulsePost['email']>) {
    setPost((d) => (d ? { ...d, email: { ...d.email, ...p } } : d))
  }

  async function handleGenerate() {
    if (generating) return
    setGenerating(true)
    setGenError('')
    setPublishNote(null)
    setSendNote(null)
    try {
      const { post: p } = await api.pulseGenerate({ focusId: focusId || undefined, tone })
      setPost(p)
      // jump to the preview once it's ready
      setTimeout(() => previewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60)
    } catch (e) {
      setGenError((e as Error).message)
    } finally {
      setGenerating(false)
    }
  }

  /** Upload the branded card and return its hosted URL, or undefined + a note. */
  async function hostedImageUrl(): Promise<{ url?: string; note: string }> {
    if (!card) return { note: '' }
    if (!health?.images) {
      return { note: ' (text-only — add the KV STORE binding to attach the branded image)' }
    }
    try {
      const { url } = await api.uploadImage(card.blob)
      return { url, note: '' }
    } catch (e) {
      return { note: ` (image not hosted: ${(e as Error).message})` }
    }
  }

  async function handlePublish() {
    if (!post || publishing) return
    setPublishing(true)
    setPublishNote(null)
    try {
      const { url, note } = await hostedImageUrl()
      const r = await api.publishLinkedIn({
        text: caption,
        imageUrl: url,
        scheduledAt: toIsoUtc(scheduleLocal),
      })
      setPublishNote({
        kind: 'ok',
        text:
          (r.scheduled
            ? `Scheduled on the Munshot LinkedIn page via Buffer${r.dueAt ? ` for ${new Date(r.dueAt).toLocaleString()}` : ''}.`
            : 'Sent to Buffer — it will publish to the Munshot LinkedIn page at the next queue slot.') + note,
      })
    } catch (e) {
      setPublishNote({ kind: 'err', text: (e as Error).message })
    } finally {
      setPublishing(false)
    }
  }

  async function handleSend() {
    if (!post || sending) return
    setSending(true)
    setSendNote(null)
    try {
      const { url } = await hostedImageUrl()
      const html = buildEmailHtml(post.email, { heroImageUrl: url })
      const recipients = recipientsText
        .split(/[\n,;]+/)
        .map((s) => s.trim())
        .filter(Boolean)
      const r = await api.sendEmail({
        subject: post.email.subject,
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
      await navigator.clipboard.writeText(caption)
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch {
      /* ignore */
    }
  }

  const liPreview: LinkedInContent | null = post && {
    authorName: 'Munshot',
    authorHandle: 'Munshot Intelligence · Daily Pulse',
    authorAvatar: 'M',
    headline: post.focus,
    body: caption,
    reactions: 0,
    comments: 0,
    reposts: 0,
  }
  const emailPreview: EmailContent | null = post && {
    subject: post.email.subject,
    from: 'Munshot Intelligence',
    preheader: post.email.preheader,
    idea: post.email.idea,
    story: post.email.story,
    takeaway: post.email.takeaway,
    ctaLabel: post.email.ctaLabel,
  }

  return (
    <div className="space-y-6">
      {/* ---- composer controls ---- */}
      <Card solid className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <MicroLabel tone="violet">Compose today's Daily Pulse post</MicroLabel>
          {health && (
            <div className="flex flex-wrap gap-x-5 gap-y-1">
              <StatusRow
                ok={!!health.ai}
                label={health.aiProvider && health.aiProvider !== 'none' ? `AI · ${health.aiProvider}` : 'AI'}
                hint="BEDROCK_API_KEY"
              />
              <StatusRow ok={!!health.linkedin} label="LinkedIn" hint="Buffer" />
              <StatusRow ok={!!health.email} label="Email" hint="provider" />
            </div>
          )}
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="sm:col-span-2">
            <Label>Focus</Label>
            <select
              className={cn(inputCls, 'appearance-none')}
              value={focusId}
              onChange={(e) => setFocusId(e.target.value)}
            >
              <option value="" className="bg-surface-solid">
                Auto — whole-market wrap
              </option>
              {focusOptions.map(({ group, items }) => (
                <optgroup key={group} label={GROUP_LABEL[group]}>
                  {items.map((it) => (
                    <option key={it.id} value={it.id} className="bg-surface-solid">
                      {it.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
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
            <Label>Image</Label>
            <div className="inline-flex w-full rounded-lg border border-border p-0.5">
              {(
                [
                  { v: 'gainers', label: 'Gainers/Losers' },
                  { v: 'index', label: 'Index board' },
                ] as { v: PulseImageStyle; label: string }[]
              ).map((o) => (
                <button
                  key={o.v}
                  onClick={() => setImageStyle(o.v)}
                  className={cn(
                    'flex-1 rounded-md px-2 py-1.5 text-[12.5px] font-medium transition-colors',
                    imageStyle === o.v
                      ? 'bg-[rgba(157,140,245,0.16)] text-violet'
                      : 'text-text-muted hover:text-text-2',
                  )}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button
            variant="primary"
            onClick={handleGenerate}
            disabled={generating || (!!health && !health.ai)}
          >
            <IconSparkle size={16} />
            {generating ? 'Generating…' : post ? 'Regenerate' : 'Generate post'}
          </Button>
          <span className="text-[12px] text-text-dim">
            Uses today's feed ({feed.items.length} instruments) · {focusId ? 'focused' : 'auto wrap'}
          </span>
        </div>
        {genError && <Note kind="err">{genError}</Note>}
        {!!health && !health.ai && (
          <p className="mt-2 text-[11.5px] text-text-dim">
            Add <code>BEDROCK_API_KEY</code> to enable generation (SETUP.md).
          </p>
        )}

        {health?.authRequired && (
          <div className="mt-4 flex flex-wrap items-end gap-2 border-t border-border pt-3">
            <div className="min-w-[220px] flex-1">
              <Label>App secret (required to publish / send)</Label>
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

      {/* ---- previews ---- */}
      {post && liPreview && emailPreview && (
        <div ref={previewRef} className="grid gap-6 lg:grid-cols-2">
          {/* LinkedIn */}
          <Card className="p-5">
            <div className="mb-3 flex items-center gap-2">
              <IconLinkedIn size={15} className="text-[#0a66c2]" />
              <MicroLabel tone="violet">LinkedIn post</MicroLabel>
            </div>

            <LinkedInPost content={liPreview} image={card?.dataUrl} topic={post.focus} plainImage />

            <div className="mt-4 space-y-3">
              <div>
                <Label>Hook line</Label>
                <input
                  className={inputCls}
                  value={post.linkedin.hook}
                  onChange={(e) => patchLinkedIn({ hook: e.target.value })}
                />
              </div>
              <div>
                <Label>Bullets (one per line — keep the leading emoji)</Label>
                <textarea
                  className={cn(inputCls, 'min-h-[130px] resize-y leading-relaxed')}
                  value={post.linkedin.bullets.join('\n')}
                  onChange={(e) => patchLinkedIn({ bullets: e.target.value.split('\n') })}
                />
              </div>
              <div>
                <Label>Hashtags (space-separated)</Label>
                <input
                  className={inputCls}
                  value={post.linkedin.hashtags.join(' ')}
                  onChange={(e) => patchLinkedIn({ hashtags: e.target.value.split(/\s+/).filter(Boolean) })}
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
                {card && (
                  <a
                    href={card.dataUrl}
                    download={`daily-pulse-${imageStyle}.png`}
                    className="inline-flex h-[38px] items-center rounded-lg border border-border px-3 text-[13px] text-text-2 hover:border-violet hover:text-text"
                  >
                    Download image
                  </a>
                )}
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

          {/* Email */}
          <Card className="p-5">
            <div className="mb-3 flex items-center gap-2">
              <IconEmail size={15} className="text-violet" />
              <MicroLabel tone="violet">Email newsletter</MicroLabel>
            </div>

            <EmailPreview content={emailPreview} heroImage={card?.dataUrl} />

            <div className="mt-4 space-y-3">
              <div>
                <Label>Subject</Label>
                <input
                  className={inputCls}
                  value={post.email.subject}
                  onChange={(e) => patchEmail({ subject: e.target.value })}
                />
              </div>
              <div>
                <Label>Preheader</Label>
                <input
                  className={inputCls}
                  value={post.email.preheader}
                  onChange={(e) => patchEmail({ preheader: e.target.value })}
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <Label>The idea</Label>
                  <textarea
                    className={cn(inputCls, 'min-h-[70px] resize-y')}
                    value={post.email.idea}
                    onChange={(e) => patchEmail({ idea: e.target.value })}
                  />
                </div>
                <div>
                  <Label>The story</Label>
                  <textarea
                    className={cn(inputCls, 'min-h-[70px] resize-y')}
                    value={post.email.story}
                    onChange={(e) => patchEmail({ story: e.target.value })}
                  />
                </div>
                <div>
                  <Label>The takeaway</Label>
                  <textarea
                    className={cn(inputCls, 'min-h-[70px] resize-y')}
                    value={post.email.takeaway}
                    onChange={(e) => patchEmail({ takeaway: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
                <div>
                  <Label>Recipients (comma / newline — blank uses your saved list)</Label>
                  <textarea
                    className={cn(inputCls, 'min-h-[52px] resize-y')}
                    placeholder={
                      health?.hasDefaultRecipients
                        ? 'Leave blank to use your EMAIL_RECIPIENTS list…'
                        : 'jane@fund.com, ravi@capital.com'
                    }
                    value={recipientsText}
                    onChange={(e) => setRecipientsText(e.target.value)}
                  />
                </div>
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
                  Connect an email provider to send — add the provider key and <code>EMAIL_FROM</code>{' '}
                  (SETUP.md).
                </p>
              )}
              {sendNote && <Note kind={sendNote.kind}>{sendNote.text}</Note>}
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
