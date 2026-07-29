/* ============================================================
   Client half of the generation call.

   Loads the real payloads for the selected workspace items out of
   IndexedDB, base64-encodes them, and posts to /api/generate. The
   OpenAI key lives on the server; nothing secret passes through here.
   ============================================================ */

import { PROMOTIONS, MAX_REQUEST_BYTES, SENDABLE_MIME } from '../config'
import { type WorkspaceItem, type ArticleSection } from '../types'
import { getFile, toBase64 } from './fileStore'

/** Shape the endpoint returns — mirrors DRAFT_SCHEMA in functions/api/generate.ts. */
export interface CampaignDraft {
  name: string
  topic: string
  promoId: string | null
  linkedin: { headline: string; body: string }
  email: {
    subject: string
    preheader: string
    idea: string
    story: string
    takeaway: string
    ctaLabel: string
  }
  article: {
    title: string
    deck: string
    hero: string
    readMinutes: number
    sections: { heading: string | null; body: string }[]
    ctaTitle: string
    ctaBody: string
    ctaLabel: string
  }
}

export class GenerateError extends Error {}

type OutgoingItem =
  | { kind: 'note'; title: string; text: string }
  | { kind: 'file'; title: string; filename: string; mediaType: string; data: string }

/** Normalises the model's nullable headings into our optional-field shape. */
export function toSections(raw: { heading: string | null; body: string }[]): ArticleSection[] {
  return raw.map((s) => (s.heading ? { heading: s.heading, body: s.body } : { body: s.body }))
}

export async function generateCampaign(items: WorkspaceItem[]): Promise<CampaignDraft> {
  if (items.length === 0) {
    throw new GenerateError('Select at least one item first.')
  }

  const outgoing: OutgoingItem[] = []
  let totalBytes = 0

  for (const item of items) {
    if (!item.hasPayload) {
      // Notes carry their whole text in `preview`.
      outgoing.push({ kind: 'note', title: item.title, text: item.preview })
      continue
    }

    const stored = await getFile(item.id)
    if (!stored) {
      throw new GenerateError(
        `"${item.title}" is missing its file data. Remove it from the pile and add it again.`,
      )
    }

    if (!SENDABLE_MIME.test(stored.mediaType)) {
      // Keep it in the request as context, but don't ship bytes we can't use.
      outgoing.push({
        kind: 'note',
        title: item.title,
        text: `(A ${stored.mediaType} file named ${stored.filename} was attached but cannot be read by the model.)`,
      })
      continue
    }

    totalBytes += stored.blob.size
    if (totalBytes > MAX_REQUEST_BYTES) {
      throw new GenerateError(
        'That selection is too large to send at once. Select fewer or smaller files.',
      )
    }

    outgoing.push({
      kind: 'file',
      title: item.title,
      filename: stored.filename,
      mediaType: stored.mediaType,
      data: await toBase64(stored.blob),
    })
  }

  let res: Response
  try {
    res = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ items: outgoing, promotions: PROMOTIONS }),
    })
  } catch {
    throw new GenerateError('Could not reach the server. Check your connection and try again.')
  }

  let payload: { ok?: boolean; draft?: CampaignDraft; error?: string }
  try {
    payload = await res.json()
  } catch {
    throw new GenerateError(
      res.status === 404
        ? 'The /api/generate endpoint is not running. In local dev, start it with `npm run dev:api`.'
        : `The server returned an unreadable response (${res.status}).`,
    )
  }

  if (!res.ok || !payload.ok || !payload.draft) {
    throw new GenerateError(payload.error ?? `Generation failed (${res.status}).`)
  }

  return payload.draft
}
