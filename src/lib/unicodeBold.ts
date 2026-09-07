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
