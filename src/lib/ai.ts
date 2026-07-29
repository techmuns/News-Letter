/* ============================================================
   The browser's side of the model call.

   Everything here posts to /api/generate — our own Pages Function
   — so the OpenAI key stays on the server and the browser never
   holds it. Two calls exist:

   · analyzeImages  a dropped screenshot, slide or scanned page is
     read by a vision model, and what it says becomes the
     material's `extracted` text. From that point on every part of
     the app that already worked on document text — the write-up,
     the sourced quotes, the playbook check — works on images too.

   · composeDraft   the images themselves, the extracted document
     text, and the author's write-up go to the model in one
     request, and the three channel drafts come back written from
     what the document says.

   Both degrade rather than break: with no key configured the
   caller falls back to the deterministic composer, which is what
   the app did before any of this existed.
   ============================================================ */

import { type AiTrace, type GenerationBrief, type WorkspaceItem } from '../types'
import {
  AUDIENCE_OPTS,
  CONFIDENCE_OPTS,
  CONTENT_TYPE_OPTS,
  DATA_OPTS,
  DEPTH_OPTS,
  LENGTH_HINT,
  LENGTH_OPTS,
  MARKET_OPTS,
  OBJECTIVE_OPTS,
  POV_OPTS,
  SOURCING_OPTS,
  TONE_OPTS,
  labelOf,
} from './brief'
import { cleanCopy, cleanLine } from './sanitize'

const ENDPOINT = '/api/generate'

/* ---- is a model wired up at all? ---------------------------- */

export interface AiConfig {
  configured: boolean
  model: string | null
  maxImages: number
  reason: string
}

const OFFLINE: AiConfig = {
  configured: false,
  model: null,
  maxImages: 0,
  reason: 'The generation endpoint is not reachable from here.',
}

let configPromise: Promise<AiConfig> | null = null

/**
 * Whether this deployment has a model behind it. Asked once and cached — the
 * answer only changes on redeploy, and every upload would otherwise re-ask.
 */
export function aiConfig(): Promise<AiConfig> {
  if (!configPromise) {
    configPromise = fetch(ENDPOINT, { method: 'GET' })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then((data: Partial<AiConfig>) => ({
        configured: !!data.configured,
        model: data.model ?? null,
        maxImages: Number(data.maxImages) || 4,
        reason: data.reason ?? '',
      }))
      .catch(() => OFFLINE)
  }
  return configPromise
}

/** Re-asks on the next call — used after a deploy or a config change. */
export function forgetAiConfig(): void {
  configPromise = null
}

/* ---- what a call reports about itself ----------------------- */

/**
 * What actually went to OpenAI on a request — defined with the domain model,
 * because it is stored on the campaign it produced.
 */
export type { AiTrace }

export interface AiImage {
  name: string
  /** data: URL — the actual bytes, which is what gets transmitted */
  dataUrl: string
}

export interface AiDocument {
  name: string
  text: string
  pages?: number
}

/* ---- reading an image ---------------------------------------- */

export interface AiReadResult {
  readable: boolean
  text: string
  title: string
  kind: string
  /** why nothing was read — shown to the author instead of a generic post */
  reason: string
  trace?: AiTrace
}

async function post(body: unknown): Promise<Record<string, unknown>> {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>
  if (!res.ok) {
    throw Object.assign(new Error(String(data.error ?? `Request failed (${res.status}).`)), {
      unconfigured: data.unconfigured === true,
    })
  }
  return data
}

/**
 * Reads one or more uploaded images with a vision model.
 *
 * The author's instructions ride along so the model knows what the page is
 * being read for — but the prompt tells it to transcribe everything anyway,
 * because a figure that looks irrelevant now is the one the author quotes later.
 */
