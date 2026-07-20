# Munshot Content Playbook (v2)
**LinkedIn + Newsletter knowledge base for investor-grade content**

> Replaces `finance_linkedin_creator_strategy_kb` (v1). This is the operational file the content generator reads to produce posts, newsletters, and articles from Munshot dashboards and reports.

---

## 1. Purpose

- A working playbook, not a strategy note. Every section is meant to be applied, not just read.
- Feeds three outputs: **LinkedIn posts**, **email newsletters**, **long-form articles** — all generated from dashboard/report signals.
- Designed to be lean. Everything here is context cost on every generation run, so nothing is included that doesn't change the output.
- How to use: pick a dashboard signal → pick a content pattern (§5) → draft with a template (§8) → score before publish (§9).

---

## 2. Audience — what they actually need (the spine)

**Who:** India institutional — hedge funds, PE, family offices, investment and research teams. Context is Indian markets: SEBI filings (DRHPs, shareholding patterns), Indian insurers, auto OEMs, midcaps.

**Their job-to-be-done with content:**
- They do **not** lack information. They lack **time to extract signal** from filings and data.
- They read to find **what they might have missed**, and to **pressure-test a view they already hold**.
- They distrust promotion, hype, price targets, and anything that reads sell-side.
- Credibility is earned by **showing the work** — data, source, caveat — not by simplifying.

**The reframe that drives this whole file:**
Most benchmark creators (§4) win by making finance *accessible to a broad or retail audience*. Your audience is the opposite end of the spectrum — they want **density and signal, not simplification**.

> Borrow the creators' **structure** (hooks, frameworks, second-order thinking, transparency). Drop their **register** (metaphor, explainer-simplicity, mass appeal). A PE analyst is not Scanlon's audience.

**What "useful to this audience" means, concretely:**
- Surfaces a signal they'd have needed to dig through a filing to find.
- Reframes something they thought they understood.
- Is auditable — they can see where the number came from.
- Respects that they're smarter about markets than the average reader. Never explains what they already know.

---

## 3. Positioning rules

Target balance: **70–80% investor insight, 20–30% subtle Munshot promotion.**

**The value flow — every piece follows it:**
`insight → evidence → investor implication → dashboard/report connection → CTA`

**Non-negotiables:**
- Lead with the signal, never the product.
- Cite the data source. Caveat the claim.
- No direct buy/sell tips or price targets presented as recommendations.
- Promotion is earned only after real value is delivered in the same piece.
- If the insight isn't strong enough to stand without the CTA, the piece isn't ready.

---

## 4. Writing techniques — creator benchmarks

> **Honesty note:** These are **technique benchmarks** based on each creator's well-documented public method (their books, talks, and public writing). They are **not** analysis of scraped individual posts, and posting cadences are deliberately omitted because they can't be reliably verified. The v1 `sample_hook` fields were invented; those are removed. Use these for *how to write*, not as a claim about any specific post.

The set skews US and macro/retail. The **techniques transfer**; the **register must shift to India institutional**. See §12 for adding India-specific benchmarks.

### Ray Dalio — the mechanism behind the event
- **Method:** Principles and repeatable frameworks; cause-and-effect; "here's the machine that produced this outcome."
- **Copy:** Build **named, reusable frameworks** from dashboard data (e.g. a fixed "3 questions" test). Position posts as *the mechanism the headline misses*.
- **Drop:** Grand civilizational/geopolitical sweep and long-horizon prediction. Too broad to act on for a desk; reads as punditry.

### Mohamed El-Erian — the second-order implication
- **Method:** Event → second-order effect, fast and concise; "what the market is underpricing."
- **Copy:** The **"What Investors Missed"** rail. Always push past the first-order number to the implication.
- **Drop:** Reactive daily hot-takes on RBI/Fed headlines. Munshot's edge is proprietary dashboard signal, not being fastest to comment.

### Aswath Damodaran — auditable and anti-hype (the core credibility model)
- **Method:** Valuation transparency; separates *story from numbers* (from *Narrative and Numbers*); shows assumptions; caveats; explicitly refuses stock tips.
- **Copy:** This is the trust foundation for the whole system. Every claim auditable, every number sourced, every assumption visible. The **"test the assumption yourself"** CTA.
- **Drop:** Length. His teaching runs long; LinkedIn needs compression. Keep the transparency, cut the runtime.

