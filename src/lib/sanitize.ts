/* ============================================================
   Cleaning model output down to publishable copy.

   A model asked to write "for VC investors, analytical, 90/10"
   will, often enough, hand back the assignment along with the
   work: "(Written for VC)", "Target Audience: PE investors",
   "Headline:" in front of the headline, "[insert figure]" where
   a number was wanted. None of it is content. All of it is the
   first thing an author would delete.

   The prompt forbids every one of these (see functions/api/
   generate.js). This is the second line: what the prompt asks
   for, this enforces, so a bad generation degrades into slightly
   shorter copy rather than into a post with a label in it.

   Applies to MODEL OUTPUT ONLY. The deterministic composer uses
   bracketed gaps on purpose — "[the mechanism that explains it]"
   is the playbook refusing to invent a figure and asking the
   author for it — and running this over that output would erase
   exactly the prompts it means to leave behind.
   ============================================================ */

/**
 * Words that mark a line as the brief rather than the piece.
 *
 * The line goes with them: "Target Audience: PE investors" has no content in it
 * to save — the value is the setting, and the setting is not the post.
 */
const BRIEF_KEY =
  '(?:written|created|drafted|composed|generated|tailored|optimi[sz]ed)\\s+for' +
  '|target\\s+audience|audience|reader|persona' +
  '|tone|tonality|voice|register|style' +
  '|objective|goal|purpose|intent' +
  '|content\\s+type|format|structure|pattern|template' +
  '|length|word\\s+count|words|reading\\s+time' +
  '|pillar|depth|point\\s+of\\s+view|pov|market\\s+lens' +
  '|sourcing|compliance|confidence|data\\s+intensity' +
  '|channel|platform|post\\s+type' +
  '|note\\s+to\\s+(?:the\\s+)?editor|editor.?s\\s+note|internal\\s+note' +
  '|meta|metadata|brief|prompt|instructions?|disclaimer'

/**
 * Words that name the field the text already is — "Headline: Margins are
 * compressing".
 *
 * Only the label is dropped here. Deleting the line would delete the headline
 * along with the word in front of it, which is a worse outcome than the label.
 */
const FIELD_KEY =
  'headline|title|subject(?:\\s+line)?|preheader|deck|standfirst' +
  '|body|copy|post|caption|hook|lead|opening' +
  '|cta|call\\s+to\\s+action|takeaway|idea|story|section'

/** A whole line that is just a setting and its value. */
const LABEL_LINE = new RegExp(
  `^[ \\t]*(?:[*_#>\\-\\u2022]+[ \\t]*)?\\**(?:${BRIEF_KEY})\\**[ \\t]*[:\\-–—][ \\t]*.*$`,
  'gim',
)

/** A field label sitting in front of its own value — the label goes, the value stays. */
const FIELD_LABEL = new RegExp(
  `^[ \\t]*(?:[*_#>\\-\\u2022]+[ \\t]*)?\\**(?:${FIELD_KEY})\\**[ \\t]*:[ \\t]*`,
  'gim',
)

/** A bracketed or parenthesised aside about the assignment — "(Written for VC)". */
const META_ASIDE = new RegExp(`[([{][ \\t]*(?:${BRIEF_KEY})\\b[^)\\]}]{0,120}[)\\]}]`, 'gi')

/**
 * Anything in square brackets.
 *
 * Blanket, unlike parentheses: a square bracket in this copy is always either a
 * placeholder the model was told not to write ("[insert figure]", "[TBD]",
 * "[X%]") or a label. A parenthetical, by contrast, is usually a fact — "(FY25)",
 * "(₹3,591 crore)" — so only the meta ones above are removed and the rest stay.
 */
const SQUARE_BRACKETS = /\[[^\]\n]*\]/g

/** Markdown the channels don't render — LinkedIn shows the asterisks literally. */
function stripMarkdown(text: string): string {
  return text
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/\*\*([^*\n]+)\*\*/g, '$1')
    .replace(/__([^_\n]+)__/g, '$1')
    .replace(/(^|\s)\*([^*\n]+)\*(?=\s|$)/g, '$1$2')
    .replace(/`{1,3}([^`\n]+)`{1,3}/g, '$1')
}

/** Whitespace left behind once a label or an aside has been cut out. */
function tidy(text: string): string {
  return text
    .replace(/[ \t]+([),.;:!?])/g, '$1')
    .replace(/\(\s*\)/g, '')
    .replace(/[ \t]{2,}/g, ' ')
    .split('\n')
    .map((line) => line.replace(/[ \t]+$/, ''))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/**
 * Publication-ready copy out of one model-written field.
 *
 * Order matters. Whole setting-lines go first, so "Tone: analytical" loses the
 * line rather than becoming a stray "analytical"; the field labels are stripped
 * after, so "Headline: Margins are compressing" keeps its headline.
 */
export function cleanCopy(raw: string | undefined | null): string {
  if (!raw) return ''
  return tidy(
    stripMarkdown(String(raw))
      .replace(LABEL_LINE, '')
      .replace(FIELD_LABEL, '')
      .replace(META_ASIDE, '')
      .replace(SQUARE_BRACKETS, ''),
  )
}

/**
 * A one-line field — a headline, a subject, a CTA label.
 *
 * Same cleaning, then flattened: a headline that arrives with a stray second
 * line is a headline plus something that isn't one.
 */
export function cleanLine(raw: string | undefined | null, max = 200): string {
  const cleaned = cleanCopy(raw)
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)[0]
  if (!cleaned) return ''
  // Models like to quote a title back. The quotes aren't part of it.
  const unquoted = cleaned.replace(/^["'“‘]+|["'”’]+$/g, '').trim()
  return unquoted.length > max ? `${unquoted.slice(0, max - 1).trimEnd()}…` : unquoted
}

/**
 * True when a field still carries something that reads as metadata.
 *
 * Used after cleaning, as the check on the check — if this ever fires, the
 * prompt and the patterns above have both missed something, and the draft is
 * better refused than published with a label in it.
 */
export function looksLikeMeta(text: string): boolean {
  // Fresh, non-global copies: `test` on a /g regex carries lastIndex between
  // calls, so the same string would answer differently on alternate calls.
  const labelLine = new RegExp(LABEL_LINE.source, 'im')
  const aside = new RegExp(META_ASIDE.source, 'i')
  return labelLine.test(text) || aside.test(text) || /\[[^\]\n]*\]/.test(text)
}
