---
name: prism-agentic-assistant
description: PRISM Copilot — the agentic chat-assistant feature, its architecture and how to verify it
metadata:
  type: project
---

PRISM is adding **PRISM Copilot**, an agentic chat assistant that orchestrates the
existing features (roadmaps, mentor booking, resume analyze+rewrite, nav/Q&A) so the
chat becomes the primary surface (mentees land on `/assistant`; tabs retained).

Architecture (additive, not a rewrite):
- `server/agent/llm.js` — provider-agnostic OpenAI-compatible client via plain `fetch` to `{baseURL}/chat/completions` (NOT groq-sdk — it injects a `/openai/v1` path prefix that 404s on OpenRouter). Swap provider/model via `LLM_*` env. OpenRouter VERIFIED working with `openai/gpt-oss-120b:free` (tool-calling). `runAgent.js` salvages Llama `<function=…>` malformed tool calls. When `LLM_BASE_URL` is OpenRouter, `LLM_API_KEY` is required (no Groq fallback).
- `server/agent/runAgent.js` — bounded tool loop; **write tools propose, never mutate** (confirm gate); prompt-injection guard treats pasted docs as data.
- `server/agent/tools.js` — registry (`kind: read|write`, `roles`). `server/agent/services/*` hold logic SHARED with the HTTP routes (learningPaths/mentorship/resumeAnalysis routes were refactored to call these services).
- `routes/assistant.js` — `POST /chat` (runs loop) + `POST /confirm` (EXECUTORS dispatch by action type, re-validate server-side).
- Client: `pages/Assistant.jsx` + `components/chat/*` (ChatMessage link renderer, ProposalCard confirm button).

**Why:** reduce UX complexity — one chat front-door over ~65 endpoints.
**How to apply:** add a capability by adding a service fn + a tool entry (+ an EXECUTOR for writes); never call the LLM with the old `utils/aiModels.js` for the agent.

**Verification:** proven live (2026-06-11) against local Docker Mongo (see [[dev-db-setup]]) with real Groq tool-calling — read tools (`list_topics`, `get_my_progress`, `find_mentors`+`get_mentor_availability`) return grounded answers with deep-links. Run live with `MONGODB_URI="mongodb://127.0.0.1:27017/prism" node <script>` + sandbox disabled (Atlas is dead). Write/confirm path covered by a stubbed-LLM loop test. Plan: `~/.claude/plans/so-this-project-snug-blanket.md`.