### Kyla Scanlon — naming the concept (use sparingly)
- **Method:** Metaphor, memorable concept-naming ("vibecession"), accessible and visual, connects data to behaviour.
- **Copy:** Only the **naming technique** — give a recurring dashboard signal a short memorable name, used rarely.
- **Drop:** Almost everything else *for this audience*. This is the biggest "looks useful, isn't, for you" case. Metaphor-led simplification and mass-appeal framing actively cost credibility with a PE desk. Take the naming; skip the simplification.

### Andrew Lokenauth — social-to-newsletter conversion
- **Method:** Scannable list formats; repeatable content categories; converts social attention into subscribers.
- **Copy:** The **conversion mechanics** — recurring named series and a clear LinkedIn → newsletter → dashboard path. Disciplined list format **only when every item is backed by data**.
- **Drop:** Engagement-optimized generic finance lists ("10 money tips"). Empty for institutional readers.

---

## 5. Content patterns

Ordered by strength for this audience. Each is a reusable skeleton.

**1. Divergence / contrarian** *(strongest)* — "The headline says X. The underlying data says Y."
Skeleton: headline claim → the data that contradicts it → why the gap exists → implication → CTA.

**2. One chart, one insight** — a single clean, annotated chart carrying one takeaway.
Skeleton: chart → the one thing it shows → investor implication → CTA.

**3. What most investors missed** — the signal buried under the obvious number.
Skeleton: the obvious number everyone saw → the signal underneath → 2–3 data points → why it matters → CTA.

**4. Framework / named questions** — a fixed, repeatable test.
Skeleton: "Only N things tell you whether [X] is real:" → each with a data point → how to apply → CTA.

**5. Data-backed list** — scannable, but every item carries a number.
Skeleton: claim to test → N checks, each with evidence → CTA. Never a list without data.

**6. Question-led reframe** — a question that changes how they read a number.
Skeleton: the number → the reframing question → the answer the data gives → CTA.

**7. Here's why it matters** — second-order thinking made explicit.
Skeleton: event/number → first-order read (what most stop at) → second-order effect → implication → CTA.

---

## 6. Munshot worked examples

One per dashboard, each on a different pattern. All are India-grounded. Numbers shown as placeholders (`₹X cr`) — the generator fills from live dashboard data; never fabricate figures.

### DRHP / IPO Tracker — *pattern: What most investors missed*
- **Hook:** "23 DRHPs were filed with SEBI this quarter. The number that matters isn't 23 — it's how many are raising fresh capital versus pure offer-for-sale."
- **Outline:** headline filing count → split fresh-issue vs OFS → OFS-heavy means promoters/PE exiting, not funding growth → what that signals about deal quality → breakdown in the tracker.
- **Newsletter angle:** the quarter's DRHP pipeline scored on capital-use quality, not volume.
- **CTA:** "The full fresh-vs-OFS split by filing is in the DRHP Tracker."
- **Why a HF/PE reader cares:** OFS-vs-fresh is a direct read on promoter intent and issue quality — the thing a headline count hides.

### Health Insurance Dashboard — *pattern: Divergence / contrarian*
- **Hook:** "Premium growth at the top private health insurers looks strong. Strip out price hikes and the volume story is flat."
- **Outline:** reported premium growth → decompose price vs volume → flat volume means growth is rate-led, not demand-led → what that means for durability and combined ratio → dashboard view.
- **Newsletter angle:** where insurer growth is real demand vs repriced books.
- **CTA:** "Price-vs-volume decomposition for each insurer is on the Health Insurance Dashboard."
- **Why they care:** rate-led growth and demand-led growth carry very different multiples.

### OEM / Auto Dashboard — *pattern: Framework / named questions*
- **Hook:** "Three questions tell you whether an auto OEM's volume growth is real: mix, inventory, and discount depth."
- **Outline:** name the framework → mix (premiumization or base?) → dealer inventory days (channel-stuffed?) → discount depth (bought or earned?) → apply to current OEMs → dashboard.
- **Newsletter angle:** the three-question test run across every OEM this month.
- **CTA:** "Mix, inventory days, and discounts per OEM are tracked on the Auto Dashboard."
- **Why they care:** wholesale volume growth is easy to manufacture; these three separate real demand from channel fill.

### Daily Market Pulse — *pattern: Question-led reframe*
- **Hook:** "FIIs were net sellers again this week. The tape says exit — the sector breakdown says rotation."
- **Outline:** the flow number → the reframing question (exit or rotation?) → sector-level buy/sell showing where money moved *to* → implication → pulse link.
- **Newsletter angle:** weekly FII/DII flow read at sector granularity, not the headline number.
- **CTA:** "Sector-level flow breakdown is in the Daily Market Pulse."
- **Why they care:** aggregate flows mislead; rotation vs exit is a completely different market signal.

