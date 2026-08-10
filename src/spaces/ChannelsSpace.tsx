import { useState } from 'react'
import { PageHeader } from '../components/PageHeader'
import { cn } from '../lib/cn'
import { LinkedInPanel } from './channels/LinkedInPanel'
import { EmailPanel } from './channels/EmailPanel'
import { ArticlesPanel } from './channels/ArticlesPanel'

type Tab = 'linkedin' | 'email' | 'article'

const TABS: { v: Tab; label: string }[] = [
  { v: 'linkedin', label: 'LinkedIn' },
  { v: 'email', label: 'Email' },
  { v: 'article', label: 'Articles' },
]

/** One home for everything you've generated, with LinkedIn / Email / Articles
    as sub-tabs (replaces the three separate spaces). */
export function ChannelsSpace() {
  const [tab, setTab] = useState<Tab>('linkedin')
  return (
    <div>
      <PageHeader
        eyebrow="01 · Channels"
        title="Channels"
        subtitle="Everything you've generated — the LinkedIn post, the email, and the long-form article for each. Switch channels below."
      />
      <div className="mb-6 inline-flex rounded-lg border border-border p-0.5">
        {TABS.map((t) => (
          <button
            key={t.v}
            onClick={() => setTab(t.v)}
            className={cn(
              'rounded-md px-4 py-1.5 text-[13px] font-medium transition-colors',
              tab === t.v ? 'chip-active' : 'text-text-muted hover:text-text-2',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'linkedin' && <LinkedInPanel />}
      {tab === 'email' && <EmailPanel />}
      {tab === 'article' && <ArticlesPanel />}
    </div>
  )
}
