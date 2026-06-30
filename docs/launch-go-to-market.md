# PRISM — Launch & Go-to-Market

Public site: **https://prismforplacements.qzz.io**

This doc has three parts:
1. Go-live checklist (PostHog analytics + the new domain) — do this **before** posting anywhere.
2. The Reddit post(s).
3. Channel plan (where to post, and in what order).

---

## 1. Go-live checklist

### A. Turn on analytics (PostHog) — already wired in code
The client is instrumented (`client/src/utils/analytics.js`, init in `main.jsx`, identify/events in
`AuthContext.jsx`, pageviews in `App.jsx`). It **no-ops until you give it a key**. To activate:

1. Create a free account at https://posthog.com → create a project.
2. Copy the **Project API Key** (`phc_…`) from *Project Settings → Project API Key*.
3. Add two **GitHub repo Variables** (Settings → Secrets and variables → Actions → **Variables** tab):
   - `VITE_POSTHOG_KEY` = `phc_…`
   - `VITE_POSTHOG_HOST` = `https://us.i.posthog.com` (or `https://eu.i.posthog.com`)
4. For local testing, put the same two in `client/.env.local`.
5. Push to `main` → the frontend rebuilds with analytics live.
6. (Optional, recommended) In PostHog → **Surveys**, add an in-app survey ("What's one thing PRISM
   is missing?") — this captures *what users want* with zero extra code.

The key is a **public** ingestion key — safe to ship in the bundle. Nothing secret is exposed.

### B. Host the frontend on Vercel + point the domain at it (chosen path)
We moved the frontend off S3/CloudFront to **Vercel** — it auto-provisions HTTPS and handles the
custom domain with a single CNAME (no ACM, no CloudFront alternate-domain dance). The Lightsail
backend (`prism-project.duckdns.org`) is unchanged. `client/vercel.json` gives the SPA routing.

1. **Create the Vercel project**: vercel.com → New Project → import the `MelvinDenish/PRISM` repo.
   - **Root Directory: `client`** (important — it's a monorepo). Framework auto-detects as **Vite**.
   - Build command `npm run build`, output `dist` (auto-filled).
2. **Environment variables** (Vercel → Project → Settings → Environment Variables), for Production:
   - `VITE_API_URL` = `https://prism-project.duckdns.org/api`
   - `VITE_SOCKET_URL` = `https://prism-project.duckdns.org`
   - `VITE_POSTHOG_KEY` = your `phc_…` key   ·   `VITE_POSTHOG_HOST` = `https://us.i.posthog.com`
   - Deploy. The site goes live at `https://prismofficial.vercel.app` — test it there first.
3. **Custom domain**: Vercel → Project → Settings → Domains → add `prismforplacements.qzz.io`.
   Vercel shows a CNAME target (usually `cname.vercel-dns.com`).
4. **DigitalPlat DNS**: dash.domain.digitalplat.org → your domain → **DNS Records** → add:
   `Type: CNAME · Name: prismforplacements (or @) · Target: cname.vercel-dns.com`.
   Wait a few minutes; Vercel issues the TLS cert automatically and the domain goes green.
5. **Backend CORS / email links**: update the GitHub secret `SERVER_ENV` so `CLIENT_URL` lists the new
   domain **first** (it's also the base for password-reset + notification emails), plus the vercel.app
   fallback, then push to `main` to redeploy the backend:
   `CLIENT_URL=https://prismforplacements.qzz.io,https://prismofficial.vercel.app,http://localhost:5173`
6. **Smoke-test**: open `https://prismforplacements.qzz.io`, sign up, confirm the event in
   PostHog → *Activity*, and that there are **no CORS errors** in the browser console.

> Optional cleanup: the old S3+CloudFront `frontend` job in `.github/workflows/ci-cd.yml` is now
> redundant (Vercel deploys on its own from GitHub). Disable/remove it later to avoid two frontends.

### C. Metrics to actually report (to yourself and to VCs)
Don't lead with signups (vanity). Build these in PostHog:
- **Activation rate** — % of new users who complete a core action (finish a mock interview / coding run).
- **WAU/MAU + retention curve** — do week-2 / week-4 users return? *The single most-read chart.*
- **Feature usage** — which tools (mock interview, resume builder, GD, copilot) get used vs ignored.
- **Qualitative** — survey responses + a running list of requested features / reported bugs.

---

## 2. Reddit post

### r/SideProject (builder feedback + credibility)

**Title:**
> I built a free placement & interview-prep platform for college students — AI mock interviews, coding practice, mentorship. Would love brutal feedback.

**Body:**
> I'm a student, and prepping for campus placements is weirdly fragmented — LeetCode in one tab,
> resume tips on YouTube, mock interviews only if you know a senior who'll spare an hour, GD practice
> basically never. So I spent the last few months building **PRISM** to put it in one place.
>
> What it does right now (all free):
> - **AI mock interviews** — technical + behavioral, with feedback on your answers
> - **Coding practice** in a sandboxed runner (multiple languages)
> - **Group Discussions** with an AI panelist that actually talks back, so you can practice solo
> - **Resume builder + ATS analysis** — see how your resume scores before a recruiter does
> - **Mentor ↔ mentee** matching with 1:1 video sessions
> - An **AI copilot** that ties it together ("make me a 2-week plan for an SDE role", etc.)
>
> Stack, for the curious: React + Vite, Node/Express, MongoDB, Socket.IO + WebRTC for the live stuff,
> self-hosted LiveKit for video, and a few LLM providers behind the AI features.
>
> It's early and rough in places — I'd genuinely rather hear what's broken or confusing than what's
> nice. Specifically: is the onboarding clear? Does the mock interview feel useful or gimmicky? What
> would make you actually come back next week?
>
> Link: **https://prismforplacements.qzz.io** (sign-up is free, no card). Thanks for any feedback 🙏

**Posting tips:** post mid-week, daytime US hours for r/SideProject; reply to every comment in the
first 2–3 hrs (early engagement drives reach); don't drop the link and vanish.

### Variant for r/developersIndia / r/btechtards (your actual users)
Same body, but swap the intro to be India-placement-specific and drop the "stack" paragraph (that
audience cares about the product, not the framework):

> Placements are coming up and I was tired of juggling 5 tools + begging seniors for mock interviews,
> so I built one place for it — mock interviews, coding practice, GD with an AI panelist, resume ATS
> check, and mentor sessions. It's free. Looking for honest feedback before I push it to my college.

⚠️ These subs **auto-remove blatant promo** — lead with the story, engage in comments, don't repost.
Check each sub's self-promotion rule first; some require a flair or a "Showoff Saturday" thread.

---

## 3. Channel plan (order matters)

**Phase 1 — Soft launch to your real users (get first 50–100 + testimonials):**
WhatsApp/Telegram placement & branch groups · your college placement cell/TPO · LinkedIn (founder
post + classmates resharing) · Unstop · Peerlist.

**Phase 2 — Once you have usage data + a few testimonials, hard launch for the VC story:**
Product Hunt (one shot — don't waste it early) · Show HN · r/SideProject · r/developersIndia ·
IndieHackers.

**Phase 3 — Compounding:** Instagram/YouTube placement-tip shorts → funnel to the app · Quora India.

The point of the order: Phase 1 gives you the retention curve and quotes that make Phase 2 land.
