# Munshot Content Engine — The Pre-Generation Filter System

> **The thesis.** A simple AI writing tool takes a topic and returns prose. An
> **enterprise content engine** takes a *structured brief* — audience, objective, depth,
> tone, guardrails — and returns an asset that is on-brand, on-strategy, compliant, and
> auditable *by construction*. The filters below are that brief. They are the difference
> between "generate a LinkedIn post about IPOs" and a Bloomberg-grade note calibrated to a
> named reader, a business objective, and a governance policy.

Filters do three jobs at once:

1. **Specify intent** — who this is for and why it exists.
2. **Shape the output** — depth, tone, structure, length, and the insight/promotion balance.
3. **Enforce governance** — compliance, sourcing, confidence, and brand, *before* a human ever reviews it.

Every filter here answers three questions: **why it exists**, **what options it offers**,
and **how it shapes the generated content** (the actual mechanism). The last part matters
most — a filter that doesn't change the machinery is just decoration.

---

## How filters become output — the engine's five layers

A brief doesn't just get pasted into a prompt. Each filter routes to one or more of five
mechanisms, which is what makes this an engine rather than a text box:

| Layer | What it controls | Example filters that drive it |
|-------|------------------|-------------------------------|
| **1 · Instruction** | System-prompt directives (voice, stance, do/don't) | Tone, POV, Confidence, Objective |
| **2 · Retrieval** | Which sources the agent may pull from, and how much | Sourcing Rigor, Market Lens, Data Recency, Entity policy |
| **3 · Structure** | The rhetorical template the draft is poured into | Content Type, Narrative Structure, Channel |
| **4 · Budget** | Hard limits on length, section count, claim count | Length/Reading Time, Depth, Data Intensity |
| **5 · Validation** | Post-generation lint that can block or flag the draft | Compliance, Sourcing, Insight/Promotion, Brand Lock |

A single draft therefore passes through: **brief → retrieval scope → structural template →
generation under budget → validation gate → (optional) human review**. The filters
configure every step, and the whole brief is stored with the asset for provenance.

---

## Group A · Strategic intent — *the brief*

### A1 · Target Audience (persona)
- **Why it exists.** The same insight lands differently for a quant PM, a VC associate, and
  a family-office allocator. Persona is the single highest-leverage input; everything
  downstream calibrates to it.
- **Options.** `Hedge-fund PM` · `Buy-side analyst` · `Sell-side analyst` · `PE investor` ·
  `VC investor` · `Allocator / LP` · `CIO / Head of Research` · `Retail-sophisticated` ·
  `Founder / IR` *(custom personas savable per client)*.
- **How it shapes generation.** Selects the vocabulary set, the assumed prior knowledge, the
  reference points (a VC hears "cohort economics," a credit PM hears "covenant headroom"),
  and the *proof style* that persona trusts (data for quants, frameworks for consultants,
  case studies for generalists). Drives retrieval toward that persona's canonical sources.

### A2 · Audience Sophistication
- **Why it exists.** Seniority is orthogonal to role. A CIO wants the "so what" in the first
  line; an associate wants the mechanism explained. Getting this wrong reads as either
  condescending or impenetrable.
- **Options.** `Primer` (explain the concept) · `Practitioner` (assume fluency, add nuance) ·
  `Expert` (technical, no hand-holding, edge-case aware).
- **How it shapes generation.** Sets how much is *explained* vs *assumed*, the ratio of
  definition to insight, and whether the piece leads with the conclusion (expert) or builds
  to it (primer). Raises or lowers the jargon ceiling and the acceptable equation/technical density.

### A3 · Content Objective
- **Why it exists.** Content with no objective optimizes for nothing. The objective is the
  yardstick every editorial choice is measured against, and it determines what "good" means.
- **Options.** `Build authority` · `Educate` · `Drive engagement / reach` · `Nurture (mid-funnel)`
  · `Recruit talent` · `Category creation` · `Product consideration` *(gated — see A5 + E1)*.
- **How it shapes generation.** Tunes the emotional register and the ending. *Authority* →
  a defensible, evidence-heavy stance. *Engagement* → a sharper hook, a question close, a
  more contrarian angle. *Educate* → a cleaner explanatory arc, worked example.
  *Category creation* → defines-a-term framing. Also sets the *default* insight/promotion
  ratio (E1) before any manual override.

### A4 · Funnel Stage
- **Why it exists.** Enterprise content is a system, not a stream. A reader who's never heard
  of Munshot needs a different asset than one comparing vendors. Mapping stage keeps the
  portfolio balanced instead of all top-of-funnel.
- **Options.** `Awareness` · `Consideration` · `Decision` · `Retention / advocacy`.
- **How it shapes generation.** Controls how directly the piece connects to Munshot's
  capability. Awareness = pure value, product invisible. Consideration = the problem the
  product solves, named but not pitched. Decision = proof, specifics, comparison. Gates the
  strength of the CTA (D4) and interacts with the insight/promotion dial (E1).

### A5 · Content Pillar
- **Why it exists.** Ties every asset to the eight [content pillars](./content-pillars.md)
  so coverage stays balanced and the brand's point of view compounds. Also governs how
  promotional the piece is *allowed* to be (Pillar 08 is the only overt-product lane).
- **Options.** The eight pillars: `Research Tradecraft` · `Market Science` ·
  `Financial Forensics` · `Decision Frameworks` · `Behavioral Edge` ·
  `Governance & Incentives` · `Portfolio, Risk & Market Structure` · `AI-Native Research Firm`.
- **How it shapes generation.** Scopes retrieval to the pillar's sub-themes and canonical
  books, selects the pillar's signature formats, and sets a *promotion ceiling* (e.g. all
  pillars cap at 90/10 except Pillar 08, which may go to 70/30).

