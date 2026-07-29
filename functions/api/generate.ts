/* ============================================================
   POST /api/generate — Cloudflare Pages Function

   Takes the raw material selected in the Workspace (notes, PDFs,
   screenshots) and returns one campaign drafted across three channels.

   The OpenAI key is read from the Pages environment and never reaches
   the browser. The browser only ever talks to this endpoint.
   ============================================================ */

interface Env {
  /** Required. Set as a Pages secret — never commit it. */
  OPENAI_API_KEY: string
  /** Optional override. Defaults to DEFAULT_MODEL below. */
  OPENAI_MODEL?: string
}

interface PagesContext {
  request: Request
  env: Env
}

/** `gpt-5.6` aliases the Sol tier. Override with OPENAI_MODEL to change cost/latency. */
const DEFAULT_MODEL = 'gpt-5.6'

const OPENAI_ENDPOINT = 'https://api.openai.com/v1/responses'

/** Upstream accepts at most 50 MB of files per request; stay well inside it. */
const MAX_TOTAL_BASE64 = 32 * 1024 * 1024
const ALLOWED_MEDIA = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
])

type IncomingItem =
  | { kind: 'note'; title: string; text: string }
  | { kind: 'file'; title: string; filename: string; mediaType: string; data: string }

interface IncomingBody {
  items: IncomingItem[]
  promotions: { id: string; name: string; benefit: string; ctaLabel: string }[]
}

/* ---- Output contract ---------------------------------------------------
   Structured Outputs rules: every object needs additionalProperties:false,
   every property must appear in `required`, and optional fields are
   expressed as a nullable union rather than by omission.
   ---------------------------------------------------------------------- */
const DRAFT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['name', 'topic', 'promoId', 'linkedin', 'email', 'article'],
  properties: {
    name: {
      type: 'string',
      description: 'Short internal campaign name — the angle in under 12 words.',
    },
    topic: {
      type: 'string',
      description: 'Short category label, e.g. "IPO / Primary markets".',
    },
    promoId: {
      type: ['string', 'null'],
      description:
        'id of the single most relevant promotion, or null when none genuinely fits. Never force one.',
    },
    linkedin: {
      type: 'object',
      additionalProperties: false,
      required: ['headline', 'body'],
      properties: {
        headline: {
          type: 'string',
          description: 'Catchy phrase for the branded graphic. Under 60 characters.',
        },
        body: {
          type: 'string',
          description:
            'The post itself. Short paragraphs separated by blank lines. No hashtags, no emoji.',
        },
      },
    },
    email: {
      type: 'object',
      additionalProperties: false,
      required: ['subject', 'preheader', 'idea', 'story', 'takeaway', 'ctaLabel'],
      properties: {
        subject: { type: 'string' },
        preheader: { type: 'string', description: 'One line, under 90 characters.' },
        idea: { type: 'string', description: 'The insight, in 2-3 sentences.' },
        story: { type: 'string', description: 'The concrete example that carries it.' },
        takeaway: { type: 'string', description: 'What the reader should do or watch.' },
        ctaLabel: { type: 'string' },
      },
    },
    article: {
      type: 'object',
      additionalProperties: false,
      required: [
        'title',
        'deck',
        'hero',
        'readMinutes',
        'sections',
        'ctaTitle',
        'ctaBody',
        'ctaLabel',
      ],
      properties: {
        title: { type: 'string' },
        deck: { type: 'string', description: 'Standfirst — one or two sentences.' },
        hero: {
          type: 'string',
          description: 'Uppercase kicker with a middot, e.g. "IPO · PRIMARY MARKETS".',
        },
        readMinutes: { type: 'integer', description: 'Honest estimate, 3 to 12.' },
        sections: {
          type: 'array',
          description: 'Two to five sections. The first usually has a null heading.',
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['heading', 'body'],
            properties: {
              heading: { type: ['string', 'null'] },
              body: { type: 'string' },
            },
          },
        },
        ctaTitle: { type: 'string' },
        ctaBody: { type: 'string' },
        ctaLabel: { type: 'string' },
      },
    },
  },
} as const

const SYSTEM_PROMPT = `You write investor-grade content for Munshot, a financial intelligence company serving institutional investors.

You are given raw material a team member dropped into a shared workspace: research PDFs, dashboard screenshots, and short notes. Turn it into ONE campaign expressed across three channels that share a single argument but are written natively for their medium:

- LinkedIn — a short in-feed post. Opens with the claim, not a preamble. Short paragraphs. No hashtags, no emoji, no "thoughts?" sign-off.
- Email — a weekly newsletter entry with a clear idea, one concrete story, and a takeaway the reader can act on.
- Article — a longer piece that develops the same argument with room for detail.

Rules that matter more than style:

1. GROUND EVERYTHING IN THE SUPPLIED MATERIAL. Every figure, percentage, company, date and claim must come from what you were given. If the material does not contain a number, do not produce one. Write the qualitative point instead.
2. Never invent engagement metrics, sources, quotes, or named companies that are absent from the material.
3. If the material is thin, write something shorter and more general rather than padding it with invented specifics.
4. Attach a promotion only when it genuinely follows from the content. Returning null for promoId is the correct answer more often than not.
5. Write plainly. No hype, no "in today's fast-moving markets", no rhetorical questions as openers.

The audience is professional investors. Assume they know the vocabulary and skip the primer.`

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  })
}

