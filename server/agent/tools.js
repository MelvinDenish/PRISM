/**
 * Tool registry for the agentic assistant ("PRISM Copilot").
 *
 * Each entry is `{ definition, kind, roles, handler }`:
 *  - definition: an OpenAI-compatible function-tool schema (passed to the LLM).
 *  - kind: 'read'  → executes inline and returns data to the model.
 *          'write' → (Phase 2+) returns a PROPOSED action and never mutates state;
 *                    execution happens out-of-band via /api/assistant/confirm.
 *  - roles: which user roles may invoke the tool (reuses the app's role model).
 *  - handler(args, ctx): ctx = { userId, role }. Returns a JSON-serializable result.
 *
 * Phase 1 ships read-only tools. The write/confirm machinery is intentionally
 * already modeled (kind/roles) so later phases only add entries here.
 */

const read = require('./services/read');
const { resolveTopic } = require('./services/learningPath');
const { analyzeResume } = require('./services/resume');
const { runSandboxed } = require('./services/codeRun');
const Resource = require('../models/Resource');

const RUN_CODE_MAX_BYTES = 20000; // 20KB cap for agent tool (route keeps 50KB)
const RUN_CODE_OUTPUT_LIMIT = 4096; // chars per stream returned to the LLM
const SUPPORTED_LANGUAGES = ['javascript', 'python', 'java', 'cpp', 'c'];

/** Cap a stream of output so the LLM context isn't blown by a noisy program. */
function truncateOutput(s) {
  if (typeof s !== 'string') return '';
  return s.length > RUN_CODE_OUTPUT_LIMIT
    ? `${s.slice(0, RUN_CODE_OUTPUT_LIMIT)}\n… [output truncated]`
    : s;
}