---

## Group B · Substance & angle

### B1 · Content Type / Format
- **Why it exists.** Format is a promise to the reader about the shape of the payoff. A
  "framework" and a "deep dive" require different structures, lengths, and proof.
- **Options.** `Framework / checklist` · `Deep dive / analysis` · `Data drop` ·
  `Contrarian take` · `Explainer / primer` · `Case study / post-mortem` · `Myth-buster` ·
  `Trend analysis` · `Q&A / teardown` · `Bookshelf / curation`.
- **How it shapes generation.** Selects the **structural template** (Layer 3): a framework
  gets numbered, portable, screenshot-ready steps; a deep dive gets a thesis → evidence →
  implication arc; a data drop gets chart-first, minimal prose; a post-mortem gets a
  timeline. Sets expectations for the visual (D3).

### B2 · Analytical Depth
- **Why it exists.** Depth is the primary lever between "LinkedIn skim" and "committee-grade
  memo." It must be a deliberate choice, not an accident of how much the model felt like saying.
- **Options.** `Surface` (one idea, cleanly) · `Standard` (idea + mechanism + example) ·
  `Deep` (multi-factor, caveats, second-order) · `Technical` (formulas, edge cases, methodology).
- **How it shapes generation.** Sets the **claim budget** and section count (Layer 4),
  whether caveats and counter-arguments are required, and how far second-order effects are
  traced. Interacts with length (D2) — high depth in a short format forces ruthless selection.

### B3 · Data Intensity
- **Why it exists.** This audience trusts numbers over adjectives. Data intensity decides
  whether the piece *argues from evidence* or *asserts*, which is central to credibility.
- **Options.** `Qualitative` · `Illustrative` (a stat or two) · `Data-led` (evidence drives
  the argument) · `Quantitative` (original analysis, tables, methodology).
- **How it shapes generation.** Higher settings pull harder from retrieval (Layer 2),
  *require* at least one visual (D3), and raise sourcing rigor (E3) automatically. At
  `Quantitative`, the engine must show its working and cite the dataset, or validation flags it.