export async function analyzeImages(
  images: AiImage[],
  instructions?: string,
): Promise<AiReadResult> {
  if (!images.length) return { readable: false, text: '', title: '', kind: '', reason: 'No image.' }
  const cfg = await aiConfig()
  if (!cfg.configured) {
    return {
      readable: false,
      text: '',
      title: '',
      kind: '',
      // The author didn't do anything wrong here, so the card says what is
      // missing from the deployment rather than reading as a failed upload.
      reason: 'No vision model is configured on this deployment, so this image was not read.',
    }
  }

  try {
    const data = await post({ mode: 'analyze', images, instructions })
    return {
      readable: data.readable === true,
      text: typeof data.text === 'string' ? data.text : '',
      title: typeof data.title === 'string' ? data.title : '',
      kind: typeof data.kind === 'string' ? data.kind : '',
      reason: typeof data.reason === 'string' ? data.reason : '',
      trace: data.trace as AiTrace | undefined,
    }
  } catch (err) {
    return {
      readable: false,
      text: '',
      title: '',
      kind: '',
      reason: err instanceof Error ? err.message : 'The document could not be read.',
    }
  }
}

/* ---- writing the piece --------------------------------------- */

export interface AiDraft {
  topic: string
  documentSummary: string
  keyFacts: string[]
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
    readMinutes: number
    sections: { heading?: string; body: string }[]
  }
}

export interface AiComposeInput {
  /** the author's write-up / prompt — what they want the piece to say */
  instructions: string
  brief: GenerationBrief
  documents: AiDocument[]
  images: AiImage[]
  /** the §3/§6 pointer line, or null at a 100/0 insight ratio */
  closingPointer: string | null
}

export type AiComposeResult =
  | { ok: true; draft: AiDraft; trace?: AiTrace }
  /** the model read the material and found nothing to write from */
  | { ok: false; kind: 'unreadable'; reason: string; trace?: AiTrace }
  /** no key on this deployment — the caller composes locally instead */
  | { ok: false; kind: 'unconfigured'; reason: string }
  | { ok: false; kind: 'error'; reason: string; trace?: AiTrace }

/**
 * The brief as writing directives.
 *
 * Sent as instructions about *how* to write, in the same words the settings
 * panel shows — and the system prompt's rule 4 forbids any of it appearing in
 * the copy. That split is the whole fix for "(Written for VC)": the model is
 * told the audience, and told never to name it.
 */
function directivesFrom(brief: GenerationBrief): Record<string, string> {
  return {
    'Write for': labelOf(AUDIENCE_OPTS, brief.audience),
    Objective: labelOf(OBJECTIVE_OPTS, brief.objective),
    'Piece type': labelOf(CONTENT_TYPE_OPTS, brief.contentType),
    Depth: labelOf(DEPTH_OPTS, brief.depth),
    'Evidence style': labelOf(DATA_OPTS, brief.dataIntensity),
    Stance: labelOf(POV_OPTS, brief.pointOfView),
    Tone: labelOf(TONE_OPTS, brief.tone),
    Length: `${labelOf(LENGTH_OPTS, brief.length)} — ${LENGTH_HINT[brief.length]}`,
    Sourcing: labelOf(SOURCING_OPTS, brief.sourcing),
    Confidence: labelOf(CONFIDENCE_OPTS, brief.confidence),
    Market: labelOf(MARKET_OPTS, brief.marketLens),
  }
}

/** Every model-written field, run through the metadata strippers. */
function cleanDraft(raw: Record<string, any>): AiDraft {
  const sections = Array.isArray(raw.article?.sections) ? raw.article.sections : []
  return {
    topic: cleanLine(raw.topic, 40),
    documentSummary: cleanLine(raw.documentSummary, 240),
    keyFacts: (Array.isArray(raw.keyFacts) ? raw.keyFacts : [])
      .map((f: unknown) => cleanLine(typeof f === 'string' ? f : '', 240))
      .filter(Boolean),
    linkedin: {
      headline: cleanLine(raw.linkedin?.headline, 140),
      body: cleanCopy(raw.linkedin?.body),
    },
    email: {
      subject: cleanLine(raw.email?.subject, 140),
      preheader: cleanLine(raw.email?.preheader, 160),
      idea: cleanCopy(raw.email?.idea),
      story: cleanCopy(raw.email?.story),
      takeaway: cleanCopy(raw.email?.takeaway),
      ctaLabel: cleanLine(raw.email?.ctaLabel, 48),
    },
    article: {
      title: cleanLine(raw.article?.title, 160),
      deck: cleanCopy(raw.article?.deck),
      readMinutes: Number(raw.article?.readMinutes) || 0,
      sections: sections
        .map((s: { heading?: string; body?: string }) => ({
          heading: cleanLine(s?.heading, 90) || undefined,
          body: cleanCopy(s?.body),
        }))
        .filter((s: { body: string }) => s.body.length > 0),
    },
  }
}

