import { type ChannelKind } from '../types'

export const ROUTES = {
  workspace: '/',
  linkedin: '/linkedin',
  email: '/email',
  articles: '/articles',
} as const

const CHANNEL_BASE: Record<ChannelKind, string> = {
  linkedin: ROUTES.linkedin,
  email: ROUTES.email,
  article: ROUTES.articles,
}

/** Path to a channel space, optionally deep-linked to a campaign's preview. */
export function channelPath(kind: ChannelKind, campaignId?: string): string {
  const base = CHANNEL_BASE[kind]
  return campaignId ? `${base}/${campaignId}` : base
}