### B4 · Point of View / Novelty
- **Why it exists.** Consensus content is invisible; pure contrarianism is reckless. An
  explicit dial lets the brand choose its risk on any given piece deliberately.
- **Options.** `Consensus / explanatory` · `Balanced` · `Variant / non-consensus` ·
  `Contrarian` *(requires elevated sourcing to back the claim)*.
- **How it shapes generation.** Steers the thesis away from or toward the crowd, and sets how
  much the piece must *steelman the other side*. Contrarian settings raise the evidentiary
  bar (auto-bumps E3 Sourcing and E4 Confidence controls) so a spicy take is still defensible.

### B5 · Time Sensitivity
- **Why it exists.** Evergreen frameworks and news-pegged reactions have different shelf lives
  and retrieval needs. Tagging it protects the evergreen library from being polluted with
  content that expires.
- **Options.** `Evergreen` · `Seasonal / cyclical` · `News-pegged` · `Real-time / reactive`.
- **How it shapes generation.** Controls the **data-recency window** for retrieval (Layer 2)
  and whether the piece may reference dated specifics. Evergreen bans "this week"; news-pegged
  requires a timestamp and a freshness check, and shortens the review SLA.

---

## Group C · Voice & craft

### C1 · Tone of Voice
- **Why it exists.** Tone is the brand's fingerprint and must be consistent across hundreds
  of assets and multiple authors. It's also how the same fact reads as "Bloomberg terminal"
  vs "McKinsey memo" vs "sharp practitioner."
- **Options.** `Authoritative / neutral` (Bloomberg) · `Analytical / structured` (McKinsey) ·
  `Provocative / punchy` · `Conversational / practitioner` · `Academic / rigorous` ·
  `Plainspoken` — all constrained by the house style lock (E5).
- **How it shapes generation.** Sets sentence rhythm, adjective budget, and rhetorical stance
  (Layer 1). "Neutral/authoritative" strips hype and hedging alike; "provocative" permits a
  sharper hook and a stronger claim; "academic" allows nuance and citations but caps
  punchiness. Never overrides the banned-words and no-hype rules in E5.

### C2 · Narrative Structure
- **Why it exists.** Structure is invisible when right and fatal when wrong. Explicit control
  lets the same content be reshaped for a scroll (inverted pyramid) vs a read (narrative arc).
- **Options.** `Inverted pyramid` (answer first) · `Problem → solution` · `Thesis → antithesis → synthesis`
  · `Narrative / story` · `Listicle / enumerated` · `PEEL` (point-evidence-explain-link).
- **How it shapes generation.** Picks the **skeleton** the draft is generated into (Layer 3)
  and where the payoff sits. Interacts with channel: LinkedIn defaults to inverted-pyramid
  (hook-first); long-form article permits narrative build.

### C3 · Jargon / Reading Level
- **Why it exists.** Precision and accessibility trade off. A `Practitioner`+`Expert` piece
  earns trust with the right terms of art; over-jargoned primer content alienates. This is
  the fine-grained control that A2 sets a default for.
- **Options.** `Accessible` (define terms) · `Standard` · `Insider` (terms of art, undefined)
  · `Technical` (notation, formulas).
- **How it shapes generation.** Sets a target reading grade and a jargon whitelist/greylist.
  The validator (Layer 5) can flag drafts that breach the ceiling (undefined acronyms in an
  `Accessible` piece) or the floor (over-explained basics in an `Insider` piece).

---

## Group D · Format & distribution

### D1 · Channel
- **Why it exists.** This is already the app's core mechanic — one campaign, three channel
  versions. Each channel has native constraints (LinkedIn's hook economy, email's subject
  line, the article's length). *(See the repo's `types.ts` `ChannelKind`.)*
- **Options.** `LinkedIn` · `Email newsletter` · `Long-form article` *(extensible: X thread,
  research note PDF, one-pager)*.
