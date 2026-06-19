/**
 * Centralized environment configuration & boot-time validation.
 *
 * Phase 0 foundation (see plan §4): the server must refuse to start if a
 * REQUIRED variable is missing, and must clearly warn when an OPTIONAL,
 * feature-gating variable is absent (the related feature is then disabled).
 *
 * Dependency-free on purpose — boot safety should not wait on the team's
 * choice of a schema library (zod/envalid). New code should import `config`
 * from here instead of reading `process.env` directly.
 */

require('dotenv').config();

// --- Schema ---------------------------------------------------------------
// required: server exits if unset.
// default:  used when unset (never fatal).
// feature:  optional; when unset the named capability is disabled (warn only).
const SCHEMA = {
  MONGODB_URI: { required: true, secret: true },
  JWT_SECRET: { required: true, secret: true, minLength: 16 },

  JWT_EXPIRE: { default: '7d' },
  PORT: { default: '5000' },
  CLIENT_URL: { default: 'http://localhost:5173' },
  NODE_ENV: { default: 'development' },
  JUDGE0_API_URL: { default: 'http://localhost:2358' },

  GROQ_API_KEY: { feature: 'AI features (interview, game, GD, resume, summarize, learning paths)', secret: true },
  // Model routing: cheap model for generation, stronger model for graded feedback
  // (B1). Both have defaults so unset never blocks boot; override per deployment.
  GROQ_GEN_MODEL: { default: 'llama-3.1-8b-instant' },
  GROQ_EVAL_MODEL: { default: 'llama-3.3-70b-versatile' },

  // Agentic assistant ("PRISM Copilot") — a provider-agnostic, OpenAI-compatible
  // LLM client (tool/function calling). Provider + model are swappable per
  // deployment: point LLM_BASE_URL at Groq / Together / Fireworks / OpenRouter /
  // DeepInfra and set the model names accordingly. When LLM_API_KEY is unset we
  // fall back to GROQ_API_KEY so the assistant works out-of-the-box on the existing
  // Groq setup; when BOTH are unset, the assistant is disabled (warn only).
  LLM_API_KEY: { feature: 'Agentic assistant (PRISM Copilot); falls back to GROQ_API_KEY when unset', secret: true },
  LLM_BASE_URL: { default: '' }, // empty => Groq default endpoint
  // Orchestrator must be a strong tool-caller (anchor: Berkeley Function-Calling
  // Leaderboard). Default to a 70B-class open model that supports tool use on Groq.
  LLM_ORCHESTRATOR_MODEL: { default: 'llama-3.3-70b-versatile' },
  LLM_GEN_MODEL: { default: 'llama-3.3-70b-versatile' },
  LLM_FAST_MODEL: { default: 'llama-3.1-8b-instant' },

  // Multi-provider failover pool (free, OpenAI-compatible). The non-PII "fast"
  // pool fans across these providers and fails over on 429/5xx/timeout. BOTH keys
  // are optional — an absent key simply drops that provider from the pool, so unset
  // = today's Groq-only behavior (graceful degradation). PII routes (resume) NEVER
  // use Cerebras/OpenRouter: those free tiers may train on inputs (student PII).
  CEREBRAS_API_KEY: { feature: 'Cerebras in the non-PII failover pool (fastest). Skipped when unset', secret: true },
  CEREBRAS_BASE_URL: { default: 'https://api.cerebras.ai/v1' },
  OPENROUTER_API_KEY: { feature: 'OpenRouter in the non-PII failover pool (model diversity). Skipped when unset', secret: true },
  OPENROUTER_BASE_URL: { default: 'https://openrouter.ai/api/v1' },

  // Resume generator (AI-authored HTML resumes). Separate, SWAPPABLE provider +
  // per-stage models so the resume pipeline can use a stronger design model (or a
  // self-hosted vLLM/Ollama endpoint) independent of the copilot. All fall back to
  // the LLM_* / GROQ_API_KEY settings, so unset = "use Groq". To switch providers,
  // point RESUME_LLM_BASE_URL/RESUME_LLM_API_KEY at any OpenAI-compatible server.
  // Defaults reflect the plan's pick: gpt-oss-120b for design, llama-3.3-70b for content.
  RESUME_LLM_BASE_URL: { default: '' },
  RESUME_LLM_API_KEY: { default: '', secret: true },
  RESUME_DESIGN_MODEL: { default: 'openai/gpt-oss-120b' },
  // Best-of-N design pool (comma-separated). When unset, defaults to gpt-oss-120b +
  // gpt-oss-20b + llama-3.3-70b (all LIVE on Groq — kimi-k2 was deprecated 2026-03-23 and
  // would collapse best-of-N). The loop drafts across the first 2 (when vision is on) and
  // repairs with the first (primary).
  RESUME_DESIGN_MODELS: { default: '' },
  RESUME_CONTENT_MODEL: { default: 'llama-3.3-70b-versatile' },
  // Multimodal critic for the resume design self-critique loop. Defaults to Groq's
  // free, privacy-safe Llama-4 Scout (native image input). When unset/unavailable the
  // loop degrades to the text/metric verify path (graceful — generation never blocks).
  RESUME_VISION_MODEL: { default: 'meta-llama/llama-4-scout-17b-16e-instruct' },
  GEMINI_API_KEY: { feature: 'Resume ATS analysis (falls back to keyword matching)', secret: true },
  // Company-specific interview-question research (Interview Game, Phase 3). When
  // unset, the research pipeline is disabled and the game uses mentor + curated
  // questions only (graceful degradation, mirrors the GROQ-less fallbacks).
  TAVILY_API_KEY: { feature: 'Company interview-question research (Interview Game); mentor + curated only when unset', secret: true },
  EMAIL_USER: { feature: 'Email notifications (Gmail SMTP)', secret: true },
  EMAIL_PASS: { feature: 'Email notifications (Gmail SMTP)', secret: true },

  // File storage — adapter selected by STORAGE_DRIVER (local | s3). 'local'
  // needs no extra vars (files under server/uploads). 's3' needs the S3_* vars;
  // they are optional here so the local default never blocks boot.
  STORAGE_DRIVER: { default: 'local' },
  S3_BUCKET: { feature: 'S3 file storage (mentor uploads) when STORAGE_DRIVER=s3', secret: false },
  S3_REGION: { default: 'us-east-1' },
  S3_ACCESS_KEY_ID: { feature: 'S3 file storage credentials', secret: true },
  S3_SECRET_ACCESS_KEY: { feature: 'S3 file storage credentials', secret: true },
  S3_PUBLIC_BASE_URL: { feature: 'Custom public base URL / CDN for stored files (optional)', secret: false },
  S3_ENDPOINT: { feature: 'Custom S3-compatible endpoint (MinIO/college server, optional)', secret: false },

  // Live video (self-hosted LiveKit SFU). All three are needed for live mentoring
  // video; when unset the /api/rtc/token endpoint returns 503 and video is disabled.
  LIVEKIT_WS_URL: { feature: 'Live video (LiveKit SFU) — client signaling URL (ws/wss)', secret: false },
  LIVEKIT_API_KEY: { feature: 'Live video (LiveKit SFU) — server token signing', secret: true },
  LIVEKIT_API_SECRET: { feature: 'Live video (LiveKit SFU) — server token signing', secret: true },
};

