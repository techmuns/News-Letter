import { type Depth, type Objective, type Persona, type Tone } from '../types'

/* ============================================================
   Voice — the half of the brief that shapes how a post reads
   rather than how it is structured.

   The playbook (§5) decides the skeleton; this decides the
   register it is written in, who it is addressed to, how much
   evidence it carries and what it closes on. Every setting in
   Content Settings lands here, so changing one visibly rewrites
   the write-up instead of only re-labelling it.

   The one rule these all obey: the brief is never restated
   inside the copy. "Written for buy-side analysts, analytical in
   tone" is a settings readout, not a post — so tone changes the
   sentences, and audience changes what the post asks about,
   neither announces itself.
   ============================================================ */

/* ---- Tone: the register ------------------------------------- */

export interface Voice {
  /** the tone's own opening line, for drafts with no pattern hook */
  opener: string
  /** wraps the pattern's hook — same claim, different register */
  lead: (hook: string) => string
  /** the line that hands the post over to its evidence */
  handoff: string
}

export const VOICE: Record<Tone, Voice> = {
  academic: {
    opener: 'Consider the mechanism underneath the headline.',
    lead: (hook) => `Consider the mechanism underneath the headline. ${hook}`,
    handoff: 'The evidence base, as recorded:',
  },
  authoritative: {
    opener: 'Here is what the filings actually say.',
    lead: (hook) => `${hook} That is what the filings say, and it is all this rests on.`,
    handoff: 'Straight from the source:',
  },
  analytical: {
    opener: 'Line the data up and a pattern shows up.',
    lead: (hook) => `${hook} Line the data up and the pattern is hard to miss.`,
    handoff: 'The evidence, in order:',
  },
  provocative: {
    opener: 'Most people are reading this exactly backwards.',
    lead: (hook) => `Most people are reading this exactly backwards. ${hook}`,
    handoff: 'Here is what is actually on the page:',
  },
  conversational: {
    opener: "A quick thing that's been on my mind:",
    lead: (hook) => `A quick thing that's been on my mind. ${hook}`,
    handoff: 'What I found:',
  },
}

/* ---- Audience: what the reader has at stake ----------------- */

/**
 * Every reader answers a different question with the same evidence: a PM sizes
 * a book, an allocator defends a mandate. The pattern skeletons write that
 * question as a `{stake}` token, and the audience fills it in — which is how
 * the audience setting reaches the copy without ever being named in it.
 */
const STAKE: Record<Persona, string> = {
  all: 'the decision',
  'public-markets': 'the position',
  'private-markets': 'the deal',
  allocators: 'the mandate',
}

const STAKE_TOKEN = /\{stake\}/g

/** Resolves the `{stake}` token in a skeleton line for a given reader. */
export function forReader(text: string, audience: Persona): string {
  return text.replace(STAKE_TOKEN, STAKE[audience])
}

/* ---- Depth: how much evidence the post carries -------------- */

/**
 * Depth is an evidence budget, not an adjective. A surface post quotes two
 * lines; a technical one quotes eight and says so in its own hook, because the
 * count the hook states and the list the body prints come from this number.
 */
export const EVIDENCE_BUDGET: Record<Depth, number> = {
  surface: 2,
  standard: 4,
  deep: 6,
  technical: 8,
}

/** Paragraphs a template draft gains or loses for its depth. */
export const DEPTH_PARAS: Record<Depth, number> = {
  surface: -1,
  standard: 0,
  deep: 1,
  technical: 2,
}

/* ---- Objective: the move the post closes on ----------------- */

/**
 * The last thing asked of the author, before any product pointer. A post
 * written to drive engagement ends on a question; one written to build
 * authority ends on a conclusion. Same evidence, different exit.
 */
export const CLOSING_ASK: Record<Objective, string> = {
  authority: '[the conclusion this evidence supports — stated plainly, one line]',
  educate: '[the takeaway a reader should be able to repeat tomorrow — one line]',
  engagement: '[the question to put back to the reader — one line, genuinely open]',
  nurture: '[what to watch next, and what would change this read]',
  category: '[what this says about where the industry is heading — one line]',
}

/** The heading that close becomes when the post is laid out as an article. */
export const CLOSING_HEAD: Record<Objective, string> = {
  authority: 'The conclusion',
  educate: 'The takeaway',
  engagement: 'Over to you',
  nurture: 'What to watch next',
  category: 'Where this is heading',
}