- **How it shapes generation.** Selects the channel renderer and its structural rules: LinkedIn
  → hook + short paragraphs + one idea; Email → subject + preheader + idea/story/takeaway;
  Article → deck + sections + CTA. Sets the length band (D2) defaults and the CTA style (D4).

### D2 · Length / Reading Time
- **Why it exists.** Attention is the currency. A stated target keeps the engine from padding
  or truncating, and lets the same idea ship at three sizes across the funnel.
- **Options.** `Micro` (<100 words) · `Short` (~1 min) · `Standard` (2–3 min) ·
  `Long` (5–7 min) · `Deep` (10+ min) — or an explicit word/minute target.
- **How it shapes generation.** A hard **budget** (Layer 4). Combined with depth (B2), it
  forces prioritization: a `Deep`-depth idea in a `Short` length must cut to the single
  sharpest point. Prevents the classic AI failure of length inflation.

### D3 · Visual / Data Treatment
- **Why it exists.** For this audience, the chart *is* the argument. Specifying the visual up
  front makes the data angle a first-class output, not an afterthought — and every idea in
  [`100-linkedin-ideas.md`](./100-linkedin-ideas.md) already ships with one.
- **Options.** `None` · `Single stat / pull-quote` · `Chart` (type: bar / line / scatter /
  heatmap / distribution / Sankey / 2×2) · `Diagram / framework` · `Table` · `Annotated document`.
- **How it shapes generation.** Emits a **visual spec** alongside the copy — chart type, axes,
  the series to plot, the annotation that makes the point — ready for the design step. At high
  data intensity (B3) a visual is mandatory; the validator flags a data-led piece shipped naked.

### D4 · Call to Action
- **Why it exists.** The CTA is where value-first content either stays trusted or turns into a
  pitch. It must be dialable per piece and *governed* by funnel stage and compliance.
- **Options.** `None` · `Engagement` (comment/share prompt) · `Subscribe` (newsletter) ·
  `Soft resource` (a related read/tool) · `Product pointer` (the quiet Munshot line) ·
  `Direct` (demo/contact) *(gated to Decision stage + Pillar 08)*.
- **How it shapes generation.** Sets the closing move and its intensity. Bounded by A4
  (funnel) and E1 (insight/promotion): a top-of-funnel Awareness piece cannot emit a `Direct`
  CTA even if selected — the guardrail downgrades it and logs the override.

---

## Group E · Governance & brand — *the enterprise differentiators*

> This group is what separates an enterprise engine from a writing toy. These filters don't
> just shape tone — they **gate publication**. Each runs as a post-generation validator
> (Layer 5) that can flag, downgrade, or block a draft before it reaches human review.

### E1 · Insight-to-Promotion Ratio
- **Why it exists.** The brand's entire strategy is "trusted intelligence, not product pitch."
  This dial makes that strategy a *measurable, enforceable* parameter instead of a vibe.
- **Options.** `100 / 0` (pure value) · `90 / 10` (default) · `80 / 20` · `70 / 30`
  (Pillar 08 / Decision-stage only).
- **How it shapes generation.** Caps the proportion of the asset that may reference Munshot
  and constrains *how* (a quiet closing pointer vs an integrated mention). The validator
  measures promotional sentences against the budget and flags overruns. Pillar (A5) sets the
  ceiling; objective (A3) and funnel (A4) set the default within it.

### E2 · Compliance / Regulatory Mode
- **Why it exists.** Institutional content operates under real regimes (SEC, MiFID II, SEBI,
  FINRA). An enterprise engine bakes in guardrails so nothing non-compliant reaches a
  reviewer — a hard requirement for any regulated buyer.
- **Options.** `Off` (internal/educational) · `Marketing-reviewed` (no performance promises,
  disclaimer appended) · `No forward-looking claims` · `Research-grade` (full sourcing +
  disclosures) · `No investment advice` (educational-framing enforced).
