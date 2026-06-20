# PRISM — AWS Deploy Runbook (Part A)

Operational steps for the minimal-cost, all-AWS deploy in
[docs/deployment/2026-06-20-aws-deployment-plan.md](../docs/deployment/2026-06-20-aws-deployment-plan.md).

**Architecture:** one Lightsail 4GB box runs Caddy (TLS/WSS) → Node app (+ Chromium) and a
self-hosted Judge0 stack, all via [docker-compose.deploy.yml](docker-compose.deploy.yml). The frontend
is static on **S3 + CloudFront**. MongoDB is **Atlas M0**, uploads are **S3**, video is **LiveKit Cloud**.

The repo artifacts are ready. The steps below are the AWS-console + on-box actions you run (they need
your AWS account, so they can't be automated from here).

---

## 0. Prerequisites
- New AWS account with the **$100 free-tier credit** active.
- A GitHub clone URL for this repo (or use `scp` to copy the tree to the box).

---

## 1. Compute — Lightsail 4GB (verify credit draw FIRST)
1. Lightsail → **Create instance** → Linux/Unix → **Ubuntu 22.04** → **$24/mo (4 GB / 2 vCPU)**.
2. **Networking** → attach a **Static IP** (free while attached).
3. **Firewall** → allow **TCP 22, 80, 443** (and IPv6 if used).
4. SSH in, then install Docker + Compose and apply the **cgroup v1** tweak Judge0's `isolate` needs:
   ```bash
   curl -fsSL https://get.docker.com | sudo sh
   sudo usermod -aG docker ubuntu
   # Judge0 isolate requires cgroup v1:
   sudo sed -i 's/GRUB_CMDLINE_LINUX="\(.*\)"/GRUB_CMDLINE_LINUX="\1 systemd.unified_cgroup_hierarchy=0"/' /etc/default/grub
   sudo update-grub && sudo reboot
   ```
5. **⚠ Before building anything else:** let the instance run ~24h, then open **Cost Explorer** and confirm
   it shows **$0 net** (drawn from credits). If Lightsail is *not* covered by your credits, recreate on
   **EC2 t4g.medium** (4 GB) + Elastic IP instead — same Docker steps from here on.

## 2. Database — MongoDB Atlas M0 (free)
1. Create a free **M0** cluster in the **same region** as the box (e.g. `us-east-1`).
2. **Database Access** → add a user/password.
3. **Network Access** → add the Lightsail **static IP** (or `0.0.0.0/0` to start).
4. **Connect → Drivers** → copy the SRV string → this is `MONGODB_URI`.

## 3. Storage — S3 bucket for uploads
1. Create a private S3 bucket (same region).
2. Create an IAM user with least-priv `s3:PutObject` / `s3:GetObject` on `arn:aws:s3:::YOUR_BUCKET/*`.
3. Save the access key id/secret → `S3_*` env vars.

## 4. External services (keys only)
- **LiveKit Cloud** → create a project (free tier) → copy **WS URL (`wss://…`)**, **API key**, **API secret**.
- **Groq / Gemini / Tavily** API keys (optional; features degrade without them).
- **Gmail** App Password for SMTP (optional).

## 5. DNS + TLS — free DuckDNS subdomain
1. At [duckdns.org](https://www.duckdns.org), create a subdomain (e.g. `prism-api`).
2. Set its IP to the Lightsail **static IP** → gives `prism-api.duckdns.org`.
3. Caddy will auto-issue the Let's Encrypt cert on first boot (no manual cert steps).

## 6. Backend — deploy the stack on the box
```bash
git clone <YOUR_REPO_URL> prism && cd prism

# Backend config:
cp deploy/server.env.production.example server/.env
nano server/.env        # MONGODB_URI, JWT_SECRET, CLIENT_URL (fill after step 7),
                        # SERVER_PUBLIC_URL=https://prism-api.duckdns.org, S3_*, LIVEKIT_*, keys
                        # (leave JUDGE0_API_URL=http://judge0-server:2358)

# Caddy domain/email:
printf 'BACKEND_DOMAIN=prism-api.duckdns.org\nACME_EMAIL=you@example.com\n' > deploy/.env

cd deploy
docker compose -f docker-compose.deploy.yml up -d --build
docker compose -f docker-compose.deploy.yml ps
```
Check TLS + health: `curl https://prism-api.duckdns.org/api/health` → `{"status":"ok",...}`.

> First Judge0 boot runs DB migrations and can take a minute. If code-exec errors at first, give it a
> moment, then re-test. If it keeps failing, recheck the **cgroup v1** step.

## 7. Frontend — S3 + CloudFront (static SPA)
Build locally (or in CI), pointing the SPA at the backend's HTTPS domain. **`VITE_*` are inlined at
build time** — changing the backend domain later needs a rebuild.
```bash
cd client
echo 'VITE_API_URL=https://prism-api.duckdns.org/api'  > .env.production
echo 'VITE_SOCKET_URL=https://prism-api.duckdns.org'  >> .env.production
npm ci && npm run build          # → client/dist

aws s3 sync dist s3://YOUR_FRONTEND_BUCKET --delete
```
CloudFront distribution:
- Origin = the frontend S3 bucket (use **Origin Access Control**, keep the bucket private).
- **Custom error responses:** map **403** and **404** → response path **`/index.html`**, HTTP **200**
  (React Router SPA deep-links).
- Default root object: `index.html`. Note the `*.cloudfront.net` URL.

## 8. Wire the frontend origin into CORS, then restart
On the box, set `CLIENT_URL` in `server/.env` to the CloudFront URL (e.g. `https://dXXXX.cloudfront.net`),
then:
```bash
cd deploy && docker compose -f docker-compose.deploy.yml up -d
```

---

## Verification (end-to-end)
1. `curl https://prism-api.duckdns.org/api/health` → ok over **HTTPS**.
2. Open the CloudFront URL → register/login (REST + Atlas + JWT + CORS).
3. DevTools → a **WSS** Socket.IO connection opens, no mixed-content errors.
4. Generate a resume PDF → downloads (Puppeteer/Chromium).
5. Upload a file → object appears in the S3 bucket.
6. Start a live room in two browsers → audio/video connects (LiveKit Cloud).
7. Run a code snippet → output returns (self-hosted Judge0).
8. Deep-link a route (e.g. `/dashboard`) → loads, not 404 (SPA rewrite).
9. AWS **Budgets** alarm set ($50/$80); check Lightsail metrics after a day.

## Operations
```bash
cd deploy
docker compose -f docker-compose.deploy.yml logs -f app        # app logs
docker compose -f docker-compose.deploy.yml logs -f caddy      # TLS / proxy
docker compose -f docker-compose.deploy.yml up -d --build      # redeploy after git pull
docker compose -f docker-compose.deploy.yml down               # stop (keeps volumes/certs)
```
**Cost runway:** ~$25/mo → base $100 lasts ~4 months; claim the AWS onboarding tasks (up to $200) for the
full 6-month window. Set a reminder ~2 weeks before the credit/window ends to add billing or migrate.
