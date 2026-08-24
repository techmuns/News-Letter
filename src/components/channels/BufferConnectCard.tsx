import { useEffect, useState } from 'react'
import { useHostSession } from '../../lib/HostSessionProvider'
import { bufferApi, type BufferChannel, type BufferConnection, type BufferOrganization } from '../../lib/bufferApi'
import { Card } from '../Card'
import { Button } from '../Button'
import { MicroLabel } from '../MicroLabel'
import { cn } from '../../lib/cn'

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

/** Reads (and strips) the `?buffer=connected|error&reason=…` query params the
    OAuth callback redirect leaves behind, so a refresh doesn't re-show it. */
function useOAuthRedirectNotice() {
  const [notice, setNotice] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const buffer = params.get('buffer')
    if (!buffer) return
    if (buffer === 'connected') {
      setNotice({ kind: 'ok', text: 'Buffer connected — pick your LinkedIn channel below.' })
    } else if (buffer === 'error') {
      const reason = params.get('reason') || 'unknown_error'
      setNotice({ kind: 'err', text: `Buffer connection failed (${reason}). Try again.` })
    }
    params.delete('buffer')
    params.delete('reason')
    const query = params.toString()
    window.history.replaceState(null, '', `${window.location.pathname}${query ? `?${query}` : ''}`)
  }, [])
  return notice
}

