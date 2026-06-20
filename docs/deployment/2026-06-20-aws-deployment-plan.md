# PRISM — AWS Deployment Plan

> Planning document. **Part A** is the deploy-now plan (minimal cost within the AWS $100 free-tier
> credit). **Part B** is a future, production-grade AWS architecture — reference only, not to be built now.
> Authored 2026-06-20. Mirrors the approved plan in the agent plan cache.

## Context

PRISM is a two-package monorepo: a **React 19 + Vite static SPA** (`client/`) and an
**Express + Socket.IO + MongoDB** backend (`server/`). The backend is *not* serverless-friendly:
it holds long-lived Socket.IO connections (in-memory presence/room `Map`s, no Redis adapter) and
launches **Chromium via Puppeteer** for resume PDFs (`server/agent/services/resumePdf.js`). It also
talks to several optional services (Groq/Gemini/Tavily AI, LiveKit video, Judge0 code-exec, Gmail),
all of which degrade gracefully when their keys are absent.

The goal is two deliverables:

- **PART A — Deploy now**, all on AWS where cost-effective, at minimal cost that stays inside the
  new AWS Free Tier **$100 credit / 6-month** window. The user wants **live video + code-execution**
  included in this first deploy.
- **PART B — Future architecture** (plan only, *do not implement*): a rigid, cost-conscious,
  production-grade AWS design for when the app outgrows a single box.

### Decisions confirmed with the user
- **All-AWS** preferred if cost-effective; a free subdomain is acceptable for backend TLS.
- **Video + code-exec live** in the first deploy.
- **Self-host Judge0** on the box (accept ~4-month base-$100 runway; claim extra credits for full 6mo).

### The one constraint that silently breaks everything
The Vercel/CloudFront frontend is served over **HTTPS**. A browser on an HTTPS page **cannot** call
`http://` or open `ws://` Socket.IO to the backend (mixed-content block). So the backend **must** be
reachable over **HTTPS/WSS** — which requires a domain name (no public CA issues certs for a raw IP).
This is a prerequisite step, not an afterthought.

### Cost facts (verified)
New AWS accounts (post-2025-07-15) get **$100 in credits** (up to $200 via onboarding tasks), valid
**6 months or until credits are exhausted, whichever comes first**. Both dollar- and time-boxed →
size for comfort, but plan a month-6 migration/payment moment.

> **⚠ #1 day-1 verification — do this before building anything on top.** The "within $100" promise
> assumes **AWS credits apply to Lightsail**, which has historically been a notable *exception* to AWS
> promotional credits. Provision only the 4GB instance, let it run ~24h, and confirm in **Cost Explorer**
> that it draws from credits (net $0) before proceeding. **Fallback if it doesn't:** use **EC2 t4g.medium**
> (4GB ARM, ~$24/mo + ~$3.60/mo Elastic IP) — EC2 *definitely* draws credits. More setup (security group +
> EBS), and the EIP cost shortens the base-$100 runway to ~3.5 months (one more reason to claim the extra
> onboarding credits).

---

# PART A — Deploy Now (minimal cost, within $100)

## Target architecture (single-box backend + static frontend, all AWS)

```
                Browser (HTTPS)
                  │
       ┌──────────┴───────────┐
       │                      │  (REST /api  +  WSS Socket.IO)
       ▼                      ▼
  CloudFront  ───►  S3 bucket        Lightsail 4GB instance (Ubuntu)
  (frontend, free       (client       ├─ Caddy  : auto Let's Encrypt TLS → :443
   *.cloudfront.net      dist/)       │           reverse-proxy + WS upgrade
   HTTPS, SPA rewrite)               ├─ Node app (server/) :5000
                                      │   ├─ Puppeteer/Chromium (resume PDF)
                                      │   └─ Socket.IO (in-memory state)
                                      └─ Judge0 CE stack (privileged): server +
                                          workers + Postgres + Redis  (code-exec)

  DNS for backend: free DuckDNS subdomain → Lightsail static IP
  ───────────────────────────────────────────────────────────────
  Off-box managed (all $0 / pennies):
   • MongoDB Atlas M0 (free 512MB)        • S3 (uploads, STORAGE_DRIVER=s3)
   • LiveKit Cloud (free tier, video)     • Groq / Gemini / Tavily (AI keys)
   • Gmail SMTP (app password)
```