/**
 * Validate process.env against SCHEMA.
 * @returns {{ errors: string[], warnings: string[] }}
 */
function inspectEnv() {
  const errors = [];
  const warnings = [];

  for (const [key, rule] of Object.entries(SCHEMA)) {
    const raw = process.env[key];
    const present = raw !== undefined && raw !== '';

    if (!present) {
      if (rule.required) {
        errors.push(`Missing required env var: ${key}`);
      } else if (rule.feature) {
        warnings.push(`${key} not set — ${rule.feature} is DISABLED.`);
      } else if (rule.default !== undefined) {
        process.env[key] = rule.default; // apply default in place
      }
      continue;
    }

    if (rule.minLength && raw.length < rule.minLength) {
      errors.push(`${key} is too short (min ${rule.minLength} chars) — use a strong secret.`);
    }
  }

  return { errors, warnings };
}

/**
 * Validate env and exit(1) on any error. Call once, early in server boot.
 */
function validateEnv() {
  const { errors, warnings } = inspectEnv();

  warnings.forEach((w) => console.warn(`⚠️  ${w}`));

  if (errors.length) {
    console.error('\n❌ Environment validation failed:');
    errors.forEach((e) => console.error(`   • ${e}`));
    console.error('\nSet the missing variables (see server/.env.example) and restart.\n');
    process.exit(1);
  }
}