/** @type {Record<string, { definition: object, kind: 'read'|'write', roles: string[], handler: Function }>} */
const TOOLS = {
  find_mentors: {
    kind: 'read',
    roles: ['mentee', 'mentor', 'admin'],
    definition: {
      type: 'function',
      function: {
        name: 'find_mentors',
        description: "Find mentors on the platform, optionally filtered by the company they currently work at or a skill. Use this when the user wants to find or book a mentor (e.g. 'an Amazon mentor', 'someone who knows system design').",
        parameters: {
          type: 'object',
          properties: {
            company: { type: 'string', description: "Company name to filter mentors by, e.g. 'Amazon'. Optional." },
            skill: { type: 'string', description: 'A skill to filter mentors by, e.g. "System Design". Optional.' },
          },
        },
      },
    },
    handler: (args) => read.findMentors({ company: args.company, skill: args.skill }),
  },

  list_topics: {
    kind: 'read',
    roles: ['mentee', 'mentor', 'admin'],
    definition: {
      type: 'function',
      function: {
        name: 'list_topics',
        description: 'List the prep topics available on PRISM (e.g. Data Structures, System Design, OOP). Use when building a roadmap or pointing the user to study areas.',
        parameters: { type: 'object', properties: {} },
      },
    },
    handler: () => read.listTopics(),
  },

  list_resources: {
    kind: 'read',
    roles: ['mentee', 'mentor', 'admin'],
    definition: {
      type: 'function',
      function: {
        name: 'list_resources',
        description: 'List learning resources (videos, articles, links), optionally filtered by topic id, difficulty level, type, or a title search. Use to recommend study materials or assemble a roadmap.',
        parameters: {
          type: 'object',
          properties: {
            topicId: { type: 'string', description: 'Topic id to filter by (get ids from list_topics). Optional.' },
            level: { type: 'string', enum: ['beginner', 'intermediate', 'advanced'], description: 'Difficulty level. Optional.' },
            type: { type: 'string', description: "Resource type, e.g. 'video', 'article', 'link'. Optional." },
            search: { type: 'string', description: 'Substring to match in the title. Optional.' },
          },
        },
      },
    },
    handler: (args) => read.listResources(args),
  },

  list_companies: {
    kind: 'read',
    roles: ['mentee', 'mentor', 'admin'],
    definition: {
      type: 'function',
      function: {
        name: 'list_companies',
        description: 'List companies PRISM has prep tracks for (with difficulty level). Use to resolve a company the user names before fetching its track.',
        parameters: { type: 'object', properties: {} },
      },
    },
    handler: () => read.listCompanies(),
  },

  get_company_track: {
    kind: 'read',
    roles: ['mentee', 'mentor', 'admin'],
    definition: {
      type: 'function',
      function: {
        name: 'get_company_track',
        description: "Get a company's interview pattern plus the coding problems tagged to it, annotated with whether the current user has solved each. Use when the user asks how to crack a specific company.",
        parameters: {
          type: 'object',
          properties: {
            companyName: { type: 'string', description: "Company name, e.g. 'Amazon'." },
            companyId: { type: 'string', description: 'Company id if known. Optional — companyName is enough.' },
          },
        },
      },
    },
    handler: (args, ctx) => read.getCompanyTrack({ userId: ctx.userId, companyId: args.companyId, companyName: args.companyName }),
  },

  get_my_progress: {
    kind: 'read',
    roles: ['mentee', 'mentor', 'admin'],
    definition: {
      type: 'function',
      function: {
        name: 'get_my_progress',
        description: "Get the current user's prep progress: resources completed, per-topic percentages, and mock-interview score averages. Use when the user asks 'how am I doing?' or to personalize a plan.",
        parameters: { type: 'object', properties: {} },
      },
    },
    handler: (args, ctx) => read.getMyProgress({ userId: ctx.userId }),
  },

  get_my_sessions: {
    kind: 'read',
    roles: ['mentee', 'mentor', 'admin'],
    definition: {
      type: 'function',
      function: {
        name: 'get_my_sessions',
        description: "List the current user's mentorship sessions and their statuses (pending, approved, completed, etc.).",
        parameters: { type: 'object', properties: {} },
      },
    },
    handler: (args, ctx) => read.getMySessions({ userId: ctx.userId, role: ctx.role }),
  },

  get_mentor_availability: {
    kind: 'read',
    roles: ['mentee', 'mentor', 'admin'],
    definition: {
      type: 'function',
      function: {
        name: 'get_mentor_availability',
        description: "Get a mentor's posted availability (weekly recurring slots and any open specific-date slots). Use after find_mentors, before proposing a booking, so you can suggest a realistic time.",
        parameters: {
          type: 'object',
          properties: { mentorId: { type: 'string', description: 'The mentor id from find_mentors.' } },
          required: ['mentorId'],
        },
      },
    },
    handler: (args) => read.getMentorAvailability({ mentorId: args.mentorId }),
  },

  analyze_resume: {
    kind: 'read',
    roles: ['mentee'],
    definition: {
      type: 'function',
      function: {
        name: 'analyze_resume',
        description: 'Analyze a resume against a job description: returns an ATS match score, missing keywords, red flags, and STAR rewrite suggestions. Requires the resume TEXT (the user must paste it) and the job description text. Use when the user wants their resume checked against a role.',
        parameters: {
          type: 'object',
          properties: {
            resumeText: { type: 'string', description: 'The full text of the resume (pasted by the user).' },
            jobDescription: { type: 'string', description: 'The target job description text.' },
          },
          required: ['resumeText', 'jobDescription'],
        },
      },
    },
    handler: async (args) => {
      const { result, mode } = await analyzeResume(args.resumeText, args.jobDescription);
      return { ...result, mode };
    },
  },

  // ---- Write tools (propose → confirm; never mutate inside the loop) ----

  create_learning_path: {
    kind: 'write',
    roles: ['mentee', 'mentor'],
    definition: {
      type: 'function',
      function: {
        name: 'create_learning_path',
        description: "Propose creating a personalized, ordered learning path (roadmap) for ONE topic from the platform's resources. Use when the user wants a study plan/roadmap for a topic (e.g. 'a roadmap for System Design'). For a company goal (e.g. 'crack Amazon'), first use get_company_track / get_my_progress to pick the most relevant topic, then propose a path for it. This only PROPOSES — the user must confirm before it is created.",
        parameters: {
          type: 'object',
          properties: {
            topicName: { type: 'string', description: "The topic to build a roadmap for, e.g. 'System Design'. Must match a platform topic (see list_topics)." },
            topicId: { type: 'string', description: 'Topic id if known. Optional — topicName is enough.' },
            level: { type: 'string', enum: ['beginner', 'intermediate', 'advanced'], description: "The learner's level for this topic. Defaults to beginner." },
          },
          required: ['topicName'],
        },
      },
    },
    // Build a PROPOSAL only — resolves the topic and previews resource count.
    handler: async (args) => {
      const topic = await resolveTopic({ topicId: args.topicId, topicName: args.topicName });
      if (!topic) {
        const e = new Error(`No topic matching "${args.topicName || args.topicId}". Use list_topics to see valid topics.`);
        throw e;
      }
      const resourceCount = await Resource.countDocuments({ topic: topic._id });
      if (resourceCount === 0) {
        throw new Error(`The topic "${topic.name}" has no resources yet, so a roadmap can't be built for it.`);
      }
      const level = args.level || 'beginner';
      return {
        type: 'create_learning_path',
        title: `Create a ${level} roadmap for ${topic.name}`,
        summary: `I'll build an ordered ${level} learning path for "${topic.name}" from ${resourceCount} available resource(s) and save it to your Learning Paths.`,
        params: { topicId: String(topic._id), level },
      };
    },
  },

  book_mentorship_session: {
    kind: 'write',
    roles: ['mentee'],
    definition: {
      type: 'function',
      function: {
        name: 'book_mentorship_session',
        description: "Propose booking a mentorship session with a mentor. Resolve the mentor via find_mentors first (you need their id), and prefer a time from get_mentor_availability. This only PROPOSES — the user must confirm before the session is requested and the mentor is emailed. Provide the date/time as a full ISO 8601 string in the future.",
        parameters: {
          type: 'object',
          properties: {
            mentorId: { type: 'string', description: 'Mentor id from find_mentors.' },
            scheduledDate: { type: 'string', description: 'Requested start time as an ISO 8601 datetime in the future, e.g. 2026-06-18T17:00:00.' },
            durationMinutes: { type: 'number', description: 'Session length in minutes. Defaults to 60.' },
            agenda: { type: 'string', description: 'What the mentee wants to cover in the session.' },
          },
          required: ['mentorId', 'scheduledDate', 'agenda'],
        },
      },
    },
    handler: async (args) => {
      const mentor = (await read.findMentors({})).find((m) => m.id === String(args.mentorId));
      // findMentors with no filter returns up to 25; fall back to a direct check via name omitted.
      const mentorName = mentor?.name || 'the selected mentor';
      const when = new Date(args.scheduledDate);
      if (Number.isNaN(when.getTime()) || when <= new Date()) {
        throw new Error('Please provide a valid future date/time for the session.');
      }
      const duration = args.durationMinutes || 60;
      return {
        type: 'book_mentorship_session',
        title: `Book ${mentorName}${mentor?.currentCompany ? ` (${mentor.currentCompany})` : ''}`,
        summary: `Request a ${duration}-minute session with ${mentorName} on ${when.toLocaleString()}.\nAgenda: ${args.agenda}\nThe mentor will be notified by email and can approve or decline.`,
        params: { mentorId: String(args.mentorId), scheduledDate: when.toISOString(), durationMinutes: duration, agenda: args.agenda },
      };
    },
  },

  rewrite_resume: {
    kind: 'write',
    roles: ['mentee'],
    definition: {
      type: 'function',
      function: {
        name: 'rewrite_resume',
        description: "Propose rewriting the user's resume to target a specific job description, then save it as a new draft in the Resume Builder. Requires the resume TEXT and the job description text. This only PROPOSES — the rewrite is generated and saved only after the user confirms. Prefer running analyze_resume first so the user sees what will change.",
        parameters: {
          type: 'object',
          properties: {
            resumeText: { type: 'string', description: 'The full text of the resume to rewrite (pasted by the user).' },
            jobDescription: { type: 'string', description: 'The target job description text to tailor the resume to.' },
          },
          required: ['resumeText', 'jobDescription'],
        },
      },
    },
    handler: async (args) => {
      if (!args.resumeText || !args.jobDescription) {
        throw new Error('I need both your resume text and the target job description to rewrite it.');
      }
      const jdPreview = String(args.jobDescription).replace(/\s+/g, ' ').slice(0, 80);
      return {
        type: 'rewrite_resume',
        title: 'Rewrite your resume for this job',
        summary: `I'll rewrite your resume to target this role ("${jdPreview}...") — tailoring wording, strengthening bullet points, and surfacing relevant skills — and save it as a new draft in your Resume Builder. I won't invent employers, dates, or metrics.`,
        params: { resumeText: args.resumeText, jobDescription: args.jobDescription },
      };
    },
  },

  // ---- Phase 2 tools -------------------------------------------------------

  generate_document: {
    kind: 'write',
    roles: ['mentee', 'mentor', 'admin'],
    definition: {
      type: 'function',
      function: {
        name: 'generate_document',
        description: "Propose generating a real downloadable file (resume, cover letter, or general document) in the user's chosen format (pdf, docx, or md). The user must confirm before the file is created. Use when the user asks to create, export, or download a document. content should be the document body as a markdown string or a structured { sections } object.",
        parameters: {
          type: 'object',
          properties: {
            title:   { type: 'string', description: 'Document title, e.g. "Software Engineer Resume".' },
            format:  { type: 'string', enum: ['pdf', 'docx', 'md'], description: 'Output file format.' },
            kind:    { type: 'string', enum: ['resume', 'cover_letter', 'document'], description: 'Document kind. Defaults to "document".' },
            content: { type: 'string', description: 'Document body as a markdown string. Use ## headings for sections.' },
          },
          required: ['title', 'format', 'content'],
        },
      },
    },
    handler: async (args) => {
      if (!args.title || !args.format || !args.content) {
        throw new Error('title, format, and content are all required to generate a document.');
      }
      if (!['pdf', 'docx', 'md'].includes(args.format)) {
        throw new Error('format must be pdf, docx, or md.');
      }
      const kind = args.kind || 'document';
      const titlePreview = String(args.title).slice(0, 60);
      const formatLabel = args.format.toUpperCase();
      return {
        type: 'generate_document',
        title: `Generate ${titlePreview} (${formatLabel})`,
        summary: `I'll generate a ${formatLabel} file titled "${titlePreview}" and make it available for download. The file will be created only after you confirm.`,
        params: {
          title: String(args.title).slice(0, 200),
          format: args.format,
          kind,
          content: String(args.content).slice(0, 102400), // 100KB hard cap
        },
      };
    },
  },

  run_code: {
    kind: 'read', // executes immediately — no confirm gate
    roles: ['mentee', 'mentor', 'admin'],
    definition: {
      type: 'function',
      function: {
        name: 'run_code',
        description: 'Run a code snippet in a sandboxed environment and return stdout/stderr/exitCode. Supported languages: javascript, python, java, cpp, c. Use to demonstrate algorithms, verify solutions, or answer "what does this code output?" questions. Code that accesses the file system, network, or spawns processes is blocked.',
        parameters: {
          type: 'object',
          properties: {
            language: { type: 'string', enum: SUPPORTED_LANGUAGES, description: 'Programming language.' },
            code:     { type: 'string', description: 'Source code to run.' },
            stdin:    { type: 'string', description: 'Optional stdin input.' },
          },
          required: ['language', 'code'],
        },
      },
    },
    handler: async (args) => {
      if (!SUPPORTED_LANGUAGES.includes(args.language)) {
        throw new Error(`Language "${args.language}" is not supported. Choose from: ${SUPPORTED_LANGUAGES.join(', ')}.`);
      }
      if (!args.code || typeof args.code !== 'string') {
        throw new Error('code is required.');
      }
      const result = await runSandboxed({
        language: args.language,
        code: args.code,
        stdin: args.stdin || '',
        maxBytes: RUN_CODE_MAX_BYTES,
      });
      // Cap stdout/stderr so a runaway loop or huge dump can't blow the LLM context.
      return {
        ...result,
        stdout: truncateOutput(result.stdout),
        stderr: truncateOutput(result.stderr),
      };
    },
  },
};

/** Tool definitions the given role is allowed to use (sent to the LLM). */
function toolDefinitionsForRole(role) {
  return Object.values(TOOLS)
    .filter((t) => t.roles.includes(role))
    .map((t) => t.definition);
}

module.exports = { TOOLS, toolDefinitionsForRole };
