import { useEffect, useState } from 'react'
import { api, getAppSecret, setAppSecret } from '../lib/api'
import { Card } from './Card'
import { Button } from './Button'
import { MicroLabel } from './MicroLabel'
import { cn } from '../lib/cn'

const inputCls =
  'w-full rounded-lg border border-border bg-[rgba(255,255,255,0.02)] px-3 py-2 text-[14px] text-text ' +
  'placeholder:text-text-dim focus:outline-none focus-violet transition-colors'

/**
 * When the backend has APP_SECRET configured, every write call must carry it.
 * This is the only place to enter it — without this the app would 401 on
 * everything with no way in. The value is kept in localStorage per browser
 * (see lib/api.ts), never sent anywhere but this app's own API.
 *
 * Note this is a single shared passphrase for the whole deployment, not a
 * per-user login: it keeps strangers out, it does not separate one user's
 * data from another's.
 */
export function AppSecretGate({ children }: { children: React.ReactNode }) {
  const [required, setRequired] = useState<boolean | null>(null)
  const [hasSecret, setHasSecret] = useState(() => Boolean(getAppSecret()))
  const [value, setValue] = useState('')
  const [checking, setChecking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    api
      .health()
      .then((h) => {
        if (!cancelled) setRequired(Boolean(h.authRequired))
      })
      .catch(() => {
        // Can't reach the backend — don't block the UI behind a gate we
        // can't even verify; the app's own error states will explain.
        if (!cancelled) setRequired(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const candidate = value.trim()
    if (!candidate) return
    setChecking(true)
    setError(null)
    // Store it first so the verification call carries it, then roll back if
    // the backend rejects it — otherwise a wrong passphrase would be saved.
    const previous = getAppSecret()
    setAppSecret(candidate)
    try {
      await api.stockSearch('__appsecret_check__')
      setHasSecret(true)
    } catch (err) {
      const message = (err as Error).message || ''
      if (/unauthorized/i.test(message)) {
        setAppSecret(previous)
        setError('That passphrase was rejected. Check it and try again.')
      } else {
        // Any non-auth failure means the passphrase itself got through.
        setHasSecret(true)
      }
    } finally {
      setChecking(false)
    }
  }

  if (required === null) return null // brief: waiting on /api/health
  if (!required || hasSecret) return <>{children}</>

  return (
    <div className="grid min-h-screen place-items-center px-4">
      <Card className="w-full max-w-[420px] p-6" solid>
        <MicroLabel>Munshot · Content System</MicroLabel>
        <h1 className="mt-3 font-display text-[20px] font-bold tracking-tight text-text">
          Enter the app passphrase
        </h1>
        <p className="mt-2 text-[13px] leading-relaxed text-text-muted">
          This deployment is passphrase-protected. Enter it once — it's remembered in this browser.
        </p>
        <form onSubmit={submit} className="mt-4 flex flex-col gap-3">
          <input
            type="password"
            autoFocus
            className={inputCls}
            placeholder="Passphrase"
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
          <Button type="submit" variant="primary" size="md" disabled={checking || !value.trim()}>
            {checking ? 'Checking…' : 'Unlock'}
          </Button>
          {error && (
            <p
              className={cn(
                'rounded-lg px-3 py-2 text-[12.5px] leading-relaxed',
                'bg-[rgba(248,113,113,0.08)] text-[#f7a3a3] ring-1 ring-[rgba(248,113,113,0.2)]',
              )}
            >
              {error}
            </p>
          )}
        </form>
      </Card>
    </div>
  )
}
