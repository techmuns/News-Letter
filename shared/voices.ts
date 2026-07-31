/* ============================================================
   The roster — real finance faces the auto-generator listens to.

   Every entry is a real person publishing at a real, public URL.
   `listingUrl` is the page Firecrawl reads to discover their latest
   posts; each discovered post is then deep-read on demand.

   Deliberately NOT LinkedIn: LinkedIn serves an auth wall to every
   crawler and its terms forbid scraping, so a LinkedIn URL here would
   return a login page, not a post. These people publish the same
   thinking on their own sites first — that is what we read.
   ============================================================ */

export type VoiceRegion = 'india' | 'global'

export interface FinanceVoice {
  id: string
  /** the person, not the publication */
  name: string
  /** what they are, in one line — used as the byline */
  role: string
  /** the publication the post lands in */
  outlet: string
  /** page Firecrawl reads to discover recent posts */
  listingUrl: string
  /** only accept discovered links under this prefix (filters nav/ads) */
  urlPrefix: string
  region: VoiceRegion
  /** beats this voice reliably covers — feeds topic matching */
  beats: string[]
  /** initials for the avatar chip */
  initials: string
  /** in the default harvest set */
  enabledByDefault: boolean
  /** true when the site fronts an aggressive bot wall (needs stealth proxy) */
  needsStealth?: boolean
}

