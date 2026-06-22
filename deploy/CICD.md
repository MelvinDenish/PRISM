# CI/CD — automated test + deploy

Defined in [.github/workflows/ci-cd.yml](../.github/workflows/ci-cd.yml).

## What runs when
- **Every PR / push to `main`** → `client` (ESLint + Vite build) and `server`
  (boots the real server against a MongoDB service container and runs the auth
  integration test in `server/test/smoke.test.js`).
- **Push to `main`, after both pass** → `deploy` SSHes into the Lightsail box,
  pulls `main`, writes `server/.env` + `deploy/.env` from secrets, and runs
  `docker compose -f docker-compose.deploy.yml up -d --build`.
- **After deploy** → `verify` polls `https://<domain>/api/health` from GitHub.

So after the one-time setup below, **shipping = merge to `main`**. No SSH.

## One-time GitHub secrets
Repo → **Settings → Secrets and variables → Actions → New repository secret**:

| Secret | Value |
|---|---|
| `LIGHTSAIL_HOST` | `15.207.96.175` |
| `LIGHTSAIL_USER` | `ubuntu` |
| `LIGHTSAIL_SSH_KEY` | The **private key** for the box. Lightsail console → **Account → SSH keys → Download** the default key (a `.pem`); paste its full contents (`-----BEGIN ... END-----`). |
| `SERVER_ENV` | Full contents of `server/.env` (see template in `server.env.production.example`). Must include `MONGODB_URI`, `JWT_SECRET`, `SERVER_PUBLIC_URL=https://prism-project.duckdns.org`, `JUDGE0_API_URL=http://judge0-server:2358`, plus S3 / LiveKit / AI keys as available. Set `CLIENT_URL` to the CloudFront URL once the frontend is up. |
| `DEPLOY_ENV` | Two lines: `BACKEND_DOMAIN=prism-project.duckdns.org` and `ACME_EMAIL=lmelvindenish@gmail.com` |

> `LIGHTSAIL_HOST`, `LIGHTSAIL_USER`, and `DEPLOY_ENV` are pre-set for you — you
> only need to add **`LIGHTSAIL_SSH_KEY`** and **`SERVER_ENV`**.

Optional repo **variable** `BACKEND_DOMAIN` (Variables tab) overrides the health-check
domain; defaults to `prism-project.duckdns.org`.

## How env reaches the box
`server/.env` is **not** in git. The deploy job recreates it from `SERVER_ENV` on
every run, so updating config = edit the secret + re-run the workflow. The box's
`git reset --hard origin/main` means the box always matches `main` exactly.

## First deploy / manual deploy
Add the secrets, then **Actions → CI/CD → Run workflow** on `main` (or just push to
`main`). The deploy job clones the repo on the box if it isn't there yet, so it works
even on a fresh instance.

## Local test run
```bash
cd server
MONGODB_URI=mongodb://localhost:27017/prism_ci JWT_SECRET=dev-secret-16chars-min npm test
```