export function BufferConnectCard() {
  const { session, status } = useHostSession()
  const redirectNotice = useOAuthRedirectNotice()

  const [connection, setConnection] = useState<BufferConnection | null>(null)
  const [loadingConnection, setLoadingConnection] = useState(false)
  const [organizations, setOrganizations] = useState<BufferOrganization[] | null>(null)
  const [organizationId, setOrganizationId] = useState('')
  const [channels, setChannels] = useState<BufferChannel[] | null>(null)
  const [channelId, setChannelId] = useState('')
  const [busy, setBusy] = useState<'connect' | 'select' | 'disconnect' | 'post' | null>(null)
  const [note, setNote] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)

  const [postText, setPostText] = useState('')
  const [postNote, setPostNote] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)

  const token = session.token
  // Guest mode still works — it just shares one connection identity across
  // every visitor without a Munshot session (see munshotAuth.ts). Only the
  // transient "waiting for session" state has nothing to act on yet.
  const canAct = status !== 'waiting'

  useEffect(() => {
    if (!canAct) {
      setConnection(null)
      return
    }
    let cancelled = false
    setLoadingConnection(true)
    bufferApi
      .connection(token)
      .then((r) => {
        if (!cancelled) setConnection(r.connection)
      })
      .catch((e) => {
        if (cancelled) return
        setNote({ kind: 'err', text: (e as Error).message })
        // Still offer a way forward instead of leaving the user with only an
        // error and no button — Connect is safe to attempt even after a
        // failed status check (e.g. a transient network error).
        setConnection({ status: 'disconnected', organizationId: null, channelId: null, channelName: null, channelService: null })
      })
      .finally(() => {
        if (!cancelled) setLoadingConnection(false)
      })
    return () => {
      cancelled = true
    }
    // Re-check right after the OAuth redirect lands too.
  }, [canAct, token, redirectNotice])

  /** A call can fail because the backend just marked the connection
      disconnected (expired token, no refresh token — see
      functions/api/_lib/bufferAccounts.ts). When that happens, re-pull the
      authoritative connection state from the server instead of leaving the
      UI stuck showing a stale "connected" screen with a dead-end error and
      no way back to the Connect button. */
  async function resyncConnectionAfterError() {
    try {
      const r = await bufferApi.connection(token)
      setConnection(r.connection)
      if (r.connection.status !== 'connected') {
        setOrganizations(null)
        setChannels(null)
        setOrganizationId('')
        setChannelId('')
      }
    } catch {
      // Best-effort — leave the error note from the original failure as-is.
    }
  }

  async function loadOrganizations() {
    setBusy('select')
    setNote(null)
    try {
      const r = await bufferApi.organizations(token)
      setOrganizations(r.organizations)
      if (r.organizations.length === 1) {
        setOrganizationId(r.organizations[0].id)
        await loadChannels(r.organizations[0].id)
      }
    } catch (e) {
      setNote({ kind: 'err', text: (e as Error).message })
      await resyncConnectionAfterError()
    } finally {
      setBusy(null)
    }
  }

  async function loadChannels(orgId: string) {
    if (!orgId) return
    setBusy('select')
    setNote(null)
    try {
      const r = await bufferApi.channels(token, orgId)
      setChannels(r.channels)
    } catch (e) {
      setNote({ kind: 'err', text: (e as Error).message })
      await resyncConnectionAfterError()
    } finally {
      setBusy(null)
    }
  }

  async function handleConnect() {
    setBusy('connect')
    setNote(null)
    try {
      await bufferApi.connectBuffer(token) // navigates away on success
    } catch (e) {
      setNote({ kind: 'err', text: (e as Error).message })
      setBusy(null)
    }
  }

  async function handleSelectChannel() {
    if (!organizationId || !channelId) return
    setBusy('select')
    setNote(null)
    try {
      const r = await bufferApi.selectChannel(token, { organizationId, channelId })
      setConnection((prev) => (prev ? { ...prev, organizationId, channelId, channelName: r.channel.displayName || r.channel.name || null, channelService: r.channel.service } : prev))
      setNote({ kind: 'ok', text: `Using ${r.channel.displayName || r.channel.name || 'this channel'} for posts.` })
    } catch (e) {
      setNote({ kind: 'err', text: (e as Error).message })
      await resyncConnectionAfterError()
    } finally {
      setBusy(null)
    }
  }

  async function handleDisconnect() {
    setBusy('disconnect')
    setNote(null)
    try {
      await bufferApi.disconnect(token)
      setConnection({ status: 'disconnected', organizationId: null, channelId: null, channelName: null, channelService: null })
      setOrganizations(null)
      setChannels(null)
      setOrganizationId('')
      setChannelId('')
    } catch (e) {
      setNote({ kind: 'err', text: (e as Error).message })
    } finally {
      setBusy(null)
    }
  }

  async function handlePost() {
    if (!postText.trim()) return
    setBusy('post')
    setPostNote(null)
    try {
      const r = await bufferApi.post(token, { text: postText.trim() })
      setPostNote({ kind: 'ok', text: `Sent to Buffer — status: ${r.status}${r.scheduled ? ` (due ${r.dueAt})` : ''}.` })
      setPostText('')
    } catch (e) {
      setPostNote({ kind: 'err', text: (e as Error).message })
      await resyncConnectionAfterError()
    } finally {
      setBusy(null)
    }
  }

  const linkedInChannels = (channels || []).filter((c) => c.isLinkedIn)

  return (
    <Card className="p-5" solid>
      <div className="flex items-center justify-between gap-3">
        <MicroLabel>Post to LinkedIn via your Buffer account</MicroLabel>
        {connection?.status === 'connected' && (
          <Button variant="ghost" size="sm" onClick={handleDisconnect} disabled={busy !== null}>
            {busy === 'disconnect' ? 'Disconnecting…' : 'Disconnect'}
          </Button>
        )}
      </div>

      {redirectNotice && <Note kind={redirectNotice.kind}>{redirectNotice.text}</Note>}

      {status === 'waiting' && <p className="mt-2 text-[13px] text-text-dim">Waiting for session…</p>}

      {status === 'guest' && (
        <p className="mt-2 text-[13px] leading-relaxed text-text-muted">
          Not opened from inside Munshot, so this uses one shared connection for anyone with this link — open it
          from inside Munshot instead to get your own isolated Buffer connection.
        </p>
      )}

      {canAct && (
        <>
          {loadingConnection && !connection && (
            <p className="mt-2 text-[13px] text-text-dim">Checking your Buffer connection…</p>
          )}

          {connection && connection.status !== 'connected' && (
            <div className="mt-3">
              <Button variant="primary" size="sm" onClick={handleConnect} disabled={busy !== null}>
                {busy === 'connect' ? 'Redirecting to Buffer…' : 'Connect Buffer'}
              </Button>
            </div>
          )}

          {connection && connection.status === 'connected' && !connection.channelId && (
            <div className="mt-3 flex flex-col gap-3">
              <p className="text-[13px] text-text-muted">Buffer is connected — pick your LinkedIn channel.</p>
              {!organizations && (
                <Button variant="subtle" size="sm" onClick={loadOrganizations} disabled={busy !== null}>
                  {busy === 'select' ? 'Loading organizations…' : 'Choose organization'}
                </Button>
              )}
              {organizations && organizations.length > 1 && (
                <select
                  className={cn(inputCls, 'appearance-none')}
                  value={organizationId}
                  onChange={(e) => {
                    setOrganizationId(e.target.value)
                    setChannelId('')
                    setChannels(null)
                    if (e.target.value) loadChannels(e.target.value)
                  }}
                >
                  <option value="">Select an organization…</option>
                  {organizations.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
                </select>
              )}
              {channels && (
                <>
                  <select
                    className={cn(inputCls, 'appearance-none')}
                    value={channelId}
                    onChange={(e) => setChannelId(e.target.value)}
                  >
                    <option value="">
                      {linkedInChannels.length ? 'Select a LinkedIn channel…' : 'No LinkedIn channels found'}
                    </option>
                    {linkedInChannels.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.displayName || c.name || c.id}
                      </option>
                    ))}
                  </select>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleSelectChannel}
                    disabled={busy !== null || !channelId}
                  >
                    {busy === 'select' ? 'Saving…' : 'Use this channel'}
                  </Button>
                </>
              )}
            </div>
          )}

          {connection && connection.status === 'connected' && connection.channelId && (
            <div className="mt-3 flex flex-col gap-3">
              <p className="text-[13px] text-text-muted">
                Posting to <strong className="text-text">{connection.channelName || connection.channelId}</strong>
              </p>
              <textarea
                className={cn(inputCls, 'min-h-[90px] resize-y leading-relaxed')}
                placeholder="Write your LinkedIn post…"
                value={postText}
                onChange={(e) => setPostText(e.target.value)}
              />
              <Button variant="primary" size="sm" onClick={handlePost} disabled={busy !== null || !postText.trim()}>
                {busy === 'post' ? 'Posting…' : 'Post to LinkedIn'}
              </Button>
              {postNote && <Note kind={postNote.kind}>{postNote.text}</Note>}
            </div>
          )}
        </>
      )}

      {note && <Note kind={note.kind}>{note.text}</Note>}
    </Card>
  )
}
