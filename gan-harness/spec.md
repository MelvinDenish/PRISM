# PRISM Redesign — Design Spec (GAN brief)

Production-grade, brand-led redesign of PRISM (placement / interview-prep SaaS). React + Vite, plain CSS tokens in `client/src/index.css`.

## Aesthetic direction
- **Brand:** "PRISM" — light refracted through a prism into a spectrum. Lean into the refraction metaphor for the logo + accents.
- **Palette:** Teal `#0D9488` (brand) + Amber `#EA580C` (single action CTA per screen). Cool-mint neutral surfaces, deep teal-tinted ink.
- **Type:** Plus Jakarta Sans (display + body), JetBrains Mono for code/numbers.
- **Feel:** calm, credible, modern SaaS (Linear / Stripe / Vercel tier of polish) — confident, not flashy.

## Hard requirements
1. **No emoji as icons** anywhere. One consistent SVG icon set (react-icons `Fi`/`Lu`), uniform size + stroke.
2. **Real brand mark** (custom SVG prism glyph) + wordmark — not a letter in a box.
3. Consistent **PageHeader** pattern: icon chip + title + optional subtitle + optional action.
4. Refined **type scale, spacing rhythm, elevation, and states** (hover/focus/active/disabled).
5. Real **empty states** and loading **skeletons** (not bare spinners).
6. **Tasteful depth/atmosphere** — subtle texture, layered shadow, refraction accents — never flat color blocks or AI-slop gradients.

## Surfaces to nail (judged)
/login, /dashboard (mentee + mentor), /resources, /coding-questions (+solve), /analytics, /mentors, sidebar.

## Success
A first-time viewer reacts "this looks like a real, well-funded product." Zero emoji. Cohesive brand. Every screen feels intentional.