- **How it shapes generation.** The strongest gate. Bans specific claim types (guarantees,
  return promises, "buy/sell" language), forces a disclaimer, caps confidence (E4) and CTA
  (D4), and can restrict entity naming (E6). A draft that trips a banned pattern is **blocked**,
  not flagged, with the offending line surfaced.

### E3 · Sourcing & Citation Rigor
- **Why it exists.** In the AI era, provenance is the differentiator (see idea #100). This
  filter sets how much of the piece must be traceable — the antidote to confident hallucination.
- **Options.** `None` (opinion/framework) · `Named sources` · `Fully cited` (every claim
  linked) · `Munshot-data-only` (no external claims) · `Primary-only` (filings/data, no punditry).
- **How it shapes generation.** Scopes retrieval (Layer 2) and attaches a source to each
  factual claim. At `Fully cited`, the validator blocks any unsourced number. High data
  intensity (B3) and contrarian POV (B4) auto-raise the floor here.

### E4 · Confidence / Hedging Level
- **Why it exists.** Calibration is credibility. Over-confident content ages badly and invites
  compliance risk; over-hedged content says nothing. Making it a dial keeps claims honest.
- **Options.** `Measured` (probabilistic, caveated) · `Balanced` · `Assertive` (clear stance) ·
  `Strong` *(requires elevated sourcing; blocked under strict compliance)*.
- **How it shapes generation.** Governs modal language ("suggests" vs "shows" vs "proves"),
  whether ranges/probabilities accompany claims, and how counter-arguments are handled. Bounded
  by E2 — `Research-grade`/`No forward-looking` caps confidence at `Balanced`.

### E5 · Brand & Style Lock
- **Why it exists.** Consistency across authors and hundreds of assets is a brand asset. The
  house style ("Channel Probe" voice — specific, restrained, no hype, monospace micro-labels)
  must be enforced, not hoped for.
- **Options.** `Munshot house style` (default, locked) · `Client white-label` (per-tenant
  style guide) · banned-words list · reading-grade ceiling · em-dash/oxford/number-format rules.
- **How it shapes generation.** Injects the style guide into the system prompt (Layer 1) *and*
  runs a style linter (Layer 5) that flags hype words ("game-changer," "revolutionary"),
  banned constructions, and format drift. This is the layer that keeps 10,000 assets sounding
  like one voice.

### E6 · Entity Sensitivity
- **Why it exists.** Naming specific tickers or companies carries reputational and regulatory
  weight. Firms need to control whether content is company-specific, sector-level, or abstract.
- **Options.** `Abstract` (no names) · `Sector / thematic` · `Named with disclosure` ·
  `Illustrative / anonymized` (real case, names removed).
- **How it shapes generation.** Controls retrieval scope and whether the draft may reference
  specific securities. Under strict compliance (E2), auto-restricts to `Sector` or forces a
  disclosure line. Prevents an educational piece from accidentally reading as a stock tip.

---

## Group F · Context (advanced / optional)

### F1 · Market Lens / Localization
- **Why it exists.** "Global + India-aware" is Munshot's chosen posture. The lens tailors
  examples, regulation, and market structure to the reader's world.
- **Options.** `Global` · `US` · `India / EM` · `Europe` · `APAC` *(per-tenant defaults)*.
- **How it shapes generation.** Selects region-appropriate examples (DRHP vs S-1), regulatory
  frame (SEBI vs SEC), and market-structure references, and scopes retrieval to that market's sources.

### F2 · Series / Campaign Linkage
- **Why it exists.** Enterprise content compounds through *series*, not one-offs. Linking an
  asset to a running series ("Red flag of the week," "Munshot bookshelf") enforces continuity.
- **Options.** `Standalone` · `Part of series [X]` · `Multi-part [n of m]`.
- **How it shapes generation.** Pulls prior entries for consistency of format, voice, and
  numbering, and adds series framing (callbacks, "previously," next-in-series hook).

### F3 · Data Recency Window
- **Why it exists.** Some pieces must use only fresh data; others draw on decades. An explicit
  window prevents stale numbers in a "current" piece and anachronism in an evergreen one.
- **Options.** `Any` · `Last 24 months` · `Last quarter` · `Since [date]` · `As-of [date]` (point-in-time).
- **How it shapes generation.** Bounds retrieval (Layer 2) and, critically, supports
  **point-in-time** integrity for backtested or historical claims — no look-ahead leakage
  (ties directly to idea #19).

---

## One-click presets — the "terminal function keys"

Enterprise users don't set 20 filters every time. Presets bundle the filters into
named, tuned starting points (all editable after selection). These are the engine's
equivalent of a Bloomberg function key.

| Preset | Bundles | Feels like |
|--------|---------|-----------|
| **The Terminal Note** | Analyst · Expert · Data-led · Neutral tone · Inverted pyramid · Short · Chart · Fully cited · 95/5 | A Bloomberg market note |
| **The Executive Memo** | CIO/Allocator · Practitioner · Framework · McKinsey tone · Thesis→synthesis · Standard · Diagram · Soft CTA · 90/10 | A McKinsey one-pager |
| **The Contrarian Take** | PM · Practitioner · Contrarian POV · Provocative · Inverted pyramid · Short · Named sources · 90/10 | A sharp LinkedIn hook that's still defensible |
| **The Explainer** | Analyst/Associate · Primer · Explainer · Conversational · Problem→solution · Standard · Accessible jargon · 85/15 | A teaching post |
| **The Data Drop** | Quant · Expert · Quantitative · Neutral · Data-first · Micro/Short · Chart mandatory · Primary-only · 95/5 | A single-chart insight |
| **The Governance Alert** | Risk/Analyst · Practitioner · Case study · Neutral · Timeline · Standard · Research-grade compliance · Measured confidence · 100/0 | A forensic red-flag note |
| **The Category POV** | CIO · Practitioner · Trend analysis · Authoritative · Narrative · Long · Pillar 08 · Direct CTA allowed · 70/30 | A thought-leadership flagship |

---

## Filter dependencies & guardrails — the enterprise logic

Filters are not independent switches; the engine enforces a dependency graph so a user can't
assemble an incoherent or non-compliant brief. Selected rules:

- **Compliance dominates.** `Research-grade` or `No forward-looking` → caps Confidence (E4)
  at `Balanced`, forces Sourcing (E3) ≥ `Named`, downgrades CTA (D4) to ≤ `Soft`, and may
  force Entity (E6) to `Sector`. Compliance always wins a conflict.
- **Promotion is pillar-bounded.** Insight/Promotion (E1) cannot exceed the ceiling set by
  Pillar (A5). Only Pillar 08 + Decision-stage (A4) unlocks 70/30 and a `Direct` CTA.
- **Depth floors by seniority.** Audience (A1) = `Allocator`/`CIO` raises the Depth (B2)
  floor to `Standard` and caps Jargon (C3) — no over-technical noise for a time-poor reader.
- **Evidence scales with spice.** Contrarian/Variant POV (B4) and `Quantitative` Data
  Intensity (B3) auto-raise Sourcing (E3) and require a visual (D3).
- **Channel bounds length.** Channel (D1) sets hard length bands (D2) — LinkedIn can't emit a
  10-minute read; the article can't ship at 80 words.
- **Every guardrail is logged.** When the engine downgrades a selection (e.g. a blocked
  `Direct` CTA), it records the override and the reason, visible in review — no silent edits.

---

## The generation brief — one object, fully auditable

Every generation is driven by a single structured brief, stored with the resulting asset.
This is what makes output reproducible, reviewable, and A/B-testable — and it slots directly
onto this repo's `Campaign` model (each `ChannelVersion` carries the brief that made it).

```ts
interface GenerationBrief {
  // A · Intent
  audience: Persona
  sophistication: 'primer' | 'practitioner' | 'expert'
  objective: Objective
  funnelStage: 'awareness' | 'consideration' | 'decision' | 'retention'
  pillar: PillarId                       // 01–08, see content-pillars.md

  // B · Substance
  contentType: ContentType
  depth: 'surface' | 'standard' | 'deep' | 'technical'
  dataIntensity: 'qualitative' | 'illustrative' | 'data-led' | 'quantitative'
  pointOfView: 'consensus' | 'balanced' | 'variant' | 'contrarian'
  timeSensitivity: 'evergreen' | 'seasonal' | 'news-pegged' | 'reactive'

  // C · Voice
  tone: Tone
  structure: NarrativeStructure
  jargon: 'accessible' | 'standard' | 'insider' | 'technical'

  // D · Format
  channel: ChannelKind                   // reuses repo types.ts
  length: LengthTarget
  visual: VisualSpec                      // type + axes + annotation
  cta: CtaType

  // E · Governance
  insightPromotionRatio: 100|90|80|70     // % insight; pillar-capped
  compliance: ComplianceMode
  sourcing: 'none' | 'named' | 'fully-cited' | 'munshot-only' | 'primary-only'
  confidence: 'measured' | 'balanced' | 'assertive' | 'strong'
  brandLock: StyleGuideRef                // house or white-label
  entityPolicy: 'abstract' | 'sector' | 'named-disclosed' | 'anonymized'

  // F · Context
  marketLens: 'global' | 'us' | 'india-em' | 'europe' | 'apac'
  series?: SeriesRef
  recencyWindow?: RecencyWindow

  // Provenance (system-populated, not user-set)
  preset?: PresetId
  guardrailOverrides: GuardrailLog[]      // what the engine adjusted and why
  modelVersion: string
  sourcesUsed: SourceRef[]
}
```

---

## Governance, provenance & auditability

The reason to store the whole brief with every asset:

- **Reproducibility.** Regenerate the exact asset from its brief — essential for review,
  legal hold, and debugging a bad output.
- **Auditability.** A compliance reviewer sees the compliance mode, sourcing level, and every
  claim's source in one place. The brief *is* the audit trail.
- **A/B and learning.** Because every asset carries its brief, the engine can learn which
  filter combinations drive engagement or conversion per persona — the data flywheel a plain
  writing tool can't build.
- **Provenance as product.** Each generated claim links back to its source document (idea
  #100). "Sourced, auditable, defensible" isn't a tagline — it's a stored property of every asset.

---

## How this surfaces in the app (UX notes)

Tie-in to the existing "Turn into content" flow in the Workspace:

1. **Progressive disclosure.** Show five core filters by default — Audience, Objective,
   Content Type, Channel, Length — behind a clean "Brief" panel. Everything else lives under
   **"Advanced controls"** so the common path is fast and the enterprise path is complete.
2. **Presets first.** Lead with the seven presets as one-click function keys; each expands
   into the full editable brief. Most users start from a preset and tweak two fields.
3. **Live brief summary.** A single generated sentence restates the brief in plain English
   ("A *data-led, expert-level* LinkedIn *data drop* for *quant PMs*, *fully cited*, 95/10
   insight/promotion") so the user sees exactly what they're about to generate.
4. **Inline guardrails.** When a selection is bounded (a `Direct` CTA on an Awareness piece),
   show the downgrade and the reason at selection time — not as a post-hoc surprise.
5. **Brief travels with the campaign.** Stored on the `Campaign` and each `ChannelVersion`,
   visible in review, and re-runnable — closing the loop from brief → asset → audit.

---

### Why this is an engine, not a writing tool

A writing tool maps *topic → text*. This system maps *brief → governed, sourced, on-brand,
reproducible asset*, where every one of ~25 controls routes to a real mechanism — retrieval
scope, structural template, budget, or a publication gate — and the whole brief is stored for
audit. That is the enterprise line: not better prose, but **content operations with
governance, provenance, and learning built in**.