/** A draft is only usable if the primary channel actually has copy in it. */
function hasCopy(draft: AiDraft): boolean {
  return draft.linkedin.body.trim().length > 0
}

/**
 * The generation call: images + document text + the author's write-up, in one
 * request, and the three channel drafts back.
 */
export async function composeWithAi(input: AiComposeInput): Promise<AiComposeResult> {
  const cfg = await aiConfig()
  if (!cfg.configured) return { ok: false, kind: 'unconfigured', reason: cfg.reason }

  let data: Record<string, unknown>
  try {
    data = await post({
      mode: 'compose',
      instructions: input.instructions,
      directives: directivesFrom(input.brief),
      closingPointer: input.closingPointer,
      documents: input.documents,
      images: input.images,
    })
  } catch (err) {
    const unconfigured = (err as { unconfigured?: boolean }).unconfigured === true
    return {
      ok: false,
      kind: unconfigured ? 'unconfigured' : 'error',
      reason: err instanceof Error ? err.message : 'The model call failed.',
    }
  }

  const trace = data.trace as AiTrace | undefined

  // §7 of the task, and the honest answer: the model read the upload and found
  // nothing to write from. Saying so beats a confident post about nothing.
  if (data.readable === false) {
    return {
      ok: false,
      kind: 'unreadable',
      reason:
        (typeof data.reason === 'string' && data.reason.trim()) ||
        'No readable text or data could be found in the uploaded material.',
      trace,
    }
  }

  const draft = cleanDraft(data as Record<string, any>)
  if (!hasCopy(draft)) {
    return {
      ok: false,
      kind: 'error',
      reason: 'The model returned an empty draft — try regenerating.',
      trace,
    }
  }

  return { ok: true, draft, trace }
}

/* ---- materials → payload ------------------------------------- */

/** A material's own name, used to label it in the prompt. */
function labelOfItem(item: WorkspaceItem): string {
  return item.title?.trim() || item.url || 'material'
}

/**
 * Every picture in a set of materials: uploaded screenshots and images, plus
 * the rendered pages of any scanned PDF.
 *
 * This is the function that decides what physically leaves the browser. If an
 * image is in the workspace and not in this list, it is decoration — which is
 * the bug this whole path was built to remove.
 */
export function imagesFrom(items: WorkspaceItem[], max = 6): AiImage[] {
  const images: AiImage[] = []
  for (const item of items) {
    if (item.imageUrl?.startsWith('data:image/')) {
      images.push({ name: labelOfItem(item), dataUrl: item.imageUrl })
    }
    for (const [i, page] of (item.pageImages ?? []).entries()) {
      if (page?.startsWith('data:image/')) {
        images.push({ name: `${labelOfItem(item)} — page ${i + 1}`, dataUrl: page })
      }
    }
    if (images.length >= max) break
  }
  return images.slice(0, max)
}

/** The text side of the same materials — parsed PDFs, articles, transcriptions. */
export function documentsFrom(items: WorkspaceItem[]): AiDocument[] {
  return items
    .filter((it) => (it.extracted ?? '').trim().length > 0)
    .map((it) => ({
      name: labelOfItem(it),
      text: it.extracted as string,
      ...(it.pages ? { pages: it.pages } : {}),
    }))
}

/** True when a set of materials has something a vision model should look at. */
export function hasImages(items: WorkspaceItem[]): boolean {
  return items.some((it) => !!it.imageUrl || !!it.pageImages?.length)
}
