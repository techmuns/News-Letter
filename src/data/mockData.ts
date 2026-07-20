import {
  type Campaign,
  type Promotion,
  type WorkspaceItem,
  type LinkedInContent,
  type EmailContent,
  type ArticleContent,
  type ChannelStatus,
} from '../types'
import { daysAgo, hoursAgo, weekdayIn } from '../lib/date'

/* Team members who drop things into the workspace. */
export const TEAM = ['Neha', 'Arjun', 'Priya', 'Dev'] as const

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

const promo = (id: string) => PROMOTIONS.find((p) => p.id === id)!

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
   Workspace pile — raw ingredients the team dropped in.
   ============================================================ */
export const SEED_ITEMS: WorkspaceItem[] = [
  {
    id: 'item-1',
    type: 'pdf',
    title: 'DRHP Dash — Q3 IPO tracker.pdf',
    preview: '38 live filings · 11 fresh this week · median size ₹1,240 cr',
    addedBy: 'Neha',
    createdAt: hoursAgo(3),
  },
  {
    id: 'item-2',
    type: 'screenshot',
    title: 'Sector heatmap — insurance margins',
    preview: 'Screenshot · health insurers turning amber on loss ratios',
    imageUrl: IMG_INSURANCE,
    addedBy: 'Arjun',
    createdAt: hoursAgo(6),
  },
  {
    id: 'item-3',
    type: 'note',
    title: 'Biggest thing we shipped this month',
    preview:
      'DRHP Dash now diffs successive filings automatically — you see exactly what changed between the draft and the final RHP. Matters for IPO screening because the edits are where the risk hides.',
    addedBy: 'Neha',
    createdAt: hoursAgo(20),
  },
  {
    id: 'item-4',
    type: 'note',
    title: 'Stray thought',
    preview: 'Insurers quietly repricing — worth a Wednesday story?',
    addedBy: 'Priya',
    createdAt: daysAgo(1),
  },
]

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
   Seed campaigns — the master → 3-channel model, in mixed statuses.
   ============================================================ */

const campaignA: Campaign = {
  id: 'camp-ipo-q3',
  name: 'Q3 IPO surge — what the filings signal',
  topic: 'IPO / Primary markets',
  createdAt: hoursAgo(22),
  sourceItemIds: ['item-1', 'item-3'],
  heroImage: IMG_IPO,
  promo: promo('promo-drhp'),
  linkedin: {
    kind: 'linkedin',
    status: 'Ready',
    edited: true,
    content: li({
      headline: 'The Q3 IPO wave is smaller than it looks',
      body:
        'Q3 brought 38 live DRHPs to market — but the headline count is the least interesting part.\n\nRun the filings side by side and a pattern shows up: median issue size fell ~18% while the number of filers rose. Smaller, more frequent raises. That is a different market than the 2024 mega-IPO cycle, and it changes how you screen.\n\nWhat most people miss: the risk isn’t in the draft DRHP — it’s in the diff between the draft and the final RHP. That’s where use-of-proceeds quietly shifts and promoter selling gets sized.\n\nThe Munshot DRHP tracker surfaces those amendments as they land, so the edit shows up before the listing does.',
    }),
  },
  email: {
    kind: 'email',
    status: 'Scheduled',
    edited: false,
    scheduledDate: weekdayIn(0, 0), // Monday — the market insight
    content: {
      subject: 'The Q3 IPO wave is smaller than it looks — here’s where the risk moved',
      from: 'Munshot Intelligence <intel@munshot.io>',
      preheader: '38 filings, but the signal is in the amendments, not the count.',
      idea:
        'Q3 produced 38 live DRHPs, yet median issue size fell ~18% year on year. This is a market of smaller, more frequent raises — not a return of the mega-IPO cycle. Screening built for 2024 will mis-price it.',
      story:
        'Take a mid-market consumer filer from this quarter. The draft DRHP read clean. The final RHP quietly moved ~30% of proceeds from "expansion" to "repayment of borrowings", and disclosed an additional tranche of promoter offer-for-sale. Neither change was flagged in the summary — both were visible only in the diff between the two documents.',
      takeaway:
        'For early-cycle screening, don’t read the DRHP once. Read the delta between successive filings — use-of-proceeds drift and OFS sizing are where the story actually turns.',
      ctaLabel: 'Track Q3 filings in DRHP Dash',
    },
  },
  article: {
    kind: 'article',
    status: 'In Review',
    edited: false,
    content: {
      title: 'The Q3 IPO wave, read from the filings up',
      deck:
        'The count says boom. The documents say something more specific — and more useful for anyone screening the primary market.',
      hero: 'IPO · PRIMARY MARKETS',
      readMinutes: 6,
      sections: [
        {
          body:
            'Thirty-eight live draft red herring prospectuses reached the market in Q3. Reported as a number, it reads like exuberance. Read as documents, it reads like a structural shift in how companies are choosing to raise.',
        },
        {
          heading: 'Smaller, more frequent, more repeat issuers',
          body:
            'Median issue size fell roughly 18% against the prior year even as the count rose. The marginal filer this quarter is not a first-time mega-listing; it is a mid-market company running a tighter, faster raise — often a repeat visitor to the primary market.',
        },
        {
          heading: 'The risk lives in the amendment',
          body:
            'The draft DRHP is a starting position. What matters for screening is how it changes on the way to the final RHP: use-of-proceeds mix, promoter offer-for-sale sizing, and contingent liabilities. These edits rarely make the summary — they surface only when you compare successive versions line by line.',
        },
      ],
      ctaTitle: 'Go deeper with DRHP Dash',
      ctaBody:
        'DRHP Dash diffs successive filings automatically and surfaces amendments as they land — so the edit reaches you before the listing does.',
      ctaLabel: 'Open DRHP Dash',
    },
  },
}

