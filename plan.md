# PRISM — Market & Requirement Analysis for College Placement Prep

**Date:** 2026-05-20
**Repo state:** GitHub `MelvinDenish/PRISM`, main @ `07523a5 working thing` (private). Local main is one commit ahead (`6a079b0` — QuestionBank seed + docs + in-flight UI/route work) and unpushed. This analysis treats the local state as "current" since GitHub will catch up on next push.
**Goal:** Determine what PRISM needs to become a credible end-to-end placement-prep platform for the user's college department juniors (Indian engineering campus placement context).

---

## §1 What PRISM Is Today (concise)

Two-package full-stack JS app: React 19 + Vite client, Express + MongoDB server, Socket.IO + PeerJS realtime. Three roles: mentor / mentee / admin. Shipped feature surface:

- AI mock interviews (technical / HR / GD) via Groq (`llama-3.1-8b-instant`)
- 6-round Interview Game (aptitude → tech → HR) with leaderboard
- Code execution sandbox in 5 languages (Judge0 primary, local `child_process` fallback)
- Coding-question library with test cases
- Topic + resource library (~50 seeded resources across 12 topics)
- AI-generated learning paths
- Mentor discovery with skill-based matching + availability slots
- Mentorship session booking + email notification + live video call (WebRTC) + collaborative Monaco editor
- Resume builder (AI-assisted) + resume-vs-JD analysis (Gemini API)
- Personal analytics dashboard (Recharts)
- Notifications (basic)

This is a **lot** for a side project. The codebase has a strong spine (auth middleware, sandbox defenses, asymmetric WebRTC signaling, single-socket presence). Two consequences:
- ✅ Differentiation potential is real — almost no competitor combines AI mocks + mentor handoff + content + resume tooling in one free product.
- ⚠️ Breadth is ahead of depth — many features are present but shallow (notifications, company prep, post-session feedback, peer community). Polish + a few targeted additions are the difference between "demo" and "deploy to 100 juniors."

---

## §2 Target User: Indian Engineering Student in Placement Season

The realistic primary user is a 3rd / 4th-year B.Tech student at a Tier-1 / Tier-2 / Tier-3 Indian college. The placement journey is roughly:

| Phase | Timeline | What they do | Pain points |
|---|---|---|---|
| **Awareness** | T-18 to T-12 mo | Realize placements are coming. Hear from seniors. Get scared. | "Where do I start?" |
| **Foundation** | T-12 to T-6 mo | Start DSA (Striver / Love Babbar sheet). CS subjects. Aptitude. | Information scattered across YouTube, GFG, LeetCode, Telegram |
| **Practice** | T-6 to T-3 mo | Solve problems daily, mock tests, projects, OS/DBMS/CN revision | No structured feedback. Hard to know if you're "ready" |
| **Active prep** | T-3 to T-0 mo | Company-specific prep, past papers, mocks with peers/mentors | Past papers are gated behind paid platforms. Anxiety spikes. |
| **Placement season** | T = 0 | Online tests, coding rounds, interviews, GDs | Decision fatigue across 10-20 companies, schedule clashes |
| **Reflection / handoff** | T+1 to T+6 mo | Share experiences with juniors | No durable record; lessons lost |

**Implicit requirements that emerge:**
1. A single home for the whole journey — not 8 tabs.
2. **Structured progression** — what to do next, this week, today.
3. **Honest feedback** — quantitative + qualitative, not just "good job."
4. **Social proof** — see what worked for peers and seniors from your own college.
5. **Cost = ₹0** — paid platforms (InterviewBit Pro, AlgoExpert, etc.) are out of reach for many; juniors need this to be free.
6. **Mobile-first usage** — most studying happens on phone.

PRISM hits #1, partially #2, partially #3. Misses #4, #6. Already free, so #5 is solved.

---

## §3 Competitive Landscape (Indian context)

Where PRISM sits relative to what students currently use:

