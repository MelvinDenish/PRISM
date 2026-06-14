"""
PRISM GD AI Panelist — a portable LiveKit Agents voice worker.

It joins each PRISM Group-Discussion room (LiveKit room name `gd:<roomId>`) as a
participant named "Panelist", then acts as an HR / technical interviewer: it
greets the room, states the rules, runs the discussion, asks context-aware
follow-ups, and nudges quiet participants — all in a real, human voice.

Design goals (see ../.claude/plans + repo CLAUDE.md):
  * PORTABLE — no single-cloud lock-in. Every model is reachable over a generic,
    OpenAI-compatible HTTP endpoint configured via env, so this runs on any host
    (Render / Railway / Fly.io / DigitalOcean / Hetzner / k8s / a bare VM) and the
    GPU TTS can live on any serverless-GPU provider (Modal / RunPod) — or, as a
    zero-GPU on-ramp, on Groq's hosted TTS using the same GROQ_API_KEY.
  * GRACEFUL — the PRISM app never depends on this. If the worker is not deployed,
    the browser-TTS moderator in the client keeps working unchanged.

Pipeline:
    Whisper STT  →  LLM brain (Groq / any OpenAI-compatible)  →  streaming Orpheus TTS
    + Silero VAD + LiveKit turn-detector (semantic end-of-utterance)

NOTE: this file targets the LiveKit Agents 1.x API pinned in requirements.txt.
It is deployed-and-verified-by-you (it cannot run in CI without LiveKit creds and
a GPU/TTS endpoint). Confirm plugin import paths against the pinned version.
"""

import json
import logging
import os

from livekit import agents, rtc
from livekit.agents import Agent, AgentSession, JobContext, RoomInputOptions, WorkerOptions, cli
from livekit.plugins import openai, silero

# Native Groq plugin (optional) — used for Groq-hosted TTS, which speaks Groq's exact
# API shape. The generic openai.TTS plugin sends a `stream_format` field that Groq's
# /audio/speech rejects, so on the Groq on-ramp we use groq.TTS instead.
try:
    from livekit.plugins import groq as groq_plugin
except Exception:  # pragma: no cover - optional dependency
    groq_plugin = None

# The semantic turn-detector is optional; degrade to plain VAD if unavailable.
try:
    from livekit.plugins.turn_detector.english import EnglishModel  # type: ignore
    _TURN_DETECTION = EnglishModel()
except Exception:  # pragma: no cover - optional dependency
    _TURN_DETECTION = None

logger = logging.getLogger("prism-panelist")
logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"))

# Only act in PRISM Group-Discussion rooms. 1:1 mentorship rooms are `session:<id>`.
GD_ROOM_PREFIX = "gd:"

# ── Provider-agnostic model endpoints (all OpenAI-compatible) ──────────────────
# Brain (LLM): Groq by default; point LLM_BASE_URL elsewhere to swap providers.
LLM_BASE_URL = os.getenv("LLM_BASE_URL", "https://api.groq.com/openai/v1")
LLM_API_KEY = os.getenv("LLM_API_KEY") or os.getenv("GROQ_API_KEY", "")
LLM_MODEL = os.getenv("LLM_MODEL", "llama-3.3-70b-versatile")

# Ears (STT): Groq-hosted Whisper by default (same key, no GPU).
STT_BASE_URL = os.getenv("STT_BASE_URL", "https://api.groq.com/openai/v1")
STT_API_KEY = os.getenv("STT_API_KEY") or os.getenv("GROQ_API_KEY", "")
STT_MODEL = os.getenv("STT_MODEL", "whisper-large-v3-turbo")

# Voice (TTS): a streaming Orpheus endpoint (self-hosted on serverless GPU) OR, as
# a zero-GPU on-ramp, Groq-hosted Orpheus/PlayAI on the same key. Both speak the
# OpenAI `/v1/audio/speech` shape, so only the base URL + model + voice change.
TTS_BASE_URL = os.getenv("TTS_BASE_URL") or os.getenv("TTS_ENDPOINT_URL", "https://api.groq.com/openai/v1")
TTS_API_KEY = os.getenv("TTS_API_KEY") or os.getenv("GROQ_API_KEY", "")
# Groq's TTS is Orpheus (playai-tts was decommissioned). NOTE: the Orpheus model is
# gated — your Groq org admin must accept its terms once at
# https://console.groq.com/playground?model=canopylabs%2Forpheus-v1-english
# (or set TTS_PROVIDER=openai + TTS_BASE_URL to a self-hosted Orpheus endpoint).
TTS_MODEL = os.getenv("TTS_MODEL", "canopylabs/orpheus-v1-english")
TTS_VOICE = os.getenv("TTS_VOICE", "troy")
# "groq" (native Groq TTS — the zero-GPU on-ramp) or "openai" (any OpenAI-compatible
# /v1/audio/speech endpoint, e.g. a self-hosted streaming Orpheus on serverless GPU).
TTS_PROVIDER = os.getenv("TTS_PROVIDER", "groq").lower()


