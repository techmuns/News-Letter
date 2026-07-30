/**
 * Genspark content-generation adapter.
 *
 * UNVERIFIED CONTRACT: Genspark has no publicly documented developer API —
 * access is gated behind enterprise sales and no stable REST spec is
 * published. The endpoint/request/response shape below is a best-effort
 * guess (OpenAI-compatible chat completions, the closest known convention).
 *
 * If your Genspark account's actual API differs, this is the ONLY file that
 * needs to change — `generateDrafts` is the sole entry point callers use.
 */

const GENSPARK_CHAT_URL = 'https://api.genspark.ai/v1/chat/completions'
const GENSPARK_MODEL = 'genspark-default'

export class GensparkError extends Error {}

export interface GeneratedDrafts {
  name: string
  topic: string
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
    sections: { heading?: string; body: string }[]
    ctaTitle: string
    ctaBody: string
    ctaLabel: string
  }
}

const SYSTEM_PROMPT = `You are the content engine for Munshot, an investor-grade financial \
intelligence publisher. Given raw source material, produce a single JSON object (no prose, \
no markdown fences) with exactly this shape:

{
  "name": string,        // short internal campaign name, e.g. "Q3 Repricing Signal"
  "topic": string,       // one-line topic summary
  "linkedin": { "headline": string, "body": string },
  "email": {
    "subject": string, "preheader": string,
    "idea": string, "story": string, "takeaway": string, "ctaLabel": string
  },
  "article": {
    "title": string, "deck": string,
    "sections": [{ "heading": string, "body": string }],
    "ctaTitle": string, "ctaBody": string, "ctaLabel": string
  }
}

Tone: sharp, specific, investor-grade — never generic marketing filler. Ground every claim in \
the supplied source material.`

function extractJson(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  return (fenced ? fenced[1] : text).trim()
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.length > 0
}

function validate(obj: unknown): GeneratedDrafts {
  const d = obj as Partial<GeneratedDrafts> | null
  if (
    !d ||
    !isNonEmptyString(d.name) ||
    !isNonEmptyString(d.topic) ||
    !d.linkedin ||
    !isNonEmptyString(d.linkedin.headline) ||
    !isNonEmptyString(d.linkedin.body) ||
    !d.email ||
    !isNonEmptyString(d.email.subject) ||
    !isNonEmptyString(d.email.story) ||
    !d.article ||
    !isNonEmptyString(d.article.title) ||
    !Array.isArray(d.article.sections) ||
    d.article.sections.length === 0
  ) {
    throw new GensparkError('Genspark response did not match the expected draft shape')
  }
  return d as GeneratedDrafts
}

export async function generateDrafts(sourceText: string, apiKey: string): Promise<GeneratedDrafts> {
  const res = await fetch(GENSPARK_CHAT_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: GENSPARK_MODEL,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: sourceText.slice(0, 20_000) },
      ],
    }),
  })

  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new GensparkError(`Genspark request failed (${res.status}): ${detail.slice(0, 300)}`)
  }

  const json = (await res.json()) as {
    choices?: { message?: { content?: string } }[]
  }
  const content = json.choices?.[0]?.message?.content
  if (!content) throw new GensparkError('Genspark response had no message content')

  let parsed: unknown
  try {
    parsed = JSON.parse(extractJson(content))
  } catch {
    throw new GensparkError('Genspark response was not valid JSON')
  }

  return validate(parsed)
}
