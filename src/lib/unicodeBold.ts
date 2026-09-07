/* LinkedIn captions are plain text with no real bold, so "bold" here means
   swapping letters for their Unicode sans-serif bold code points (𝗹𝗶𝗸𝗲 𝘁𝗵𝗶𝘀).
   Widely used on LinkedIn; note screen readers announce it oddly. */

function buildBoldMaps() {
  const fwd = new Map<string, string>()
  const rev = new Map<string, string>()
  const add = (from: number, to: number, base: number) => {
    for (let c = from; c <= to; c++) {
      const plain = String.fromCharCode(c)
      const bold = String.fromCodePoint(base + (c - from))
      fwd.set(plain, bold)
      rev.set(bold, plain)
    }
  }
  add(65, 90, 0x1d5d4) // A-Z → 𝗔-𝗭
  add(97, 122, 0x1d5ee) // a-z → 𝗮-𝘇
  add(48, 57, 0x1d7ec) // 0-9 → 𝟬-𝟵
  return { fwd, rev }
}
const { fwd: BOLD_FWD, rev: BOLD_REV } = buildBoldMaps()

export function toBold(s: string): string {
  return Array.from(s)
    .map((ch) => BOLD_FWD.get(ch) ?? ch)
    .join('')
}

export function toPlain(s: string): string {
  return Array.from(s)
    .map((ch) => BOLD_REV.get(ch) ?? ch)
    .join('')
}

/* ---- Auto-bold: bold the "lead" of each line (the topic word / index name),
   matching how a market post reads — 𝗦𝗲𝗻𝘀𝗲𝘅 closed…, 𝗔𝘂𝘁𝗼 𝘀𝘁𝗼𝗰𝗸𝘀 led… ---- */

const LEAD_STOP = /[—–,:;]/
const FIN_VERB =
  /\b(closed?|fell|rose|drops?|dropped|slips?|slipped|jumps?|jumped|climbs?|climbed|led|gains?|gained|lost|slid|ends?|ended|settled?|tumbled?|surged?|rallied|sank|sinks?|plunged?|advanced?|declined?|rises?|edged|weakened?|strengthened?)\b/i

/** Bold the opening phrase of one caption line — up to the first delimiter or
    finance verb, else the first two words. Blank lines and the hashtag line are
    left alone. Idempotent (un-bolds first, so re-running doesn't grow it). */
export function autoBoldLead(line: string): string {
  const plain = toPlain(line)
  if (!plain.trim() || plain.trim().startsWith('#')) return plain
  const m = plain.match(/^(\s*(?:[•\-*]\s*)?(?:\p{Extended_Pictographic}️?\s*)*)(.*)$/u)
  const prefix = m?.[1] ?? ''
  const rest = m?.[2] ?? plain
  if (!rest.trim()) return plain

  let cut = -1
  const delim = rest.search(LEAD_STOP)
  if (delim > 0) cut = delim
  const verb = rest.search(FIN_VERB)
  if (verb > 0) cut = cut < 0 ? verb : Math.min(cut, verb)
  // No natural stop (or it's very far off) → just bold the first two words.
  if (cut < 0 || cut > 30) {
    const firstTwo = rest.match(/^\s*\S+(?:\s+\S+)?/)
    cut = firstTwo ? firstTwo[0].length : Math.min(rest.length, 20)
  }
  const lead = rest.slice(0, cut).replace(/\s+$/, '')
  const after = rest.slice(lead.length)
  return prefix + toBold(lead) + after
}

/** Bold the lead of every line in a caption body. */
export function autoBoldBody(body: string): string {
  return body.split('\n').map(autoBoldLead).join('\n')
}