def build_tts():
    """Pick the TTS backend. Groq needs its native plugin (its /audio/speech rejects
    the openai plugin's `stream_format`); self-hosted Orpheus uses the openai plugin."""
    if TTS_PROVIDER == "groq" and groq_plugin is not None:
        return groq_plugin.TTS(model=TTS_MODEL, voice=TTS_VOICE)
    return openai.TTS(model=TTS_MODEL, voice=TTS_VOICE, base_url=TTS_BASE_URL, api_key=TTS_API_KEY)


PANELIST_INSTRUCTIONS = """\
You are the panel member for a campus-placement Group Discussion — think experienced
HR + technical interviewer rolled into one. You are speaking out loud, so keep every
turn short, natural and conversational (1-3 sentences). Never read markdown or lists
aloud.

Your job, in order:
1. GREET the group warmly and STATE THE RULES clearly and briefly: this is a timed
   group discussion on the given topic; everyone should state their view early, back
   it with a reason and an example, build on or politely counter others, and make
   sure everyone gets a turn. Then invite someone to open.
2. MODERATE: listen to the participants, ask short context-aware follow-up questions,
   probe weak claims, and keep the discussion on the topic.
3. BALANCE participation: if someone has not spoken, invite them BY NAME. If one
   person dominates, gently bring in others.
4. Near the end, ask for brief conclusions and then wrap up.

Fairness guardrails: stay professional and unbiased; judge only what people actually
say; never invent contributions; never fabricate personal data; do not give numeric
scores out loud (per-participant scoring is handled separately by the app).
"""


async def entrypoint(ctx: JobContext):
    # Only handle GD rooms; quietly ignore anything else (e.g. 1:1 mentorship).
    if not str(ctx.room.name or "").startswith(GD_ROOM_PREFIX):
        logger.info("Ignoring non-GD room %s", ctx.room.name)
        return

    await ctx.connect()
    logger.info("Panelist joined room %s", ctx.room.name)

    # The host client publishes the revealed topic over the LiveKit data channel
    # (topic "gd-meta"). Capture it so the opener can name the real topic; fall back
    # to a generic opener if none arrives.
    state = {"topic": "", "duration_min": 10}

    def _on_data(packet: rtc.DataPacket):
        try:
            if packet.topic and packet.topic != "gd-meta":
                return
            msg = json.loads(bytes(packet.data).decode("utf-8"))
            if msg.get("type") == "gd-topic" and msg.get("topic"):
                state["topic"] = str(msg["topic"])[:500]
                state["duration_min"] = int(msg.get("durationMin") or 10)
                logger.info("Received GD topic: %s", state["topic"])
        except Exception as exc:  # pragma: no cover
            logger.debug("Ignoring data packet: %s", exc)

    ctx.room.on("data_received", _on_data)

    session = AgentSession(
        stt=openai.STT(model=STT_MODEL, base_url=STT_BASE_URL, api_key=STT_API_KEY),
        llm=openai.LLM(model=LLM_MODEL, base_url=LLM_BASE_URL, api_key=LLM_API_KEY),
        tts=build_tts(),
        vad=silero.VAD.load(),
        turn_detection=_TURN_DETECTION,
    )

    await session.start(
        room=ctx.room,
        agent=Agent(instructions=PANELIST_INSTRUCTIONS),
        # The agent hears the room and the turn-detector handles end-of-turn. NOTE:
        # per-speaker attribution (tagging which participant said what) is NOT yet
        # configured here — it's a future enhancement. It is not required for the
        # current build: per-participant scoring stays on the PRISM server's existing
        # /api/gd-rooms/:id/evaluate, which scores each user from their OWN mic.
        room_input_options=RoomInputOptions(),
    )

    # Give the host's topic packet a moment to arrive, then open with the rules.
    topic = state["topic"]
    opener = (
        f"Greet the group, then state the discussion rules clearly and briefly, and "
        f"invite someone to open. Today's topic is: {topic}. The discussion lasts about "
        f"{state['duration_min']} minutes."
        if topic
        else "Greet the group, state the discussion rules clearly and briefly, then ask "
        "the participants what topic they would like to discuss and invite someone to open."
    )
    await session.generate_reply(instructions=opener)


if __name__ == "__main__":
    # No `agent_name` → AUTOMATIC dispatch: the worker is offered every new room and
    # the entrypoint self-filters to `gd:` rooms (ignoring 1:1 `session:` rooms). This
    # is what makes the panelist join GDs with ZERO PRISM-server change. (To switch to
    # explicit, server-triggered dispatch later, set agent_name and dispatch on start.)
    cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint))
