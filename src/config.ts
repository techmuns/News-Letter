/* ============================================================
   Editable configuration — NOT mock content.

   Everything in this file is real configuration the team is expected
   to own and edit. It is deliberately separated from generated content
   so that nothing here is ever produced by a model.
   ============================================================ */

import { type Promotion } from './types'

/** Identity used when rendering a LinkedIn post preview and email "from". */
export const BRAND = {
  /** Name on the LinkedIn company page. */
  authorName: 'Munshot',
  /** Tagline shown under the name in-feed. */
  authorHandle: 'Intelligence for institutional investors',
  /** Initials used for the avatar mark. */
  authorAvatar: 'M',
  /** Envelope "from" for the newsletter preview. */
  emailFrom: 'Munshot Intelligence <intel@munshot.io>',
} as const

/**
 * Products a campaign can point at. A campaign attaches at most one, and only
 * when it is genuinely relevant — the pointer renders as a quiet CTA.
 *
 * Edit this list to match the products you actually want to promote. An empty
 * list is valid: campaigns will simply carry no pointer.
 */
export const PROMOTIONS: Promotion[] = [
  {
    id: 'promo-drhp',
    name: 'DRHP Dash',
    benefit: 'Surfaces IPO filings and DRHP amendments as they land — before the print.',
    ctaLabel: 'Open DRHP Dash',
  },
  {
    id: 'promo-sector',
    name: 'Sector Pulse',
    benefit: 'Live sector heatmaps that flag margin and multiple shifts across the tape.',
    ctaLabel: 'Explore Sector Pulse',
  },
  {
    id: 'promo-diligence',
    name: 'Diligence OS',
    benefit: 'Turns a filing into a structured diligence workspace in minutes, not days.',
    ctaLabel: 'See Diligence OS',
  },
  {
    id: 'promo-channel',
    name: 'Channel Probe',
    benefit: 'Reads distributor and channel signals weeks ahead of reported numbers.',
    ctaLabel: 'Open Channel Probe',
  },
]

export function promotionById(id: string | null | undefined): Promotion | undefined {
  if (!id) return undefined
  return PROMOTIONS.find((p) => p.id === id)
}

/* ---- Upload limits ----------------------------------------------------- */

/**
 * Per-file cap. The generate endpoint forwards files to the model as base64,
 * which inflates them by ~33%, and the upstream request ceiling is 50 MB
 * across all files in one request. 8 MB per file keeps a multi-file selection
 * comfortably inside that.
 */
export const MAX_FILE_BYTES = 8 * 1024 * 1024

/** Total raw bytes allowed across one "Turn into content" request. */
export const MAX_REQUEST_BYTES = 24 * 1024 * 1024

/** File types we forward to the model. Anything else is stored but not sent. */
export const SENDABLE_MIME = /^(application\/pdf|image\/(png|jpeg|webp|gif))$/
