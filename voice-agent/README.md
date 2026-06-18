# PRISM GD AI Panelist (`voice-agent`)

A portable [LiveKit Agents](https://docs.livekit.io/agents/) worker that joins each
PRISM Group-Discussion room as a real, human-sounding **AI panelist**: it greets the
group, states the rules, runs the discussion as an HR / technical interviewer, asks
context-aware follow-ups, and nudges quiet participants by name.

It is **optional and decoupled**. If you don't deploy it, PRISM's existing
browser-TTS GD moderator keeps working unchanged — the client only defers to this
agent when it detects a participant whose identity starts with `panelist`.

> ⚠️ **Deploy-and-verify-by-you.** This service needs LiveKit credentials, model
> endpoints, and (optionally) a GPU, so it can't be exercised in the PRISM CI/build.
> The code targets the LiveKit Agents version pinned in `requirements.txt`; confirm
> plugin import paths against that version before deploying.

## Architecture

```
participants' mic ─▶ Whisper STT ─▶ LLM brain (Groq/any) ─▶ streaming Orpheus TTS ─▶ room audio
                         + Silero VAD + LiveKit turn-detector (semantic end-of-turn)
```

Everything is reached over **generic, OpenAI-compatible HTTP endpoints** (configured
in `.env`), so there is **no single-cloud lock-in** — host the worker anywhere and put
the GPU TTS on any provider.

## How it integrates with PRISM (no server change required)

- The PRISM GD video runs on LiveKit; rooms are named **`gd:<roomId>`**. This worker
  self-filters to those rooms and ignores `session:*` (1:1 mentorship) rooms.
- It mints its own LiveKit join token from `LIVEKIT_API_KEY/SECRET`, so the PRISM
  server is untouched.
- The host's browser publishes the revealed **topic** over the LiveKit data channel
  (data topic `gd-meta`, payload `{"type":"gd-topic","topic":...,"durationMin":...}`);
  the agent reads it to open on the real topic (and falls back to a generic opener).
- The PRISM client (`GdModerator.jsx`) detects this agent and (a) stops its own
  browser TTS so there's no double-speak and (b) excludes the agent from the
  speaking-time stats. **Per-participant scoring is unchanged** — each user is still
  evaluated from their own mic transcript via `POST /api/gd-rooms/:id/evaluate`.

## Run locally

```bash
cd voice-agent
python -m venv .venv && . .venv/bin/activate     # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env                              # fill in LiveKit + keys
python agent.py download-files                    # cache VAD / turn-detector weights
python agent.py dev                               # connects and waits for GD rooms
```

Start a Group Discussion in PRISM; the panelist should join `gd:<roomId>` and open
with the rules in a human voice.

> 🚀 **Deploy reminder (local vs AWS):** local/dev uses **Kokoro** (CPU, no key, no rate
> limit). When deploying to **AWS/production, switch back to Orpheus** (self-hosted on a
> GPU) — a one-line env change: `TTS_PROVIDER` / `TTS_BASE_URL` / `TTS_MODEL` / `TTS_VOICE`.
> (Groq-hosted Orpheus free tier is too rate-limited — `429` — for real conversations.)

## Voice (TTS) options — pick by cost/portability

| Option | Voice | Cost | Notes |
| --- | --- | --- | --- |
| **Groq-hosted Orpheus/PlayAI** (default) | human, expressive | free/cheap dev tier | **zero GPU** — same `GROQ_API_KEY`. Best on-ramp. |
| **Self-hosted streaming Orpheus on serverless GPU** (Modal / RunPod) | human, sub-200 ms TTFB | pay-per-second, **idle = $0**; weights free-forever | Point `TTS_BASE_URL` at your OpenAI-compatible `/v1/audio/speech`. Cheapest at scale, fully portable. |
| **Self-hosted Sesame CSM** | most natural conversational | GPU | Alternate voice; expose the same OpenAI-compatible shape. |

Switching is just `TTS_BASE_URL` / `TTS_MODEL` / `TTS_VOICE` in `.env` — no code change.

## Deploy (any host)

```bash
docker build -t prism-voice-agent .
docker run --env-file .env prism-voice-agent
```

Runs as a long-lived CPU-only worker (the models are remote). Deploy the image on
Fly.io / Render / Railway / DigitalOcean / Hetzner / k8s / a VM. For the self-hosted
TTS, deploy a separate serverless-GPU function (Modal / RunPod) that scales to zero
and exposes `/v1/audio/speech`; set `TTS_BASE_URL` to it.

## Gotchas (found while deploy-testing in Docker)

1. **Groq Orpheus is terms-gated.** `playai-tts` is decommissioned; the current Groq
   TTS is `canopylabs/orpheus-v1-english`, which returns `400 model_terms_required`
   until your **Groq org admin accepts the terms once** at
   <https://console.groq.com/playground?model=canopylabs%2Forpheus-v1-english>.
   No-terms alternative: `TTS_PROVIDER=openai` + a self-hosted Orpheus endpoint.
2. **Local LiveKit + Docker = use host networking.** A dev LiveKit with
   `rtc.node_ip: 127.0.0.1` advertises a loopback ICE candidate the agent *container*
   can't reach, so WebRTC media times out (`wait_pc_connection timed out`). Run the
   container with `--network host -e LIVEKIT_URL=ws://localhost:7880`. In production
   (LiveKit with a routable IP / `use_external_ip: true`) this isn't needed.

Verified in Docker against a local LiveKit: image build, plugin load, worker
registration, dispatch into `gd:` rooms, WebRTC media (with host networking), and the
LLM greeting all work; the only remaining step to hear audio is accepting the Orpheus
terms above (or pointing at a self-hosted Orpheus).

## Env

See `.env.example`. Required: `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`,
and a brain key (`GROQ_API_KEY` or `LLM_API_KEY`). STT/TTS default to Groq-hosted
(`TTS_PROVIDER=groq`); set `TTS_PROVIDER=openai` + `TTS_BASE_URL` for self-hosted Orpheus.