// Build a typed, frozen config object for the rest of the app to consume.
const config = Object.freeze({
  mongoUri: () => process.env.MONGODB_URI,
  jwtSecret: () => process.env.JWT_SECRET,
  jwtExpire: () => process.env.JWT_EXPIRE || '7d',
  port: () => parseInt(process.env.PORT, 10) || 5000,
  nodeEnv: () => process.env.NODE_ENV || 'development',
  isProduction: () => (process.env.NODE_ENV || 'development') === 'production',
  clientOrigins: () => (process.env.CLIENT_URL || 'http://localhost:5173').split(',').map((s) => s.trim()).filter(Boolean),
  judge0Url: () => process.env.JUDGE0_API_URL || 'http://localhost:2358',

  hasGroq: () => Boolean(process.env.GROQ_API_KEY),
  groqApiKey: () => process.env.GROQ_API_KEY || '',
  groqGenModel: () => process.env.GROQ_GEN_MODEL || 'llama-3.1-8b-instant',
  groqEvalModel: () => process.env.GROQ_EVAL_MODEL || 'llama-3.3-70b-versatile',

  // Agentic assistant LLM (OpenAI-compatible, provider-agnostic).
  // When pointed at OpenRouter, a Groq key won't work there, so we DON'T fall back
  // to GROQ_API_KEY — LLM_API_KEY (the OpenRouter key) is required.
  hasLLM: () => /openrouter\.ai/i.test(process.env.LLM_BASE_URL || '')
    ? Boolean(process.env.LLM_API_KEY)
    : Boolean(process.env.LLM_API_KEY || process.env.GROQ_API_KEY),
  llmApiKey: () => /openrouter\.ai/i.test(process.env.LLM_BASE_URL || '')
    ? (process.env.LLM_API_KEY || '')
    : (process.env.LLM_API_KEY || process.env.GROQ_API_KEY || ''),
  llmBaseUrl: () => process.env.LLM_BASE_URL || '',
  llmOrchestratorModel: () => process.env.LLM_ORCHESTRATOR_MODEL || 'llama-3.3-70b-versatile',
  llmGenModel: () => process.env.LLM_GEN_MODEL || 'llama-3.3-70b-versatile',
  llmFastModel: () => process.env.LLM_FAST_MODEL || 'llama-3.1-8b-instant',

  // Failover pool providers (non-PII only). Optional — absent key => skipped.
  hasCerebras: () => Boolean(process.env.CEREBRAS_API_KEY),
  cerebrasApiKey: () => process.env.CEREBRAS_API_KEY || '',
  cerebrasBaseUrl: () => process.env.CEREBRAS_BASE_URL || 'https://api.cerebras.ai/v1',
  hasOpenrouter: () => Boolean(process.env.OPENROUTER_API_KEY),
  openrouterApiKey: () => process.env.OPENROUTER_API_KEY || '',
  openrouterBaseUrl: () => process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',

  // Resume generator provider/models (swappable; fall back to LLM_*/GROQ_API_KEY).
  hasResumeLlm: () => Boolean(process.env.RESUME_LLM_API_KEY || process.env.LLM_API_KEY || process.env.GROQ_API_KEY),
  resumeLlmBaseUrl: () => process.env.RESUME_LLM_BASE_URL || process.env.LLM_BASE_URL || '',
  resumeLlmApiKey: () => process.env.RESUME_LLM_API_KEY
    || (/openrouter\.ai/i.test(process.env.RESUME_LLM_BASE_URL || '') ? process.env.OPENROUTER_API_KEY : '')
    || (/cerebras\.ai/i.test(process.env.RESUME_LLM_BASE_URL || '') ? process.env.CEREBRAS_API_KEY : '')
    || (/huggingface\.co/i.test(process.env.RESUME_LLM_BASE_URL || '') ? process.env.HF_TOKEN : '')
    || process.env.LLM_API_KEY || process.env.GROQ_API_KEY || '',
  resumeDesignModel: () => process.env.RESUME_DESIGN_MODEL || 'openai/gpt-oss-120b',
  // Ordered best-of-N design pool (PII-safe / Groq). First entry = primary + repairer.
  resumeDesignModels: () => {
    const csv = (process.env.RESUME_DESIGN_MODELS || '').split(',').map((s) => s.trim()).filter(Boolean);
    if (csv.length) return csv;
    const primary = process.env.RESUME_DESIGN_MODEL || 'openai/gpt-oss-120b';
    return [primary, 'openai/gpt-oss-20b', 'llama-3.3-70b-versatile'];
  },
  resumeContentModel: () => process.env.RESUME_CONTENT_MODEL || 'llama-3.3-70b-versatile',
  // Vision critic for the resume design loop. hasResumeVision() gates the loop on
  // BOTH a model id and a usable resume LLM key (the critic reuses the resume creds).
  resumeVisionModel: () => process.env.RESUME_VISION_MODEL || 'meta-llama/llama-4-scout-17b-16e-instruct',
  // Vision critic creds, resolved INDEPENDENTLY of the design provider so the critic can
  // stay on reliable Groq (a critic 429 makes verifyDesign ship ungated generic) even when
  // design drafts on OpenRouter. Default to the resume creds when RESUME_VISION_* unset.
  resumeVisionBaseUrl: () => process.env.RESUME_VISION_BASE_URL || process.env.RESUME_LLM_BASE_URL || process.env.LLM_BASE_URL || '',
  resumeVisionApiKey: () => process.env.RESUME_VISION_API_KEY
    || (/api\.groq\.com/i.test(process.env.RESUME_VISION_BASE_URL || '') ? process.env.GROQ_API_KEY : '')
    || (/openrouter\.ai/i.test(process.env.RESUME_VISION_BASE_URL || '') ? process.env.OPENROUTER_API_KEY : '')
    || process.env.RESUME_LLM_API_KEY || process.env.LLM_API_KEY || process.env.GROQ_API_KEY || '',
  hasResumeVision: () => Boolean(
    (process.env.RESUME_VISION_MODEL || 'meta-llama/llama-4-scout-17b-16e-instruct')
    && (process.env.RESUME_VISION_API_KEY || process.env.RESUME_LLM_API_KEY || process.env.LLM_API_KEY || process.env.GROQ_API_KEY),
  ),
  hasGemini: () => Boolean(process.env.GEMINI_API_KEY),
  hasTavily: () => Boolean(process.env.TAVILY_API_KEY),
  tavilyKey: () => process.env.TAVILY_API_KEY || '',
  hasEmail: () => Boolean(process.env.EMAIL_USER && process.env.EMAIL_PASS),

  storageDriver: () => (process.env.STORAGE_DRIVER || 'local').toLowerCase(),
  s3: () => ({
    bucket: process.env.S3_BUCKET,
    region: process.env.S3_REGION || 'us-east-1',
    accessKeyId: process.env.S3_ACCESS_KEY_ID,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
    publicBaseUrl: process.env.S3_PUBLIC_BASE_URL || '',
    endpoint: process.env.S3_ENDPOINT || '',
  }),

  hasLiveKit: () => Boolean(process.env.LIVEKIT_WS_URL && process.env.LIVEKIT_API_KEY && process.env.LIVEKIT_API_SECRET),
  livekit: () => ({
    wsUrl: process.env.LIVEKIT_WS_URL || '',
    apiKey: process.env.LIVEKIT_API_KEY || '',
    apiSecret: process.env.LIVEKIT_API_SECRET || '',
  }),
});

module.exports = { validateEnv, inspectEnv, config, SCHEMA };