const campaignB: Campaign = {
  id: 'camp-insurance',
  name: 'Health-insurance margin shift most investors missed',
  topic: 'Insurance / Sector',
  createdAt: daysAgo(1),
  sourceItemIds: ['item-2', 'item-4'],
  heroImage: IMG_INSURANCE,
  promo: promo('promo-sector'),
  linkedin: {
    kind: 'linkedin',
    status: 'In Review',
    edited: false,
    content: li({
      reactions: 96,
      comments: 12,
      reposts: 8,
      headline: 'Health insurers look fine — until you read the loss ratios',
      body:
        'Health insurers look fine on premium growth. Look at loss ratios instead.\n\nAcross the listed private health book, claims ratios have drifted up for three straight quarters while premium repricing has lagged. The top line hides it; the margin line doesn’t.\n\nThe question for the next two quarters isn’t growth — it’s whether pricing catches up to claims before it shows up in combined ratio.\n\nSector Pulse flags these margin shifts across the tape as they move, not a quarter later.',
    }),
  },
  email: {
    kind: 'email',
    status: 'Scheduled',
    edited: true,
    scheduledDate: weekdayIn(0, 2), // Wednesday — the story
    content: {
      subject: 'Health insurers: the number that isn’t in the premium line',
      from: 'Munshot Intelligence <intel@munshot.io>',
      preheader: 'Loss ratios have drifted for three quarters. Repricing hasn’t caught up.',
      idea:
        'Premium growth for listed private health insurers still looks strong. Loss ratios tell a different story — up three quarters running, while repricing lags. The margin, not the top line, is where the next surprise sits.',
      story:
        'One large private health insurer grew premiums double digits last quarter and was read as a clean beat. Underneath, its claims ratio expanded ~180 bps and its combined ratio crept toward the high-90s. The growth was real; so was the quiet compression the headline skipped.',
      takeaway:
        'When claims outrun repricing, watch the combined ratio, not the premium line. The re-rating risk shows up there first — usually a quarter before the market reprices it.',
      ctaLabel: 'Watch insurer margins in Sector Pulse',
    },
  },
  article: {
    kind: 'article',
    status: 'Draft',
    edited: false,
    content: {
      title: 'The margin story hiding under health-insurance growth',
      deck: 'Premiums are growing. Claims are growing faster. The gap is the whole trade.',
      hero: 'INSURANCE · SECTOR',
      readMinutes: 5,
      sections: [
        {
          body:
            'Health insurance has been a growth story, and the premium line keeps confirming it. But a growth story and a good margin story are not the same thing, and this quarter the two are starting to separate.',
        },
        {
          heading: 'Claims are outrunning repricing',
          body:
            'Across the listed private health book, loss ratios have moved higher for three consecutive quarters. Repricing exists but lags — it takes renewal cycles to flow through. Until it does, the spread between claims and price compresses the underwriting margin.',
        },
      ],
      ctaTitle: 'Track the shift in Sector Pulse',
      ctaBody:
        'Sector Pulse maps loss-ratio and combined-ratio moves across the insurance book as they happen, so margin shifts are visible before the quarter closes.',
      ctaLabel: 'Explore Sector Pulse',
    },
  },
}

