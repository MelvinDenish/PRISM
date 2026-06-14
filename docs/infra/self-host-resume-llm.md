# Self-hosting the Resume-Generator LLM

PRISM's AI resume generator (Generative Resume) talks to any **OpenAI-compatible**
`/chat/completions` endpoint. By default it uses **Groq** (free, fast, and it does
**not** train on your data). This doc covers the *self-hosted* option from the plan
— own/rent the compute so inference is private and free at scale — and the exact
config to point PRISM at it with **no code change**.

> Switching providers is purely environment config (see [§ Wiring PRISM](#wiring-prism)).
> The resume pipeline reads `RESUME_LLM_*`; everything else (the copilot) is untouched.

---

## 1. Which model + how much compute (price/size tiers)

VRAM is for **4-bit (Q4_K_M)** quantization, which is the practical sweet spot for
self-hosting. Rule of thumb: ~0.6 GB VRAM per 1B params at Q4, plus KV cache.

| Tier | Best model (code/HTML) | Params | VRAM (Q4) | GPU that runs it | Cloud on-demand (2026, cheapest neocloud / spot) |
|------|------------------------|--------|-----------|------------------|--------------------------------------------------|
| **S0 — budget** | `qwen2.5-coder:7b` | 7B | ~6–9 GB | RTX 3060 12G / 4060 / L4 / T4 | RunPod/Vast **$0.20–0.40/hr** |
| **S1 — sweet spot ⭐** | `qwen2.5-coder:32b` | 32B | ~22–24 GB | **RTX 4090 / 3090 (24G)**, A10G | Vast/RunPod RTX 4090 **$0.31–0.69/hr**; AWS `g5.xlarge` (A10G) ~$1/hr |
| **S2 — high quality** | `llama3.3:70b` | 70B | ~42–48 GB | L40S-48G / A6000-48G / A100-80G | L40S **$0.50–1.5/hr**; A100-80G **$0.60 spot–$1.99/hr** |
| **S3 — frontier** | `deepseek-v3` | 671B (MoE) | multi-GPU (≈8×80G) | 8×A100/H100 node | 8×H100 **~$8–20/hr** (overkill for resumes) |

**Recommended: S1 — Qwen2.5-Coder 32B.** Best HTML/CSS quality you can run on a
single 24 GB consumer GPU; Apache-2.0; private; free inference once the box exists.
Hyperscalers (AWS/GCP/Azure) typically cost 30–60% more than neoclouds (RunPod,
Lambda, Vast.ai) for the same GPU.

### Break-even vs. a paid API
A paid call (e.g. Gemini 3 Flash ~$0.50/$3 per 1M tok) costs roughly **$0.01–0.03
per resume** (content + design + repairs ≈ 6–10K tokens). An S1 cloud GPU at ~$0.50/hr
that generates ~1 resume/min ≈ **$0.008/resume** only when busy — so self-hosting wins
**only at sustained volume** (e.g. placement season) or when **privacy/offline** is the
requirement. For low/bursty volume, **Groq free** or **serverless GPU** (below) is cheaper.

---

## 2. Where to run it

- **Local / on-prem (best for a college):** a one-time ~RTX 4090 workstation runs the
  S1 model → free + fully private forever. Use **Ollama** (simplest) or **vLLM** (faster
  under load).
- **Serverless GPU (best for bursty student traffic):** RunPod Serverless / Modal —
  pay-per-second, **scale-to-zero**, no idle cost. Expose an OpenAI-compatible endpoint.
- **Dedicated cloud VM (steady load):** AWS `g5`/`g6` or a neocloud instance from the
  table above.

### Serving engine
- **Ollama** — one command, runs anywhere (laptop → server), OpenAI-compatible at
  `http://localhost:11434/v1`. Best for dev / single-user.
- **vLLM** — ~2.3–3× Ollama throughput via PagedAttention + continuous batching;
  OpenAI-compatible. Best for production / many concurrent students.
- **TGI is in maintenance mode (2026) — do not use it for new deployments.**

---

## 3. Quick start

### Option A — Ollama (dev / single GPU)
See [`ollama/`](./ollama/). On a host with the GPU + [Ollama](https://ollama.com) installed:

```bash
ollama pull qwen2.5-coder:32b          # ~20 GB download (Q4)
ollama serve                            # OpenAI-compatible at http://localhost:11434/v1
# optional: a tuned variant (bigger context, lower temp) from the Modelfile:
ollama create prism-resume -f ollama/Modelfile
```

Or with Docker: `docker compose -f ollama/docker-compose.yml up -d` then exec the pull.

### Option B — vLLM (production)
See [`vllm/`](./vllm/). Needs an NVIDIA GPU + drivers + NVIDIA Container Toolkit:

```bash
docker compose -f vllm/docker-compose.yml up -d
# Serves an OpenAI-compatible API at http://localhost:8000/v1
# Set VLLM_API_KEY in the compose file and reuse it as RESUME_LLM_API_KEY.
```

---

## 4. Wiring PRISM

Add to `server/.env` (these override the Groq default only for the resume pipeline):

```bash
# Point at your self-hosted OpenAI-compatible server:
RESUME_LLM_BASE_URL=http://localhost:11434/v1     # Ollama (or http://localhost:8000/v1 for vLLM)
RESUME_LLM_API_KEY=ollama                          # Ollama ignores it; vLLM uses VLLM_API_KEY

# Use ONE self-hosted model for both stages (32B handles content + design well):
RESUME_DESIGN_MODEL=qwen2.5-coder:32b              # Ollama tag (or "Qwen/Qwen2.5-Coder-32B-Instruct" for vLLM)
RESUME_CONTENT_MODEL=qwen2.5-coder:32b
```

Restart the server. No code changes — `config.resumeLlm*()` reads these and the
`llm.chat({ baseUrl, apiKey, model })` override targets your endpoint. Revert by
removing the four vars (falls back to Groq / `GROQ_API_KEY`).

**Verify:**
```bash
node -e "require('dotenv').config();const{config}=require('./config/env');console.log(config.resumeLlmBaseUrl(),config.resumeDesignModel())"
```
Then generate a resume in the app — it now runs on your hardware.
