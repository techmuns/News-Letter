# Munshot Content Strategy

The strategy and system behind Munshot's content engine. The goal is not to promote the
product — it's to make **Munshot the trusted source institutional investors go to for
sharper thinking**. Promotion is a by-product of being genuinely useful, held to a quiet
~10% of any piece.

This folder is the strategic layer that sits above the app in this repo. The app
(`/src`) is the *console* that produces and distributes content across LinkedIn, email, and
long-form article. These docs are the *editorial and product doctrine* that console runs on.

---

## What's here

| Document | What it is |
|----------|------------|
| [**content-pillars.md**](./content-pillars.md) | The 8 evergreen pillars — the permanent lanes the brand publishes in, and how each earns trust. |
| [**100-linkedin-ideas.md**](./100-linkedin-ideas.md) | 100 ready-to-use LinkedIn ideas, grouped by pillar. Each has a headline, a canonical book, why it matters, and a visual/data angle. |
| [**content-filters.md**](./content-filters.md) | The enterprise pre-generation filter system — the ~25 controls (audience, objective, depth, tone, insight/promotion ratio, compliance, sourcing…) that turn a topic into a governed, auditable brief. |

---

## The positioning in one paragraph

Munshot is a fintech AI platform that automates institutional research with agents. Our
content proves that worldview rather than advertising it: rigorous, data-led, framework-first
intelligence a fund manager would forward to a colleague. We publish the *tradecraft* of
great research — variant perception, financial forensics, decision frameworks, governance
red flags, risk math, and the future of the research function — and we let the product show
up only as a quiet, earned footnote. **Trust first, product second.**

## Who it's for

Portfolio managers · hedge-fund analysts · PE and VC investors · buy-side and sell-side
analysts · allocators/LPs · heads of research. Global frameworks, with select India/EM
angles (DRHPs, promoter governance) where they sharpen the point.

## The voice ("Channel Probe" house style)

Inherited from the app's design system and enforced by the [Brand & Style Lock](./content-filters.md#e5--brand--style-lock):

- **Specific over sweeping.** "Median issue size fell ~18%," not "the market is shifting."
- **No hype.** Banned: game-changer, revolutionary, unlock, supercharge, seamless.
- **The signal is in the detail.** The edit, the footnote, the loss ratio — value hides in specifics.
- **Earn the pointer.** The piece must stand on its own even if Munshot didn't exist.
- **Books as generosity.** Point the reader to the best thinking in the field; a trusted source shares its shelf.

---

## How the pieces fit together

```
              ┌─────────────────────────────────────────────┐
   STRATEGY   │  8 Content Pillars  (the evergreen lanes)    │
              └───────────────┬─────────────────────────────┘
                              │  each pillar spawns series → ideas
              ┌───────────────▼─────────────────────────────┐
   IDEAS      │  100 LinkedIn Ideas (headline · book ·       │
              │  why it matters · visual/data angle)         │
              └───────────────┬─────────────────────────────┘
                              │  each idea + a Brief =
              ┌───────────────▼─────────────────────────────┐
   ENGINE     │  Filter System → GenerationBrief →           │
              │  governed, sourced, on-brand asset           │
              └───────────────┬─────────────────────────────┘
                              │  one campaign, three channels
              ┌───────────────▼─────────────────────────────┐
   APP        │  LinkedIn · Email · Article  (this repo /src)│
              └─────────────────────────────────────────────┘
```

A pillar defines the lane; an idea is a campaign seed; the filters turn that seed into a
fully-specified brief; the app generates and distributes it across three channels — the
one-campaign-three-channels mechanic already built in `/src`.

## Suggested weekly cadence

Mirrors the newsletter rhythm in the app (Mon insight · Wed story · Fri actionable):

- **Mon** — Market Science / Research Tradecraft (the credibility engine)
- **Wed** — Financial Forensics / Governance (the "red flag" depth)
- **Fri** — Decision Frameworks / Behavioral Edge (the most shareable)
- **~Monthly flagship** — an AI-Native Research Firm piece (the category play, kept light)

## How to measure it (trust, not vanity)

Because "trusted source" is the goal, weight the metrics that signal trust over raw reach:

- **Depth signals:** saves, shares to a colleague, comments from named practitioners, dwell time.
- **Funnel signals:** newsletter subscribes from LinkedIn, return readership, article completion.
- **Authority signals:** inbound from target personas, being cited/quoted, "bookshelf" replies.
- **Governance signals:** % of assets passing compliance on first pass, sourcing completeness.

Vanity reach is a weak proxy; a fund manager who saves and forwards one framework is worth
more than a thousand impressions.

---

## Status & next steps

- ✅ Pillars, 100 ideas, and the filter-system spec (this folder).
- ▶️ **Wire the filters into the app** — surface the `GenerationBrief` in the Workspace
  "Turn into content" flow (see the [UX notes](./content-filters.md#how-this-surfaces-in-the-app-ux-notes)).
- ▶️ **Seed campaigns from the ideas** — promote high-priority ideas into `src/data/mockData.ts`
  as full three-channel campaigns.
- ▶️ **Editorial calendar** — schedule the first 4–6 weeks off the cadence above.

> These are proposals, not locked decisions — the pillars, the idea set, and the filter
> taxonomy are meant to be pressure-tested and edited by the team.
