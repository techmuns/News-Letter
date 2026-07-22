import { type ChannelKind } from '../types'

export const ROUTES = {
  workspace: '/',
  preview: '/preview',
  scheduling: '/scheduling',
} as const

/** Path to a campaign's preview, optionally deep-linked to one channel's tab. */
export function previewPath(campaignId: string, kind?: ChannelKind): string {
  return kind ? `${ROUTES.preview}/${campaignId}/${kind}` : `${ROUTES.preview}/${campaignId}`
}