function fail(message: string, status: number): Response {
  return json({ ok: false, error: message }, status)
}

/** Pulls the assistant's text out of a Responses API payload. */
function extractText(payload: {
  output?: { type?: string; content?: { type?: string; text?: string; refusal?: string }[] }[]
}): { text?: string; refusal?: string } {
  for (const item of payload.output ?? []) {
    if (item.type !== 'message') continue
    for (const part of item.content ?? []) {
      if (part.type === 'refusal' && part.refusal) return { refusal: part.refusal }
      if (part.type === 'output_text' && part.text) return { text: part.text }
    }
  }
  return {}
}

export async function onRequestPost(context: PagesContext): Promise<Response> {
  const { request, env } = context

  if (!env.OPENAI_API_KEY) {
    return fail(
      'The server is missing OPENAI_API_KEY. Add it as a Pages secret (Settings → Variables and Secrets) and redeploy.',
      500,
    )
  }

  let body: IncomingBody
  try {
    body = (await request.json()) as IncomingBody
  } catch {
    return fail('Could not read the request body.', 400)
  }

  const items = Array.isArray(body.items) ? body.items : []
  if (items.length === 0) {
    return fail('Select at least one item before generating.', 400)
  }

  // Build the user content: text parts first, then files, so the model reads
  // the framing before the attachments.
  const textLines: string[] = []
  const fileParts: Record<string, unknown>[] = []
  let totalBase64 = 0

  for (const item of items) {
    if (item.kind === 'note') {
      textLines.push(`--- NOTE: ${item.title} ---\n${item.text}`)
      continue
    }

    if (!ALLOWED_MEDIA.has(item.mediaType)) {
      textLines.push(
        `--- FILE (not readable, listed for context only): ${item.filename} (${item.mediaType}) ---`,
      )
      continue
    }

    totalBase64 += item.data.length
    if (totalBase64 > MAX_TOTAL_BASE64) {
      return fail(
        'That selection is too large to send in one request. Select fewer or smaller files.',
        413,
      )
    }

    if (item.mediaType === 'application/pdf') {
      fileParts.push({
        type: 'input_file',
        filename: item.filename,
        file_data: `data:${item.mediaType};base64,${item.data}`,
      })
    } else {
      fileParts.push({
        type: 'input_image',
        image_url: `data:${item.mediaType};base64,${item.data}`,
      })
    }
  }

  const promoList = (body.promotions ?? [])
    .map((p) => `- ${p.id}: ${p.name} — ${p.benefit}`)
    .join('\n')

  const framing = [
    'Here is the raw material. Draft one campaign across all three channels.',
    textLines.length ? `\n${textLines.join('\n\n')}` : '',
    fileParts.length
      ? `\n${fileParts.length} file(s) are attached below. Read them for the substance — figures, names and dates must come from them.`
      : '',
    promoList
      ? `\nPromotions available (pick at most one, or null if none genuinely fits):\n${promoList}`
      : '\nNo promotions are configured. Return null for promoId.',
  ]
    .filter(Boolean)
    .join('\n')

  const upstream = {
    model: env.OPENAI_MODEL || DEFAULT_MODEL,
    instructions: SYSTEM_PROMPT,
    input: [
      {
        role: 'user',
        content: [{ type: 'input_text', text: framing }, ...fileParts],
      },
    ],
    text: {
      format: {
        type: 'json_schema',
        name: 'campaign_draft',
        schema: DRAFT_SCHEMA,
        strict: true,
      },
    },
    max_output_tokens: 16000,
  }

  let res: Response
  try {
    res = await fetch(OPENAI_ENDPOINT, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${env.OPENAI_API_KEY}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(upstream),
    })
  } catch {
    return fail('Could not reach the OpenAI API. Check the network and try again.', 502)
  }

  if (!res.ok) {
    const detail = await res.text()
    let message = `The model API returned ${res.status}.`
    try {
      const parsed = JSON.parse(detail) as { error?: { message?: string } }
      if (parsed.error?.message) message = parsed.error.message
    } catch {
      /* keep the generic message */
    }
    // 401/403 almost always means the key, so say so plainly.
    if (res.status === 401 || res.status === 403) {
      message = `The OpenAI API rejected the key (${res.status}). Check OPENAI_API_KEY.`
    }
    return fail(message, 502)
  }

  const payload = (await res.json()) as {
    status?: string
    incomplete_details?: { reason?: string }
    output?: { type?: string; content?: { type?: string; text?: string; refusal?: string }[] }[]
  }

  const { text, refusal } = extractText(payload)

  if (refusal) {
    return fail(`The model declined to draft this material: ${refusal}`, 422)
  }

  if (payload.status === 'incomplete') {
    return fail(
      `The draft was cut off (${payload.incomplete_details?.reason ?? 'unknown reason'}). Try fewer source items.`,
      502,
    )
  }

  if (!text) {
    return fail('The model returned an empty response.', 502)
  }

  try {
    return json({ ok: true, draft: JSON.parse(text) })
  } catch {
    return fail('The model returned malformed JSON.', 502)
  }
}