## Component decisions & rationale

| Concern | Choice | Why / cost |
|---|---|---|
| **Backend compute** | **Lightsail 4GB / 2 vCPU**, Ubuntu 22.04, free static IP | Fixed price **$24/mo**. Full VM = **privileged Docker OK** (required for Judge0's `isolate`), root, 4TB bundled egress. 4GB hosts Node + Chromium **and** the self-hosted Judge0 stack on one box. Burns the $100 credit in **~4 months** (see budget). EC2 now bills Elastic IPs even when attached — Lightsail's is free. |
| **Backend TLS/HTTPS** | **Caddy** reverse-proxy + **free DuckDNS subdomain** (e.g. `prism-api.duckdns.org`) | Caddy auto-provisions Let's Encrypt and transparently upgrades WSS → solves the mixed-content blocker. $0. (Pure-AWS alt: front the instance with its own CloudFront distro for a free `*.cloudfront.net` HTTPS domain — works but is finickier for long-lived WS; Caddy+DuckDNS is the robust default.) |
| **Frontend** | **S3 (static) + CloudFront** | All-AWS per user preference. CloudFront's default domain gives free HTTPS; map 403/404 → `/index.html` (200) for React-Router SPA. Within credits ≈ **$0**. (Vercel Hobby remains a valid $0 alternative with less setup.) |
| **Database** | **MongoDB Atlas M0 (free)**, same region as Lightsail (e.g. `us-east-1`) | $0, off-AWS so it never touches credits. Atlas M0 is real MongoDB (unlike DocumentDB). Set `MONGODB_URI`; allow the Lightsail static IP in Atlas Network Access. |
| **File uploads** | **S3** via existing adapter (`STORAGE_DRIVER=s3`) | No code change — adapter already built (`server/utils/storage/s3.js`). Pennies. Avoids losing uploads on instance redeploy. |
| **Video** | **LiveKit Cloud free tier** | Managed media servers (media flows browser↔LiveKit, **not** through our box → zero AWS load). Server only mints JWTs via `livekit-server-sdk`. $0. Set `LIVEKIT_WS_URL/API_KEY/API_SECRET`. |
| **Code execution** | **Self-hosted Judge0 CE on the same 4GB box** (via the repo's `judge0-docker-compose.yml`) | **Chosen path:** unlimited executions, no external rate cap, no code change (existing `codeRun.js` works against a local Judge0 with no auth headers). Cost is the bigger box (4GB) + ops: privileged containers and a cgroup-v1 host tweak. Point `JUDGE0_API_URL` at the local container. |
| **AI / email** | Groq, Gemini, Tavily keys; Gmail app password | All free-tier/keys, just env vars. Graceful-degrade if omitted. |

> **Decision recorded:** self-host Judge0 to avoid the hosted free tier's **~50 exec/day** cap (which
> a single mock interview can exhaust). Tradeoff accepted: the 4GB box burns the **$100 credit in
> ~4 months** (vs ~$72/6mo on the 2GB+RapidAPI path). To reach the full 6 months, **complete the AWS
> onboarding tasks for up to $200 in credits** (~$150 used over 6 months — comfortably covered).
> The 2GB + RapidAPI free tier remains the fallback if you ever want to stretch the credit further —
> a config swap (`JUDGE0_API_URL` + 2 auth headers), not a redesign.

## Code changes — none required for the chosen path

Self-hosting Judge0 needs **no app-logic change**. `server/agent/services/codeRun.js` already calls
`${JUDGE0_API_URL}/submissions?...&wait=true` with no auth (`runSandboxed`, ~line 276), which is exactly
what a local Judge0 expects. Just set `JUDGE0_API_URL` to the in-compose Judge0 service and run with
`NODE_ENV=production` (so a Judge0 outage fails closed instead of falling back to unsandboxed local exec).

> Only the *fallback* (2GB + RapidAPI) would need the small change: read `JUDGE0_API_KEY`/`JUDGE0_API_HOST`
> and add `X-RapidAPI-Key`/`X-RapidAPI-Host` headers — and, if the free plan disables `wait=true`, a
> ~30-line submit-then-poll refactor. Not needed unless you switch off self-hosting.

## New deployment artifacts to create (no app-logic changes)

- `server/Dockerfile` — `node:20-slim` + Chromium runtime libs (so Puppeteer's bundled Chromium runs);
  `npm ci --omit=dev`; `CMD node server.js`. Launch flags already use `--no-sandbox --disable-dev-shm-usage`.
- `deploy/Caddyfile` — `your-sub.duckdns.org { reverse_proxy app:5000 }` (Caddy handles WS + TLS).
- `deploy/docker-compose.deploy.yml` — one stack on a shared compose network:
  `caddy` (ports 80/443, mounts Caddyfile) + `app` (built from `server/Dockerfile`, reads `server/.env`)
  + the **Judge0 services merged in from `judge0-docker-compose.yml`** (`judge0-server`, `judge0-workers`
  [both `privileged: true`], `db` Postgres, `redis`). Set `JUDGE0_API_URL=http://judge0-server:2358`
  in `server/.env`. Judge0's port need not be published to the host (internal to the network).
- `client` build is config-only: set `VITE_*` then `npm run build`.

## Implementation steps

1. **AWS account & credits** — confirm the $100 credit is active; set a **Budgets alarm at $50/$80**.
2. **Provision compute (+ verify credit draw first)** — Lightsail **4GB** Ubuntu instance; attach **static IP**;
   open firewall **80, 443, 22**; install Docker + Docker Compose. **Before building further**, let it run
   ~24h and confirm in Cost Explorer it draws from credits (net $0). If not, recreate on **EC2 t4g.medium**
   (fallback above). Also apply the **cgroup-v1 host tweak** Judge0's `isolate` needs (add
   `systemd.unified_cgroup_hierarchy=0` to the kernel cmdline in GRUB, then reboot).
3. **Database** — create Atlas **M0** cluster (same region); copy `MONGODB_URI`; add the Lightsail
   static IP to Network Access.
4. **Storage** — create an S3 bucket (uploads) + IAM user with least-priv `PutObject/GetObject` on it.
5. **External services** — LiveKit Cloud project (WS URL + key/secret); Groq/Gemini/Tavily keys;
   Gmail app password. (Judge0 is self-hosted in the compose stack — no external key.)
6. **DNS + TLS** — register the free DuckDNS subdomain → point it at the static IP; write `Caddyfile`.
7. **Backend deploy** — add `server/Dockerfile`, `deploy/Caddyfile`, `deploy/docker-compose.deploy.yml`
   (Caddy + app + Judge0 stack); create `server/.env` on the instance (matrix below, incl. `CLIENT_URL` =
   the CloudFront URL, `JUDGE0_API_URL=http://judge0-server:2358`, `NODE_ENV=production`);
   `docker compose -f deploy/docker-compose.deploy.yml up -d`.
8. **Frontend deploy** — set `VITE_API_URL=https://<sub>.duckdns.org/api` and
   `VITE_SOCKET_URL=https://<sub>.duckdns.org`; `npm run build`; sync `dist/` to S3; create CloudFront
   distribution (S3 origin, 403/404 → `/index.html`); note the `*.cloudfront.net` URL and set it as
   `CLIENT_URL` on the backend, then restart the backend.

## Environment variable matrix (backend `server/.env`)

| Var | Value / source | Required? |
|---|---|---|
| `NODE_ENV` | `production` | yes (fails Judge0 closed, etc.) |
| `PORT` | `5000` | default |
| `MONGODB_URI` | Atlas M0 SRV string | **required** |
| `JWT_SECRET` | strong random ≥16 chars | **required** |
| `CLIENT_URL` | CloudFront frontend URL (CORS/Socket.IO origin) | required for app to work |
| `SERVER_PUBLIC_URL` | `https://<sub>.duckdns.org` | recommended |
| `STORAGE_DRIVER` | `s3` | yes (uploads survive redeploys) |
| `S3_BUCKET/S3_REGION/S3_ACCESS_KEY_ID/S3_SECRET_ACCESS_KEY` | from step 4 | with `s3` |
| `LIVEKIT_WS_URL/LIVEKIT_API_KEY/LIVEKIT_API_SECRET` | LiveKit Cloud | for video |
| `JUDGE0_API_URL` | `http://judge0-server:2358` (self-hosted in compose) | for code-exec |
| `JUDGE0_API_KEY` / `JUDGE0_API_HOST` | *unused for self-host* — only for the RapidAPI fallback | fallback only |
| `GROQ_API_KEY` / `GEMINI_API_KEY` / `TAVILY_API_KEY` | provider keys | AI features |
| `EMAIL_USER` / `EMAIL_PASS` | Gmail app password | email |

Frontend (Vercel/CloudFront build-time, **inlined at build** — changing backend domain later needs a rebuild):
`VITE_API_URL`, `VITE_SOCKET_URL`.

## Verification (end-to-end)

1. `curl https://<sub>.duckdns.org/api/health` → `{ status: "ok" }` over **HTTPS** (proves Caddy+TLS).
2. Open the CloudFront URL → register/login works (proves CORS + REST + Atlas + JWT).
3. Browser devtools → confirm a **WSS** Socket.IO connection establishes (proves realtime/presence) and
   no mixed-content errors.
4. Generate a resume PDF → downloads (proves Puppeteer/Chromium on the 4GB box, alongside Judge0).
5. Upload a file → object appears in the S3 bucket (proves `STORAGE_DRIVER=s3`).
6. Start a live room → two browsers see/hear each other (proves LiveKit Cloud token + media).
7. Run a code snippet in the interview editor → output returns (proves the **self-hosted Judge0** stack
   + cgroup-v1 tweak; if it hangs/errors, check `isolate` cgroup permissions on the host first).
8. Deep-link a React-Router route (e.g. `/dashboard`) directly → loads, not 404 (proves SPA rewrite).
9. Check the AWS Budgets alarm and Lightsail metrics after a day of use.

## Budget summary & runway (the key number)

| Item | Monthly |
|---|---|
| Lightsail 4GB (app + Chromium + self-hosted Judge0) | $24 |
| S3 + CloudFront (uploads + frontend, light traffic) | ~$1–2 |
| Atlas M0 / LiveKit Cloud / AI keys / Gmail | $0 |
| **Effective burn** | **~$25/mo** |

**How long the credit lasts (bounded by min(credits ÷ burn, 6-month expiry)):**

| Credit | Runway |
|---|---|
| Base **$100** | ~**4 months** ($100 ÷ $25 = 4.0; 4.2 compute-only) |
| Full **$200** (claim onboarding tasks) | **full 6 months** (~$150 of $200 used; the 6-month expiry binds, not the money) |

> **Recommendation:** complete the AWS onboarding activities to unlock the extra credits (up to $200).
> That moves you from a tight ~4 months to the full 6-month window with margin to spare.
> Set a reminder ~2 weeks before the window/credit runs out to add a payment method (continue ~$25/mo)
> or migrate to PART B — otherwise the instance is suspended.
>
> *Need more runway on the base $100?* The 2GB + RapidAPI-Judge0 fallback drops burn to ~$13/mo
> (~$72/6mo) at the cost of the ~50 exec/day cap — a config swap, not a rebuild.

---

# PART B — Future Best Architecture (plan only — DO NOT implement now)

A rigid, cost-conscious, production AWS design for scale and reliability. Presented for reference;
no work to be done now.

```
 Route 53 ─► CloudFront (+ AWS WAF) ───────────────► S3   (frontend static, ACM cert)
                 │
                 └─► ALB (HTTPS, sticky sessions) ─► ECS Fargate service  (API + Socket.IO, ≥2 tasks)
                          │                                │
                          │                                ├─► ElastiCache Redis  (Socket.IO adapter — see code note)
                          │                                ├─► MongoDB Atlas (dedicated, on-AWS, VPC-peered)
                          │                                └─► S3 (uploads) + CloudFront (asset CDN)
                          │
                          ├─► EC2 Auto Scaling Group (privileged)  ── self-hosted Judge0 (isolate sandbox)
                          ├─► Lambda container (@sparticuz/chromium) ── resume-PDF render (isolates heavy Chromium)
                          └─► LiveKit Cloud (managed)  OR  EC2 SFU + coturn TURN (ASG)

 Cross-cutting: Secrets Manager/SSM · CloudWatch logs+alarms+X-Ray · ECR · GitHub Actions CI/CD · Terraform/CDK · VPC (public ALB / private compute+Redis)
```

## Component rationale
- **Frontend:** S3 + CloudFront + ACM + **WAF** (rate-limit, bot/OWASP rules). Custom domain via Route 53.
- **API / Socket.IO:** **ECS Fargate** behind an **ALB** with **sticky sessions**; ≥2 tasks across AZs;
  `/api/health` is the ALB health check (already exists). Fargate Spot for cost on non-critical capacity.
- **Database:** **MongoDB Atlas dedicated (M10+) on AWS**, VPC-peered, same region. *Avoid DocumentDB* as a
  drop-in — it emulates an older Mongo API and can break Mongoose aggregations/features used here; only
  consider it after a compatibility audit + migration testing.
- **Code execution:** self-hosted **Judge0 on EC2** in a private subnet via an **Auto Scaling Group**
  (Fargate/App Runner forbid the privileged containers `isolate` needs). Isolate behind a private ALB/SQS queue.
- **Resume PDF:** move Puppeteer into a **Lambda container image** (`@sparticuz/chromium`) or a dedicated
  render service, so heavy Chromium spikes don't compete with API/WS latency on the main tasks.
- **Realtime media:** **LiveKit Cloud** (managed, recommended) or self-hosted **LiveKit SFU on EC2** + a
  **coturn TURN** server (ASG) if data residency demands self-hosting.
- **Storage/CDN:** S3 + CloudFront for user assets; S3 lifecycle policies to tier/expire old artifacts.
- **Secrets/observability:** Secrets Manager (or SSM Parameter Store); CloudWatch metrics/logs/alarms
  (the app already emits structured logs with request IDs) + X-Ray traces.
- **CI/CD & IaC:** GitHub Actions → build/push images to **ECR** → ECS rolling deploy; frontend → S3 sync +
  CloudFront invalidation. Everything in **Terraform or CDK**.
- **Networking:** VPC with public subnets (ALB only) and private subnets (ECS/EC2/Redis); prefer **VPC
  endpoints** over a NAT gateway where possible (NAT is a steady hidden cost).

## Code changes required *before* this can scale (not just infra)
1. **Horizontal Socket.IO is a code change.** State is process-local today (CLAUDE.md + `socketHandler.js`
   in-memory `Map`s, no Redis adapter). Multi-task behind the ALB **requires** adding
   `@socket.io/redis-adapter` backed by **ElastiCache** *and* ALB **sticky sessions** — otherwise
   presence/rooms break across tasks. This is the single biggest "looks like infra, is actually code" trap.
2. **Move local file paths fully to S3** (already supported via `STORAGE_DRIVER=s3`) — no local-disk
   assumptions once tasks are ephemeral/replicated.
3. **Externalize the GD timers** (`setTimeout`s in `socketHandler.js` are in-memory, lost on restart) to a
   durable scheduler (e.g. a job queue) if room timing must survive deploys.

## Cost-control practices (rigid)
- AWS **Budgets** + anomaly alarms; tag everything for cost allocation.
- **Fargate Spot** + **Savings Plans/Reserved** for steady baseline.
- Single small **NAT** or NAT-less via **VPC endpoints**; right-size tasks from CloudWatch data.
- S3 lifecycle + CloudFront caching to cut egress; scale tasks to zero/minimum off-peak where feasible.

---

## Risks & gotchas (both parts)
- **Mixed content** (HTTPS frontend → HTTP backend) is the #1 silent failure — Caddy+DuckDNS (Part A) or
  ACM+ALB (Part B) is mandatory, not optional.
- **`VITE_*` are build-time inlined** — changing the backend domain later means a frontend rebuild.
- **Judge0 cgroup v2** (now a required setup step, since we self-host): `isolate` typically needs the
  host kernel on cgroup v1 (`systemd.unified_cgroup_hierarchy=0` in GRUB + reboot). Symptom if skipped:
  submissions hang or return internal errors. Verify code-exec works before calling the deploy done.
- **6-month credit cliff** — set a reminder to add billing or migrate before the free plan ends.
- **Atlas M0 limits** (512MB, shared) — fine for launch; plan the M10 jump in Part B.

## Sources
- [AWS Free Tier — $200 credits / 6-month free plan (2025-07)](https://aws.amazon.com/about-aws/whats-new/2025/07/aws-free-tier-credits-month-free-plan/)
- [AWS Free Tier docs](https://docs.aws.amazon.com/awsaccountbilling/latest/aboutv2/free-tier.html)
- [Lightsail free/billing FAQ](https://docs.aws.amazon.com/lightsail/latest/userguide/amazon-lightsail-frequently-asked-questions-faq-billing-and-account-management.html)