const campaignC: Campaign = {
  id: 'camp-framework',
  name: 'A 3-question filter for early-cycle IPO screening',
  topic: 'Framework / Checklist',
  createdAt: daysAgo(2),
  sourceItemIds: ['item-1'],
  heroImage: IMG_FRAMEWORK,
  promo: promo('promo-diligence'),
  linkedin: {
    kind: 'linkedin',
    status: 'Draft',
    edited: false,
    content: li({
      reactions: 41,
      comments: 5,
      reposts: 3,
      headline: 'Three questions that kill a bad IPO in ten minutes',
      body:
        'A 3-question filter we use before spending real time on any IPO:\n\n1. What moved between the draft DRHP and the final RHP?\n2. How much of the raise is fresh capital vs offer-for-sale?\n3. Does use-of-proceeds match the growth story management is selling?\n\nMost screens die at question 1. That’s the point — it’s the cheapest way to say no.\n\nDiligence OS builds this out from a single filing upload.',
    }),
  },
  email: {
    kind: 'email',
    status: 'Scheduled',
    edited: false,
    scheduledDate: weekdayIn(0, 4), // Friday — the actionable framework
    content: {
      subject: 'A 3-question filter for early-cycle IPO screening',
      from: 'Munshot Intelligence <intel@munshot.io>',
      preheader: 'The cheapest way to say no to an IPO — before you’ve read 300 pages.',
      idea:
        'Most IPO diligence dies for a reason you could have found in the first ten minutes. A short, ordered filter finds that reason before you commit the hours.',
      story:
        'Three questions, in order. One: what changed between the draft DRHP and the final RHP? Two: how much of the raise is fresh capital versus offer-for-sale? Three: does the use of proceeds actually match the growth story management is telling? Screens that survive all three are worth the deep read; most don’t reach question three.',
      takeaway:
        'Run the filter in that order. Question one is the cheapest no you will ever make — and the one most screens skip.',
      ctaLabel: 'Build the filter in Diligence OS',
    },
  },
  article: {
    kind: 'article',
    status: 'Idea',
    edited: false,
    content: {
      title: 'Three questions before you read the prospectus',
      deck: 'A short, ordered filter that kills weak IPO ideas before they cost you a day.',
      hero: 'FRAMEWORK · SCREENING',
      readMinutes: 4,
      sections: [
        {
          body:
            'Diligence is expensive precisely when it is wasted. The point of a screening filter is not to be right about the winners — it is to be cheap about the noes.',
        },
      ],
      ctaTitle: 'Operationalise it with Diligence OS',
      ctaBody:
        'Diligence OS turns a single filing upload into a structured workspace that runs this filter for you — the diff, the raise mix, and the use-of-proceeds check, side by side.',
      ctaLabel: 'See Diligence OS',
    },
  },
}

export const SEED_CAMPAIGNS: Campaign[] = [campaignA, campaignB, campaignC]

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