### Ownership Signal Dashboard — *pattern: Divergence / smart-money*
- **Hook:** "Retail ownership in this midcap is at an all-time high. Domestic institutions have been quietly trimming for two quarters."
- **Outline:** rising retail holding → falling DII/promoter holding from shareholding-pattern data → the divergence → what it historically precedes → dashboard.
- **Newsletter angle:** where retail and institutional ownership are diverging most sharply this quarter.
- **CTA:** "Quarter-over-quarter ownership shifts by category are on the Ownership Signal Dashboard."
- **Why they care:** institutional accumulation/distribution against retail is one of the cleaner ownership signals, and it's public but tedious to track.

### Financial Risk Dashboard — *pattern: Data-backed list*
- **Hook:** "Five balance-sheet signals that showed up before the last three midcap blowups."
- **Outline:** claim (these repeat) → pledged promoter shares rising → receivable days stretching → contingent liabilities growing → auditor resignation → related-party transactions climbing → each with where to check → dashboard.
- **Newsletter angle:** the five-signal risk screen run across the coverage universe.
- **CTA:** "All five signals are flagged per company on the Financial Risk Dashboard."
- **Why they care:** these are known red flags but scattered across filings; a single screen is the value.

---

## 7. Weekly publishing system

Rhythm: **Monday industry insight · Wednesday use-case story · Friday actionable takeaway.**

### Monday — industry / sector insight
- **Goal:** establish authority, set the week's theme.
- **Best type:** framework or divergence post from a dashboard.
- **Subject line:** "The DRHP number nobody's reading correctly"
- **LinkedIn hook:** "Everyone's counting IPO filings. The signal is in *who's* raising fresh capital."
- **Munshot CTA:** "Full breakdown in the DRHP Tracker."

### Wednesday — use-case / how-the-signal-works story
- **Goal:** show product value through a real signal, not a pitch.
- **Best type:** worked example or one-chart-one-insight.
- **Subject line:** "How we caught the ownership shift two quarters early"
- **LinkedIn hook:** "This midcap's retail base doubled while institutions were leaving. Here's how the data showed it first."
- **Munshot CTA:** "The ownership timeline is on the Ownership Signal Dashboard."

### Friday — actionable investor takeaway
- **Goal:** give something usable immediately.
- **Best type:** data-backed checklist/list.
- **Subject line:** "5 balance-sheet checks before you buy a midcap this quarter"
- **LinkedIn hook:** "Before calling a midcap cheap, run these five checks first."
- **Munshot CTA:** "All five are pre-flagged on the Financial Risk Dashboard."

---

## 8. Newsletter structure

Every issue: **one useful idea · one relevant story · one practical takeaway · one clear CTA.**

**Section skeleton:**
1. **The idea** (lead) — one signal or reframe, stated in the first two lines.
2. **The story** — a real, current example from a dashboard that proves it.
3. **The takeaway** — what the reader should do or watch, concretely.
4. **The CTA** — one link, to the dashboard/report that goes deeper. Never more than one.

Newsletter is the **deep cut**; LinkedIn posts are extractions from it (§10).

---

## 9. Scoring framework

Score every piece before publish. Six dimensions, **0 / 1 / 2** each. **Pass = total ≥ 9 AND no hard-reject triggered.**

| Dimension | 0 | 1 | 2 |
|---|---|---|---|
| **Investor value** | no real signal | mild/known signal | non-obvious, extractable signal |
| **Clarity** | buried lead | readable | signal in first 2 lines |
| **Evidence** | unsourced | source implied | source + number explicit |
| **Munshot relevance** | forced/unrelated | loose fit | CTA flows from the insight |
| **CTA strength** | absent or pushy | present | subtle, value-first, one link |
| **Non-promotional tone** | reads as marketing | mixed | reads as intelligence |

**Hard rejects (override the score — auto-fail):**
- No investor insight.
- No clear takeaway.
- CTA unrelated to the content.
- Reads as generic marketing.
- Any unsourced factual claim.
- Any direct buy/sell tip or price target as a recommendation.

---

## 10. Product-promotion logic

Never "try our dashboard." Instead, always this sequence:

**show what changed → why it matters → what investors may have missed → how Munshot tracks it**