export const FINANCE_VOICES: FinanceVoice[] = [
  /* ---- India — the market Munshot's readers actually trade ---- */
  {
    id: 'shenoy',
    name: 'Deepak Shenoy',
    role: 'Founder, Capitalmind',
    outlet: 'Capitalmind',
    listingUrl: 'https://www.capitalmind.in/blog/',
    urlPrefix: 'https://www.capitalmind.in/blog/',
    region: 'india',
    beats: ['indian markets', 'macro', 'portfolio', 'regulation'],
    initials: 'DS',
    enabledByDefault: true,
  },
  {
    id: 'kamath',
    name: 'Nithin Kamath',
    role: 'Founder & CEO, Zerodha',
    outlet: 'Z-Connect',
    listingUrl: 'https://zerodha.com/z-connect/',
    urlPrefix: 'https://zerodha.com/z-connect/',
    region: 'india',
    beats: ['brokerage', 'retail flows', 'regulation', 'market structure'],
    initials: 'NK',
    enabledByDefault: true,
  },
  {
    id: 'mukherjea',
    name: 'Saurabh Mukherjea',
    role: 'Founder, Marcellus Investment Managers',
    outlet: 'Marcellus',
    listingUrl: 'https://marcellus.in/blog/',
    urlPrefix: 'https://marcellus.in/blog/',
    region: 'india',
    beats: ['quality investing', 'indian equities', 'earnings', 'moats'],
    initials: 'SM',
    enabledByDefault: true,
  },
  {
    id: 'shah',
    name: 'Ajay Shah',
    role: 'Economist, The Leap Journal',
    outlet: 'The Leap Journal',
    listingUrl: 'https://blog.theleapjournal.org/',
    urlPrefix: 'https://blog.theleapjournal.org/',
    region: 'india',
    beats: ['policy', 'regulation', 'macro', 'market structure'],
    initials: 'AS',
    enabledByDefault: false,
  },

  /* ---- Global — the voices that set the frame ---- */
  {
    id: 'damodaran',
    name: 'Aswath Damodaran',
    role: 'Professor of Finance, NYU Stern',
    outlet: 'Musings on Markets',
    listingUrl: 'https://aswathdamodaran.blogspot.com/',
    urlPrefix: 'https://aswathdamodaran.blogspot.com/',
    region: 'global',
    beats: ['valuation', 'ipo', 'equity risk premium', 'corporate finance'],
    initials: 'AD',
    enabledByDefault: true,
  },
  {
    id: 'marks',
    name: 'Howard Marks',
    role: 'Co-Chairman, Oaktree Capital',
    outlet: 'Oaktree Memos',
    listingUrl: 'https://www.oaktreecapital.com/insights/memos',
    urlPrefix: 'https://www.oaktreecapital.com/insights/memo',
    region: 'global',
    beats: ['credit', 'cycles', 'risk', 'positioning'],
    initials: 'HM',
    enabledByDefault: true,
  },
  {
    id: 'housel',
    name: 'Morgan Housel',
    role: 'Partner, Collab Fund',
    outlet: 'Collab Fund',
    listingUrl: 'https://collabfund.com/blog/',
    urlPrefix: 'https://collabfund.com/blog/',
    region: 'global',
    beats: ['behaviour', 'risk', 'long-term investing'],
    initials: 'MH',
    enabledByDefault: false,
  },
  {
    id: 'rubinstein',
    name: 'Marc Rubinstein',
    role: 'Writer, Net Interest',
    outlet: 'Net Interest',
    listingUrl: 'https://www.netinterest.co/',
    urlPrefix: 'https://www.netinterest.co/p/',
    region: 'global',
    beats: ['banks', 'insurance', 'financials', 'fintech'],
    initials: 'MR',
    enabledByDefault: true,
  },
  {
    id: 'carlson',
    name: 'Ben Carlson',
    role: 'Director of Institutional AM, Ritholtz Wealth',
    outlet: 'A Wealth of Common Sense',
    listingUrl: 'https://awealthofcommonsense.com/',
    urlPrefix: 'https://awealthofcommonsense.com/20',
    region: 'global',
    beats: ['markets', 'asset allocation', 'behaviour'],
    initials: 'BC',
    enabledByDefault: false,
    needsStealth: true,
  },
  {
    id: 'batnick',
    name: 'Michael Batnick',
    role: 'Managing Partner, Ritholtz Wealth',
    outlet: 'The Irrelevant Investor',
    listingUrl: 'https://theirrelevantinvestor.com/',
    urlPrefix: 'https://theirrelevantinvestor.com/',
    region: 'global',
    beats: ['markets', 'flows', 'behaviour'],
    initials: 'MB',
    enabledByDefault: false,
  },
  {
    id: 'ritholtz',
    name: 'Barry Ritholtz',
    role: 'Chairman, Ritholtz Wealth Management',
    outlet: 'The Big Picture',
    listingUrl: 'https://ritholtz.com/',
    urlPrefix: 'https://ritholtz.com/20',
    region: 'global',
    beats: ['macro', 'markets', 'media'],
    initials: 'BR',
    enabledByDefault: false,
  },
  {
    id: 'asness',
    name: 'Cliff Asness',
    role: 'Founder & CIO, AQR Capital',
    outlet: 'AQR Perspectives',
    listingUrl: 'https://www.aqr.com/Insights/Perspectives',
    urlPrefix: 'https://www.aqr.com/Insights/Perspectives',
    region: 'global',
    beats: ['factors', 'quant', 'valuation', 'market efficiency'],
    initials: 'CA',
    enabledByDefault: false,
  },
  {
    id: 'klement',
    name: 'Joachim Klement',
    role: 'Investment strategist',
    outlet: 'Klement on Investing',
    listingUrl: 'https://klementoninvesting.substack.com/',
    urlPrefix: 'https://klementoninvesting.substack.com/p/',
    region: 'global',
    beats: ['research', 'macro', 'behaviour', 'esg'],
    initials: 'JK',
    enabledByDefault: false,
  },
]

export const VOICES_BY_ID: Record<string, FinanceVoice> = Object.fromEntries(
  FINANCE_VOICES.map((v) => [v.id, v]),
)

export const DEFAULT_VOICE_IDS: string[] = FINANCE_VOICES.filter(
  (v) => v.enabledByDefault,
).map((v) => v.id)

export function voiceById(id: string): FinanceVoice | undefined {
  return VOICES_BY_ID[id]
}
