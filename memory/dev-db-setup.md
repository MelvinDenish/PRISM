---
name: dev-db-setup
description: How to run PRISM locally — the Atlas cluster is dead, use local Docker Mongo
metadata:
  type: project
---

The `MONGODB_URI` in `server/.env` points at Atlas cluster `clusterforprism.nvsgdsg.mongodb.net`, which is **dead** (SRV record returns NXDOMAIN — deleted, not paused). The server `process.exit`s on DB failure, so it won't boot against `.env` as-is.

**To run locally:** a Docker `mongo:7` container named `prism-mongo` runs on `127.0.0.1:27017`. Start the server with an env override (dotenv uses `override:false`, so a pre-set var wins over `.env`):
```
MONGODB_URI="mongodb://127.0.0.1:27017/prism" npm run dev
```
Seed it first: `MONGODB_URI=... node seeds/seedAll.js` then `node seeds/seedQuestionBank.js`. Seed login: any seeded email + `password123` (e.g. `aditya@prism.dev` mentee, `rahul.mentor@prism.dev` mentor, `admin@prism.dev` admin).

**Gemini key is quota-exhausted** (429, free tier limit:0) → Resume ATS Analysis returns a broken 0% result. GROQ key is valid. See `deliverables/PRISM_Runtime_Test_Report.md` (E1, E2, R1).