| Platform | Strength | Weakness | What PRISM does better |
|---|---|---|---|
| **LeetCode** | Best problem set, contests, discuss tabs | Coding only; no aptitude, no HR/GD, paid sub for company tags | Multi-modal interview prep + free |
| **HackerRank** | Used by recruiters for online tests; skills certs | Practice UI dated; no mentors; community thin | Mentor connect + AI mocks |
| **InterviewBit** | Structured DSA + system design courses; aptitude | Premium course gates; static content | Live mentor + AI personalization |
| **GeeksforGeeks** | Free articles, problem sets, GfG Practice | Quality variance; SEO-driven content; no integrated mocks | Curated + AI feedback loop |
| **Coding Ninjas (Code360)** | Strong course content, well-marketed | Course = ₹50k+; gated practice | Free, college-centric |
| **PrepInsta** | Company-wise prep (TCS, Wipro, Infosys), aptitude | Quiz-heavy, low-quality UI, ads | Cleaner UX + AI mocks |
| **Unstop (Dare2Compete)** | Hackathons, fests, internship discovery | Not a learning platform; event aggregator | Skill development engine |
| **Pramp** | Free peer-to-peer technical mocks | Coding-only; scheduling friction; English-speaking community | AI fallback + mentor option |
| **interviewing.io** | Premium expert mocks | $200+/session; US-centric | Free + India-focused |
| **AlgoExpert** | Curated 170-problem set, video explanations | $100+/yr; coding only | Free + breadth |
| **Naukri Campus** | Job board for freshers | Aggregator; no prep | Prep platform; can integrate |
| **Internshala** | Internship marketplace + cheap courses | Not interview-focused | Complementary |
| **Telegram/Discord study groups** | Free, peer-driven | Unstructured; quality varies; ephemeral | Persistent + structured |

**Strategic takeaway:** there is no Indian "Pramp + LeetCode + Resume.io + GeeksforGeeks lite" in one product. PRISM's bet is the combination, not any single feature winning. The college-cohort angle (juniors from same department) is a moat — no national platform can replicate intra-college trust and context.

---

## §4 Complete Requirements for End-to-End Placement Prep

Organized by user phase. ✅ = PRISM already covers · ⚠️ = partial / shallow · ❌ = missing.

### A. Self-assessment & planning
- ✅ Skill profile (User model has `skills`, `expertise`, `aimingCompany`)
- ⚠️ Diagnostic test (no initial assessment to baseline a new user)
- ⚠️ AI-generated learning paths exist but not personalized to diagnostic
- ❌ "Roadmap" view — what to do this week, this month, until placement season
- ❌ Goal-setting (target companies, target package, deadlines)

### B. Foundation learning
- ✅ Topic catalog + resources
- ✅ Resource progress tracking (`models/Progress.js`)
- ⚠️ Resources are external links (YouTube, articles) — no in-app reading / video player with notes
- ❌ Quizzes per topic / chapter to confirm understanding
- ❌ Domain tracks (web dev, ML, system design, low-level design, DevOps) — current topics are CS-fundamentals heavy

### C. Coding practice
- ✅ Coding questions with test cases
- ✅ Code execution (5 languages)
- ⚠️ Submission persistence (`CodeSubmission` model exists, unused — Milestone 3c will fix)
- ❌ Difficulty-tiered ladder (Easy → Medium → Hard with prerequisite gating)
- ❌ Company tags on coding questions (LeetCode-style filter)
- ❌ Topic tags + problem-of-the-day
- ❌ Editorial / solution walkthroughs
- ❌ Discussion thread per problem
- ❌ Live coding contests (weekly, timed, ranked)

### D. Aptitude & CS-fundamentals practice
- ✅ Aptitude + CS MCQs via `QuestionBank` (powers InterviewGame)
- ❌ Standalone aptitude practice mode (without the full game)
- ❌ Timed mock tests in TCS / Infosys / Wipro / Cocubes / AMCAT formats
- ❌ Subject-wise quiz with explanations
- ❌ Past-year mock papers

