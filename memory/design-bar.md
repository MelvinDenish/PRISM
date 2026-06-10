---
name: design-bar
description: The user's design quality bar for PRISM — production-level, brand-led, no emoji icons
metadata:
  type: feedback
---

PRISM must look like a **production-level system, not a toy project**. The user rejected two rounds of "swap the colors" theming as not good enough.

**What they actually want:**
- **No emoji as icons** anywhere (page titles, quick actions, stats). Use a single consistent SVG icon set (lucide/react-icons), uniform stroke + size.
- A real **brand and rethought design system** — typography scale, spacing rhythm, refined components, states, micro-interactions, empty states, a proper logo/wordmark — not just a color palette.
- Iterate via a **self-feedback loop**: act as a user/learner of the site, screenshot, critique honestly, improve, repeat until the result is genuinely impressive ("amazed by the cool, most professional design"). Use `/ecc:gan-design` (generator/evaluator) for this.
- Research how the best products achieve polish **beyond color** (iconography, type, layout, depth, motion) and apply it.

**Why:** This is the user's product; they care about it looking credible/professional, and have low tolerance for surface-level changes.

**How to apply:** When doing UI work here, hold a high bar, remove emoji icons, think brand-first, and loop with screenshots + honest self-critique before declaring done. Current theme direction chosen: Teal (#0D9488) + Amber action (#EA580C), Plus Jakarta Sans — but execution quality is what was lacking. See [[dev-db-setup]].