**Feature snippet examples (value-first framing):**
- **New dashboard:** "Auto OEM inventory days just crossed [threshold] — here's what channel fill at these levels historically preceded. Now tracked live."
- **New report:** "This quarter's DRHP cohort scored on capital-use quality. The OFS-heavy share is the highest in [period]."
- **New dataset:** "We added dealer-level discount data. It's already contradicting the wholesale volume story."
- **New company coverage:** "Added [company] — the receivable-day trend was the reason it flagged."
- **New alert feature:** "You can now get pinged when promoter pledging crosses your threshold, instead of finding it a quarter late."
- **New export feature:** "Export the full shareholding-pattern history to your own model in one click."
- **New comparison feature:** "Compare any two insurers on price-vs-volume growth side by side."

Each leads with the signal; the feature is the last clause, not the headline.

**Repurposing & the traffic loop:**
- **Newsletter → LinkedIn:** each LinkedIn post extracts one chart/framework/signal from the issue and points back to it.
- **LinkedIn → dashboard loop:** LinkedIn gives one real free signal → "full breakdown in [dashboard]" → dashboard shows the depth → newsletter captures the subscriber → repeat. The post gives a signal; the dashboard gives the system.
- **Comment strategy:** put the source/methodology or the dashboard link in the **first comment**, keeping the post clean and rewarding engaged readers. Answer substantive replies with more data, not defensiveness.
- **Carousel strategy:** use for frameworks, checklists, multi-quarter trends. One idea per slide, a number on every slide, last slide = takeaway + soft CTA.
- **Visuals:** one clean annotated chart beats a busy dashboard screenshot. Simple comparison tables work. Never post cluttered, unlabeled screenshots.
- **Post length:** front-load the signal before the "see more" fold; ~100–200 words; one idea per post.

---

## 11. Templates

Fill-in skeletons. Keep them this simple inside the dashboard.

**LinkedIn post**
```
[Hook: divergence / number-that-reframes / mechanism — 1–2 lines]
[The signal underneath — 1–2 lines]
[2–3 data points, each sourced]
[Investor implication — 1 line]
[CTA: one link, value-first]
```

**LinkedIn carousel**
```
Slide 1: Framework/claim name + one-line promise
Slides 2–N: one point each, a number on every slide
Final slide: takeaway + soft CTA
```

**Email newsletter**
```
Subject: [specific, signal-led]
1. The idea (2 lines, lead)
2. The story (real dashboard example)
3. The takeaway (concrete)
4. CTA (one link)
```

**Long-form article**
```
Title: [the reframe]
- The commonly-held view
- The data that complicates it
- The mechanism (why the gap exists)
- What it means for allocation/risk
- How to monitor it (→ dashboard)
```

**Feature snippet**
```
[What changed] → [why it matters] → [what was missed] → [how Munshot tracks it]
```

**Dashboard launch post**
```
[A signal the dashboard just surfaced — lead with it]
[Why it's hard to see manually]
[One concrete example]
[The dashboard now tracks it — one line]
```

**Report teaser**
```
[The single sharpest finding — stated plainly]
[One supporting number]
[What it implies]
[Full report link]
```

**Investor checklist post**
```
[Claim to pressure-test]
[N checks, each with a data point and where to find it]
[CTA: these are pre-flagged in [dashboard]]
```

---

## 12. Anti-patterns

Do not generate, or auto-reject:
- Stock tips or price targets framed as recommendations.
- Hype / hustle tone, curiosity-gap clickbait, engagement bait.
- Unsourced claims or fabricated precision (invented figures, fake cadences).
- Generic finance advice ("10 money tips") — empty for this audience.
- Simplification or metaphor overload that reads junior to a PE desk.
- Promotion before value; a CTA doing the work the insight should do.
- Hot-takes outside Munshot's data edge (reacting to macro headlines Munshot has no proprietary read on).
- Anything that sounds sell-side.

---

## 13. Future automation rules

- **Delta / "vs last week" content depends on history.** "Changed from last week" claims require the weekly JSON snapshots (per the DRHP Dash data pipeline) to have accumulated real history first. Don't generate delta content until snapshots exist to back it — otherwise it's fabricated, the exact failure this file avoids.
- **Every generated piece carries source + confidence**, mirroring the dashboard data contract. A low-confidence field should not become a confident post claim.
- **Run the §9 scoring rubric as a gate** before any auto-publish step.
- **Add India-specific benchmarks.** The §4 set is US-skewed. Techniques transfer; register doesn't. A future pass should benchmark India institutional/SEBI-world writers and domestic research-desk styles so the register calibration is sourced, not assumed.
- **Keep the file lean.** Before adding anything, ask whether it changes generated output. If not, it's cost without benefit.