### E. Mock interviews
- ✅ AI mocks (technical / HR / GD) with evaluation
- ✅ 1:1 mentor video + code-pair via PeerJS
- ⚠️ Mentor feedback is verbal, not captured (Milestone 3a will add structured `SessionFeedback`)
- ❌ Peer-to-peer mocks (Pramp-style matching)
- ❌ Mock interview recording / replay
- ❌ Mock test in placement-test format (90-min, 30 questions, no pause)
- ❌ Interview answer library with STAR-framework guidance for behavioral

### F. Company-specific prep — **biggest gap**
- ⚠️ Companies page exists but doesn't link to anything (no resources, questions, or experiences filtered by company)
- ❌ Interview experiences archive (juniors writing up "I interviewed at X, here's what happened")
- ❌ Process timeline per company (test → coding round → tech interviews → HR)
- ❌ Past placement data from your own college (last year's average package, top recruiters, who got placed)
- ❌ Role-specific prep (SDE / Analyst / DevOps / Data Scientist tracks)

### G. Resume & profile
- ✅ Resume builder (AI-assisted)
- ✅ Resume vs JD analysis with ATS scoring (Gemini)
- ❌ Multiple resume templates (only one layout?)
- ❌ Export polish (PDF formatting, font embedding)
- ❌ Cover letter generation per JD
- ❌ LinkedIn URL audit
- ❌ Portfolio link checker (GitHub repo health, README quality)

### H. Application tracking
- ❌ Job board / company list with deadlines
- ❌ Application status tracker (applied → online test → shortlisted → interviewed → offer/reject)
- ❌ Calendar view of placement events
- ❌ Document checklist per company (resume version, transcripts, IDs)

### I. Community & support
- ❌ Discussion forum / peer Q&A (StackOverflow-style for placement questions)
- ❌ Study groups within college
- ❌ Senior-to-junior alumni connect (placed senior shares 30-min slot)
- ❌ Mentor messaging outside of scheduled sessions
- ✅ Online status indicator (mentor isOnline tracked)

### J. Analytics & motivation
- ✅ Personal dashboard (Recharts)
- ✅ Game score history + radar chart
- ❌ Skill heatmap (what topics are weak)
- ❌ Time-spent tracking
- ❌ Daily streak / consistency tracking
- ❌ Achievements / badges
- ❌ Progress against personalized roadmap

### K. Notifications & reminders
- ⚠️ In-app notifications (model + route exists; coverage thin)
- ✅ Email on new session request (one template only)
- ❌ Session reminders (24h / 1h before)
- ❌ Daily practice reminder
- ❌ Deadline alerts (company application closing)
- ❌ Mobile push (PWA / native)

### L. College-specific features (the moat)
- ❌ College cohort registration (whitelist by `@college.edu` domain or invite code)
- ❌ TPO (Training & Placement Officer) dashboard
- ❌ Class-wide / batch-wide leaderboards
- ❌ Department-specific resources (CSE vs ECE vs ME)
- ❌ College event calendar (placement drive announcements, workshops)
- ❌ Bulk student onboarding by TPO

### M. Non-functional (already raised in earlier audit)
- ❌ AI-route rate limiting (cost control critical at 100+ students)
- ❌ Automated tests
- ⚠️ Mobile responsiveness (sidebar has mobile menu but most pages untested on small screens)
- ❌ PWA / offline mode for content reading
- ❌ Multi-language support (English-only)

---

## §5 Gap Severity Matrix

For prioritization, rank each gap by **impact × effort**.

| Gap | Impact | Effort | Priority |
|---|---|---|---|
| Company-specific prep linkage (resources / questions / experiences by company) | Very High | Medium | **P0** |
| AI rate limiting (cost protection) | Very High | Low | **P0** |
| Session reminders + post-session feedback | High | Low | **P0** |
| Submission persistence + "My Submissions" | High | Low | **P0** |
| Interview-experience archive (juniors write, juniors read) | Very High | Medium | **P0** |
| College cohort + invite codes + TPO dashboard | Very High | Medium-High | **P1** |
| Peer-to-peer mock matching | High | Medium | **P1** |
| Standalone aptitude / topic-wise quiz mode | High | Low | **P1** |
| Application tracker (Kanban view) | High | Medium | **P1** |
| Mobile responsiveness audit + PWA | High | Medium | **P1** |
| Discussion forum / peer Q&A | High | High | **P2** |
| Live coding contest infrastructure | Medium | High | **P2** |
| Mock interview recording / replay | Medium | High | **P2** |
| Multi-language / Hindi support | Medium | High | **P3** |
| Mobile native app | Medium | Very High | **P3** |

---

## §6 Differentiation Strategy

What PRISM should lean into, that no competitor can easily copy:

1. **AI mock interviewer + human mentor handoff in one flow.** If the AI detects weakness in a topic, it offers to book a mentor session on that topic. This is the killer combo.
2. **College-cohort gating with intra-college trust.** Juniors trust seniors from their own college more than internet strangers. Bake this in.
3. **Interview-experience archive with college lineage** — "Aditya Kumar (NIT Trichy 2024) wrote up his Google interview. He was mentored by Priya Patel." Network effects.
4. **Free, no paywall, ever.** Position against InterviewBit Pro / AlgoExpert / Coding Ninjas course fees.
5. **Built by students, for students** — credibility narrative.

What NOT to compete on (you'll lose):
- Problem set size (LeetCode owns this)
- Algorithm video content (GFG, NeetCode own this)
- Recruiter integration (HackerRank owns this)

---

## §7 Recommended Phased Roadmap

A 6-month plan to ship a "deployable to juniors" v1.

### Phase 0 — Cleanup + Hardening (Week 1, ~10 hrs)
Already scoped in earlier plan (`dynamic-plotting-whale.md`):
- Milestone 1 cleanup (✅ already executed in commit `6a079b0`)
- Milestone 2 hardening: **rate limit AI routes** (critical before any rollout), error sanitization, request validation, test scaffold

### Phase 1 — Close immediate requirement gaps (Weeks 2-4, ~25 hrs)
The Milestone 3 features from the earlier plan:
- 3a Post-session feedback loop (`SessionFeedback`)
- 3b Session reminders (24h / 1h emails + in-app)
- 3c Save coding submissions per user
- 3d Mentor profile edit page

### Phase 2 — Company prep & community (Weeks 5-8, ~40 hrs)
The largest impact gaps:
- Company-specific prep linkage: `companyTags` on Resource + CodingQuestion; Companies page filtered views
- **Interview-experience archive**: new `InterviewExperience` model — fields: `author`, `company`, `role`, `year`, `process`, `roundDetails`, `questions`, `tips`, `verdict`. CRUD UI. Admin moderation.
- Diagnostic test on signup → personalized learning path

### Phase 3 — College cohorts (Weeks 9-12, ~40 hrs)
The differentiation moat:
- Add `college` + `cohort` + `batch` fields to User
- Invite-code-based signup (TPO creates code, students use it)
- TPO role + dashboard: batch analytics, top performers, weak topics
- College leaderboards (department-wise, batch-wise)
- Senior-to-junior alumni connect (placed seniors opt-in for 15-min slots)

### Phase 4 — Polish for real usage (Weeks 13-16, ~30 hrs)
- Aptitude / topic-wise standalone quiz modes
- Application tracker (Kanban)
- Mobile responsiveness audit; PWA install prompt
- Peer-to-peer mock matching
- Notifications: daily practice reminder, deadline alerts

### Phase 5 — Forum + contests (Weeks 17-24, ~50 hrs)
- Discussion forum (Q&A, threaded comments, voting)
- Weekly coding contest infrastructure (timed + leaderboard)
- Mock test in placement-test format (90 min, no pause)
- Resume template library + cover letter generation

**Cumulative effort:** ~195 hours over 24 weeks. Realistic for a single developer doing this in spare hours, or a 2-3 person team in a semester.

---

## §8 Cost & Sustainability

Critical for "department junior" scale (~100 active users):

| Item | Free tier | Paid tipping point |
|---|---|---|
| **Groq API** | 14,400 req/day free; ~6k tokens/req for chat | At 100 students × 5 mocks/wk × 30 chat turns = 15k req/wk = ~2k/day. Within free tier, but rate-limit hard to prevent runaway. |
| **MongoDB Atlas** | M0 = 512 MB storage, shared CPU | Will outgrow with InterviewExperience + Resume drafts at 100 users. M10 ($60/mo) is the upgrade path. |
| **Render / Railway** | Free tier sleeps after inactivity | $7-15/mo for always-on small instance |
| **Vercel** (client) | Free for hobby | Indefinite for static React |
| **Email** | Gmail SMTP free (500/day) | SES or SendGrid at scale |
| **Judge0** | Free public instance (rate-limited) | $0.30/exec on RapidAPI; self-host on a $5 VPS |
| **Domain** | n/a | ~₹800/yr (.in) or ₹1500/yr (.com) |

**Estimated total monthly cost at 100 users (post-free-tier):** ₹2,000-4,000 ($25-50). Sustainable for a department-funded project; might want to ask the TPO/department for a small budget.

**Hard cost protections to put in NOW:**
- `express-rate-limit` on all Groq routes (already installed, never imported — biggest cost risk)
- Quota per user per day on AI mocks (e.g., 3 / day)
- Aggressive client caching of static content (topics, resources)

---

## §9 Recommended Immediate Next Steps

If the goal is "deploy to my college's juniors next semester":

1. **Push current local main to GitHub** — get the committed work into the remote. (One command: `git push`.)
2. **Execute Milestone 2 (hardening)** from the earlier plan — rate limit is mandatory before any rollout.
3. **Execute Milestone 3a-3c** — these are small, high-value, and close visible gaps (feedback, reminders, submissions).
4. **Start Phase 2 design** — sketch the `InterviewExperience` schema and Companies-page filtering. This is the single biggest differentiator.
5. **Talk to your TPO / department head** — surface PRISM as a department asset. They may fund hosting + give you a college email allowlist for invite codes.

If the goal is "ship to juniors next week":
- Phase 0 + Phase 1 only. Defer everything else.
- Manually populate 3-5 interview experiences from your own / friends' placements to seed the archive feel.
- Acknowledge in-product that company prep / forum are coming.

---

## §10 Honest Risks

1. **Solo-developer burnout.** 200 hours over 6 months while studying is a lot. Get one or two juniors to help in exchange for them learning React/Node + getting their name on the project.
2. **AI-cost surprise.** A bug or attacker hitting Groq routes in a loop could blow the free tier in hours. Rate limit is non-optional.
3. **Content cold-start.** Interview experiences and forum threads need seeding before they feel useful. Plan to write 5-10 yourself.
4. **Mentor supply.** You have 5 seeded mentors. Real mentor recruitment is hard. Lean on placed seniors from your own college as the first cohort.
5. **TPO buy-in.** Without departmental endorsement, adoption stalls at "friends only." Frame this as a placement-cell asset, not a personal project.
6. **Mobile usage.** If juniors mostly use phones, mobile-responsiveness gaps will make the platform feel broken. Audit early.

---

## §11 What I Need From You to Proceed

Pick one to act on next:
1. **Push the current commit** and start Milestone 2 (hardening).
2. **Sketch the `InterviewExperience` schema** with me — this is the highest-impact net-new feature.
3. **Mobile-responsiveness audit** — run the app on a phone and list breakage.
4. **Talk-track to your TPO** — I can draft a one-pager pitching PRISM as a department asset.
5. **Something else** — tell me.
