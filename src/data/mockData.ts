import {
  type Campaign,
  type Promotion,
  type WorkspaceItem,
  type LinkedInContent,
  type EmailContent,
  type ArticleContent,
  type ChannelStatus,
} from '../types'
/* ============================================================
   Promotion library — Munshot "things to promote".
   Each attaches to a campaign only when relevant, and shows up as
   a quiet pointer (name + one-line investor benefit + CTA).
   ============================================================ */
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

/* Lightweight inline SVG "chart" placeholders so the picture flow is visible
   without real uploads. Returns a data URL. */
function chartImg(c1: string, c2: string): string {
  const bars = Array.from({ length: 9 }, (_, i) => {
    const h = 50 + ((i * 53) % 200)
    const op = (0.28 + (i % 3) * 0.14).toFixed(2)
    return `<rect x='${56 + i * 82}' y='${360 - h}' width='46' height='${h}' rx='7' fill='#ffffff' opacity='${op}'/>`
  }).join('')
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' width='800' height='450'>` +
    `<defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>` +
    `<stop offset='0' stop-color='${c1}'/><stop offset='1' stop-color='${c2}'/></linearGradient></defs>` +
    `<rect width='800' height='450' fill='url(#g)'/>${bars}` +
    `</svg>`
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

export const IMG_IPO = chartImg('#5b46b8', '#9d8cf5')
export const IMG_INSURANCE = chartImg('#2f7d5b', '#47d6a1')
export const IMG_FRAMEWORK = chartImg('#7d5bb8', '#c9a3f5')

/* ============================================================
   Workspace materials — empty by default. Everything in the list is
   something the user actually added.
   ============================================================ */
export const SEED_ITEMS: WorkspaceItem[] = []

/* ============================================================
   Channel content builders (kept terse but real-sounding).
   ============================================================ */
const li = (c: Partial<LinkedInContent> & { body: string; headline: string }): LinkedInContent => ({
  authorName: 'Munshot',
  authorHandle: 'Intelligence for institutional investors',
  authorAvatar: 'M',
  reactions: 0,
  comments: 0,
  reposts: 0,
  ...c,
})

/* ============================================================
   Campaigns — empty by default. Content appears only once generated.
   ============================================================ */
export const SEED_CAMPAIGNS: Campaign[] = []

/* ============================================================
   Generatable templates — the mocked "Turn into content" action
   spawns one of these (pre-written) as a fresh Draft campaign.
   ============================================================ */
interface GeneratableTemplate {
  name: string
  topic: string
  promoId: string
  heroImage: string
  linkedin: LinkedInContent
  email: EmailContent
  article: ArticleContent
}

export const GENERATABLE: GeneratableTemplate[] = [
  {
    name: 'Insurers are quietly repricing — the signal in the filings',
    topic: 'Insurance / Sector',
    promoId: 'promo-sector',
    heroImage: IMG_INSURANCE,
    linkedin: li({
      headline: 'Insurers are repricing in plain sight',
      body:
        'Repricing shows up in the fine print before it shows up in the P&L.\n\nAcross the health book, renewal-rate disclosures are moving up while combined ratios are still catching down. The market is treating this as a growth story; the filings read like a margin-repair story.\n\nSector Pulse tracks the repricing as it flows through the book.',
    }),
    email: {
      subject: 'Insurers are repricing — the filings say so before the P&L does',
      from: 'Munshot Intelligence <intel@munshot.io>',
      preheader: 'Renewal-rate disclosures are moving. The margin line hasn’t caught up yet.',
      idea:
        'Repricing is visible in disclosure before it is visible in earnings. Right now the health book is showing higher renewal rates while combined ratios still lag — a margin-repair setup the growth narrative is skipping.',
      story:
        'A large private insurer’s latest filing lifted disclosed renewal pricing across two key products, even as its combined ratio sat in the high-90s. The pricing action is the leading signal; the margin recovery is the lagging one that follows it.',
      takeaway:
        'Read the renewal-rate disclosures, not just the headline growth. Pricing action today is next year’s margin line.',
      ctaLabel: 'Track repricing in Sector Pulse',
    },
    article: {
      title: 'Repricing shows up in the filings first',
      deck: 'Disclosure leads earnings. The health book is repricing in plain sight.',
      hero: 'INSURANCE · SECTOR',
      readMinutes: 5,
      sections: [
        {
          body:
            'Earnings tell you what a margin did. Disclosure tells you what it is about to do. In insurance, the gap between the two is renewal pricing — and it is moving.',
        },
        {
          heading: 'The leading signal',
          body:
            'Higher disclosed renewal rates precede combined-ratio repair by several quarters. Reading them early is the difference between owning the re-rate and chasing it.',
        },
      ],
      ctaTitle: 'Follow the repricing in Sector Pulse',
      ctaBody:
        'Sector Pulse tracks renewal and margin disclosures across the insurance book as they land.',
      ctaLabel: 'Explore Sector Pulse',
    },
  },
  {
    name: 'What Q3 DRHP filings reveal about the IPO pipeline',
    topic: 'IPO / Primary markets',
    promoId: 'promo-drhp',
    heroImage: IMG_IPO,
    linkedin: li({
      headline: 'The IPO pipeline is changing shape, not just size',
      body:
        'The IPO pipeline isn’t just "busy" — it’s changing shape.\n\nQ3 DRHPs skew smaller and more repeat-issuer than a year ago. That tells you something about how companies read the current window: raise less, raise more often, keep optionality.\n\nDRHP Dash surfaces the filings and their amendments as they hit.',
    }),
    email: {
      subject: 'What Q3 filings say about the shape of the IPO pipeline',
      from: 'Munshot Intelligence <intel@munshot.io>',
      preheader: 'Smaller raises, more repeat issuers — the window is being read differently.',
      idea:
        'The pipeline is not just full, it is differently shaped. Q3 DRHPs skew smaller and toward repeat issuers — a signal about how companies are reading the current raising window.',
      story:
        'Line up this quarter’s filings against last year’s and the median shrinks while the count climbs. Fewer debut mega-listings, more tightly-sized raises from companies that have tapped the market before and know how to move quickly.',
      takeaway:
        'Size and issuer-type are signal, not trivia. A pipeline of smaller, repeat raises prices and behaves differently from a mega-IPO cycle.',
      ctaLabel: 'Track the pipeline in DRHP Dash',
    },
    article: {
      title: 'The shape of the Q3 IPO pipeline',
      deck: 'It is not the count that changed — it is the size and the issuer mix.',
      hero: 'IPO · PRIMARY MARKETS',
      readMinutes: 5,
      sections: [
        {
          body:
            'A busy pipeline is easy to report. A changing pipeline is more useful to understand — and Q3’s filings changed shape in two measurable ways.',
        },
        {
          heading: 'Smaller and more repeat',
          body:
            'Median issue size fell while the count rose, and a larger share of filers are companies returning to the market. That combination reads as caution plus fluency — raise less, raise often.',
        },
      ],
      ctaTitle: 'Watch the pipeline with DRHP Dash',
      ctaBody:
        'DRHP Dash surfaces new filings and their amendments as they land, so pipeline shifts are visible in real time.',
      ctaLabel: 'Open DRHP Dash',
    },
  },
]

/* Draft statuses for a freshly generated campaign — all start at Draft. */
export const FRESH_STATUS: ChannelStatus = 'Draft'
