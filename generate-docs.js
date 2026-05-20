const { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, AlignmentType, BorderStyle, ShadingType, TabStopPosition, TabStopType } = require('docx');
const fs = require('fs');

// ============================================================
// DOCUMENT 1: PROJECT ABSTRACT
// ============================================================
function createAbstractDoc() {
  return new Document({
    styles: {
      default: {
        document: { run: { font: 'Calibri', size: 24 } }
      }
    },
    sections: [{
      properties: { page: { margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 } } },
      children: [
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 100 }, children: [new TextRun({ text: 'PRISM', bold: true, size: 48, font: 'Calibri', color: '10B981' })] }),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 100 }, children: [new TextRun({ text: 'Placement Resources & Interview Skill Manager', bold: true, size: 32, font: 'Calibri' })] }),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 400 }, children: [new TextRun({ text: 'Project Abstract', size: 28, font: 'Calibri', color: '666666' })] }),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 600 }, children: [new TextRun({ text: '─────────────────────────────────────────', color: '10B981', size: 24 })] }),

        // Abstract Section
        heading('Abstract'),
        para('PRISM (Placement Resources & Interview Skill Manager) is a comprehensive, AI-powered full-stack web platform designed to bridge the gap between academic learning and industry placement readiness. Built on the MERN stack (MongoDB, Express.js, React 19, Node.js), the platform provides an integrated ecosystem where mentees can prepare for campus placements through structured learning paths, simulated interview experiences, real-time mentorship sessions, and AI-driven feedback mechanisms.'),
        para('The platform addresses a critical challenge in higher education: students often lack a unified, interactive environment to practice and refine their placement interview skills. Traditional preparation methods—scattered YouTube videos, static mock test platforms, and informal peer sessions—fail to provide the structured, feedback-rich experience needed for competitive placement processes.'),

        heading('Problem Statement'),
        para('Campus placement preparation is fragmented across multiple tools and platforms. Students lack access to personalized learning roadmaps, realistic multi-round interview simulations, real-time mentor guidance, and AI-powered feedback. There is no single platform that integrates resource curation, interview practice, resume optimization, and mentorship into a cohesive experience.'),

        heading('Proposed Solution'),
        para('PRISM solves this by providing a unified platform with the following core capabilities:'),
        bullet('AI-Powered Learning Paths: Leveraging Groq LLM (LLaMA 3.1) to generate personalized, topic-specific learning roadmaps from curated resources, ordered by difficulty and learning progression.'),
        bullet('6-Round Interview Simulation Game: A gamified interview experience simulating real placement processes—Aptitude, Technical Round 1, Coding (with live code execution via Judge0 CE), Group Discussion (AI participants), Technical Round 2, and HR—with AI-generated questions and evaluation.'),
        bullet('Real-Time Mentorship: WebSocket-powered session management with PeerJS video calls, enabling mentees to connect with experienced mentors for live guidance. Includes session booking, approval workflows, and email notifications via Nodemailer.'),
        bullet('AI Resume Builder & ATS Analyzer: An in-app resume builder with multiple templates (Modern, Classic, Creative), AI-powered content generation, cover letter generation, and ATS compatibility scoring using Google Gemini.'),
        bullet('Resource Management with AI Summarization: Curated learning resources (videos, articles, PDFs) organized by topic and difficulty, with in-app YouTube embedding and AI-powered article summarization via Groq.'),
        bullet('Collaborative Code Editor: Monaco Editor-based real-time collaborative coding environment with WebSocket synchronization, supporting 5 programming languages (JavaScript, Python, Java, C++, C).'),
        bullet('Analytics Dashboard: Real-time performance tracking with Recharts visualizations showing topic progress, interview scores, weakness detection, and improvement trends.'),

        heading('Technology Stack'),
        para('Frontend: React 19, Vite 7, React Router 7, Recharts, Framer Motion, Monaco Editor, Socket.IO Client, PeerJS'),
        para('Backend: Node.js, Express 4, Socket.IO 4, Mongoose 8 (MongoDB ODM), JWT Authentication, bcryptjs, Nodemailer, Multer'),
        para('AI/ML: Groq SDK (LLaMA 3.1-8b-instant), Google Gemini 2.0 Flash'),
        para('Code Execution: Judge0 CE (Docker) with local fallback'),
        para('Real-Time: WebSocket (Socket.IO) for code sync, chat, notifications; PeerJS/WebRTC for video calls'),

        heading('Key Differentiators'),
        bullet('End-to-End Integration: Unlike fragmented tools, PRISM unifies learning, practice, feedback, and mentorship in one platform.'),
        bullet('AI-First Design: Every major feature—learning paths, interview questions, resume content, article summaries, GD evaluation—is powered by LLM inference.'),
        bullet('Gamified Interview Simulation: The 6-round interview game mirrors real placement processes, making preparation engaging and realistic.'),
        bullet('Real-Time Collaboration: Live code editing, video calls, and group discussions create an interactive learning environment.'),
        bullet('Role-Based Architecture: Three distinct user roles (Mentee, Mentor, Admin) with tailored dashboards, permissions, and workflows.'),

        heading('Conclusion'),
        para('PRISM represents a significant advancement in placement preparation technology. By combining AI-powered content generation, real-time collaboration, gamified learning, and structured mentorship into a single cohesive platform, it empowers students to prepare more effectively and confidently for campus placements. The platform\'s modular architecture ensures scalability, and its AI-first approach guarantees continuously improving, personalized experiences for every user.'),
      ]
    }]
  });
}

// ============================================================
// DOCUMENT 2: DETAILED IMPLEMENTATION DOCUMENT
// ============================================================
function createImplementationDoc() {
  return new Document({
    styles: {
      default: {
        document: { run: { font: 'Calibri', size: 22 } }
      }
    },
    sections: [{
      properties: { page: { margin: { top: 1200, bottom: 1200, left: 1200, right: 1200 } } },
      children: [
        // Title Page
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 100 }, children: [new TextRun({ text: 'PRISM', bold: true, size: 52, font: 'Calibri', color: '10B981' })] }),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 80 }, children: [new TextRun({ text: 'Placement Resources & Interview Skill Manager', bold: true, size: 30, font: 'Calibri' })] }),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 400 }, children: [new TextRun({ text: 'Detailed Implementation Document', size: 26, font: 'Calibri', color: '666666' })] }),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 600 }, children: [new TextRun({ text: '─────────────────────────────────────────', color: '10B981', size: 22 })] }),

        // ==================== TABLE OF CONTENTS ====================
        heading('Table of Contents'),
        tocEntry('1. System Architecture Overview'),
        tocEntry('2. Team Member Split & Responsibilities'),
        tocEntry('3. Backend Implementation'),
        tocEntry('   3.1 Server Setup & Configuration'),
        tocEntry('   3.2 Database Schema Design (MongoDB)'),
        tocEntry('   3.3 Authentication & Authorization'),
        tocEntry('   3.4 REST API Routes'),
        tocEntry('   3.5 AI Integration (Groq & Gemini)'),
        tocEntry('   3.6 Real-Time Communication (Socket.IO)'),
        tocEntry('   3.7 Code Execution Engine'),
        tocEntry('   3.8 Email Notification Service'),
        tocEntry('4. Frontend Implementation'),
        tocEntry('   4.1 React Application Structure'),
        tocEntry('   4.2 State Management & Auth Context'),
        tocEntry('   4.3 Routing & Protected Routes'),
        tocEntry('   4.4 UI Design System'),
        tocEntry('   4.5 Page-by-Page Implementation'),
        tocEntry('5. Feature Deep Dives'),
        tocEntry('   5.1 Interview Simulation Game'),
        tocEntry('   5.2 AI Learning Path Generation'),
        tocEntry('   5.3 Resume Builder & ATS Analysis'),
        tocEntry('   5.4 Mentorship & Video Calls'),
        tocEntry('   5.5 Group Discussion Simulation'),
        tocEntry('   5.6 Collaborative Code Editor'),
        tocEntry('6. Security Implementation'),
        tocEntry('7. Deployment & Environment Configuration'),
        new Paragraph({ spacing: { after: 400 }, children: [] }),

        // ==================== 1. SYSTEM ARCHITECTURE ====================
        heading('1. System Architecture Overview'),
        para('PRISM follows a client-server architecture with the MERN stack. The system is composed of three layers:'),
        subheading('1.1 Presentation Layer (Client)'),
        para('Built with React 19 and Vite 7.3 as the build tool. The client is a Single Page Application (SPA) that communicates with the backend via RESTful HTTP APIs (Axios) and real-time WebSocket connections (Socket.IO Client). It uses React Router v7 for client-side routing and Framer Motion for animations.'),
        subheading('1.2 Application Layer (Server)'),
        para('An Express.js server running on Node.js. It handles all business logic, authentication, database operations, AI integrations, and real-time event management. The server exposes 18 REST API route groups and manages WebSocket connections through Socket.IO.'),
        subheading('1.3 Data Layer'),
        para('MongoDB serves as the primary database, with Mongoose as the ODM (Object-Document Mapper). The database stores 18 collections including Users, MentorshipSessions, Resources, Topics, InterviewGames, LearningPaths, ResumeDrafts, ResumeAnalyses, QuestionBank, Progress, Notifications, Companies, CodingQuestions, Availability, and legacy collections.'),

        subheading('1.4 External Services'),
        bullet('Groq Cloud API: LLaMA 3.1-8b-instant model for question generation, learning path design, interview evaluation, article summarization, GD simulation, and resume content generation.'),
        bullet('Google Gemini API: Gemini 2.0 Flash model for ATS resume analysis with structured JSON output.'),
        bullet('Judge0 CE: Self-hosted code execution engine (Docker) supporting 5 languages with sandboxed execution.'),
        bullet('Gmail SMTP: Nodemailer integration for session request email notifications.'),
        bullet('PeerJS: WebRTC abstraction library for peer-to-peer video calls.'),

        // ==================== 2. TEAM SPLIT ====================
        heading('2. Team Member Split & Responsibilities'),
        para('The project is developed by a team of 3 members, with responsibilities divided by feature domain to minimize merge conflicts and ensure clear ownership:'),
        new Paragraph({ spacing: { after: 200 }, children: [] }),

        // Member 1
        subheading('Member 1: Backend Core & Authentication'),
        para('Focus: Server infrastructure, database design, authentication, mentorship, and session management.'),
        para('Responsibilities:', true),
        bullet('Server Setup: Express.js server configuration (server.js), CORS, middleware pipeline, Socket.IO integration, environment variable management (.env).'),
        bullet('Database Design: All 18 Mongoose schemas/models — User, MentorshipSession, Resource, Topic, Company, Notification, Progress, Availability, CodingQuestion, QuestionBank, InterviewGame, LearningPath, ResumeDraft, ResumeAnalysis, MockInterview, MockFeedback, GDRoom, CodeSubmission.'),
        bullet('Authentication System: JWT-based auth with bcryptjs password hashing (auth.js), protect middleware for route guarding, authorize middleware for role-based access control (RBAC) supporting mentor/mentee/admin roles.'),
        bullet('Mentorship Module: Session CRUD with booking validation (past-date rejection, double-booking detection, self-booking prevention), status workflow (pending → approved → in-progress → completed), rating system with running average calculation, in-app notification generation, email notification via Nodemailer.'),
        bullet('User Management: Profile CRUD, mentor listing with filters, user search, admin user management.'),
        bullet('Availability System: Mentor availability slots management for scheduling.'),
        bullet('Notifications: Real-time and persistent notification system with read/unread state management.'),
        bullet('Analytics Dashboard API: Aggregation pipeline computing resource completion rates, interview game score averages by round type, weakness detection from game data and topic progress.'),
        bullet('Seed Data System: seedAll.js script populating Topics (20), Companies (10), Users (mentor/mentee/admin), Resources (per topic), CodingQuestions, and QuestionBank.'),
        new Paragraph({ spacing: { after: 100 }, children: [] }),
        para('Files Owned:', true),
        code('server/server.js, server/middleware/auth.js, server/utils/emailService.js'),
        code('server/models/*.js (all 18 models)'),
        code('server/routes/auth.js, users.js, mentorship.js, availability.js, notifications.js, analytics.js, companies.js, topics.js'),
        code('server/seeds/seedAll.js'),
        code('server/socket/socketHandler.js'),
        code('client/src/context/AuthContext.jsx, client/src/services/api.js'),
        code('client/src/pages/Login.jsx, Register.jsx, Sessions.jsx, Mentors.jsx, MentorProfile.jsx, Notifications.jsx, Admin.jsx, Dashboard.jsx, Analytics.jsx, VideoCall.jsx'),
        new Paragraph({ spacing: { after: 300 }, children: [] }),

        // Member 2
        subheading('Member 2: AI Features & Interview Simulation'),
        para('Focus: All AI-powered features, interview game, group discussion, and code execution.'),
        para('Responsibilities:', true),
        bullet('Interview Simulation Game (6 Rounds): Complete gamified interview experience — Aptitude MCQs (AI-generated via Groq), Technical Round 1 (AI MCQs), Coding Round (live code editor + Judge0 execution + test case validation), Group Discussion (AI participants with distinct personalities), Technical Round 2 (deeper AI MCQs), HR Round (AI behavioral questions with answer evaluation). Includes leaderboard, scoring, round progression, and detailed feedback.'),
        bullet('AI Question Generation: Groq LLM integration for dynamic MCQ generation (aptitude, technical), HR question generation, GD topic generation, and coding problem generation with test cases and boilerplate code.'),
        bullet('Code Execution Engine: Judge0 CE integration with Docker, language mapping (JS=63, Python=71, Java=62, C++=54, C=50), security validation (dangerous pattern blocking for file I/O, system calls, process manipulation), local fallback execution via child_process when Judge0 is unavailable, 10-second timeout enforcement.'),
        bullet('Group Discussion Simulation: AI-powered GD with 5 distinct participant profiles (Ananya—analytical, Rahul—passionate, Priya—diplomatic, Vikram—practical, Sneha—creative). Dynamic conversation flow where AI participants respond to user input with contextual, debate-style responses. AI evaluation scoring communication, content quality, leadership, and logical reasoning.'),
        bullet('AI Learning Path Generation: Groq LLM designs personalized learning roadmaps from available resources. AI orders 15-25 resources from foundational to advanced. Includes fallback ordering by difficulty level when AI is unavailable.'),
        bullet('AI Article Summarization: Server-side article extraction via Axios (HTML scripping, script/style removal), content truncation to 8000 chars, Groq LLM summarization into structured bullet points. Mounted at /api/summarize.'),
        bullet('AI Resume Content Generation: Groq LLM generates professional summaries, optimized experience descriptions, skill lists, and improvement suggestions from user profile data. Structured JSON output parsing.'),
        new Paragraph({ spacing: { after: 100 }, children: [] }),
        para('Files Owned:', true),
        code('server/routes/interviewGame.js, groupDiscussion.js, codeExecution.js, learningPaths.js, summarize.js'),
        code('server/routes/resumeBuilder.js (AI generation endpoints)'),
        code('judge0-docker-compose.yml'),
        code('client/src/pages/InterviewGame.jsx, GDRooms.jsx, LearningPaths.jsx, CodingQuestions.jsx'),
        new Paragraph({ spacing: { after: 300 }, children: [] }),

        // Member 3
        subheading('Member 3: Frontend UI/UX, Resume Tools & Resources'),
        para('Focus: UI design system, responsive layout, resume tools, resource management, and frontend polish.'),
        para('Responsibilities:', true),
        bullet('UI Design System: Complete CSS architecture (index.css) — CSS custom properties for dark theme (--bg-primary, --bg-secondary, --accent-primary etc.), glassmorphism effects (backdrop-filter: blur), gradient animations, responsive grid system, component styles (cards, badges, buttons, forms, modals, progress bars, chat bubbles).'),
        bullet('Layout & Navigation: Responsive sidebar with hamburger menu toggle for mobile (Layout.jsx, Sidebar.jsx, Sidebar.css). Role-based navigation showing different menu items for mentee/mentor/admin. Auto-close on navigation for mobile UX.'),
        bullet('Resume Builder UI: Multi-step resume builder (ResumeBuilder.jsx, 29KB) with live preview, template switching (Modern/Classic/Creative), section management (Personal Info, Education, Experience, Skills, Projects, Certifications), cover letter generation, PDF export via html2pdf.js, DOCX export via docx library.'),
        bullet('Resume ATS Analysis: ResumeAnalysis.jsx — resume text input, job description matching, ATS score visualization, missing keyword highlighting, red flag detection, STAR-method rewrite suggestions. Uses Gemini API through backend proxy.'),
        bullet('Resource Management: Resources.jsx — filterable resource grid (topic, level, type, search), in-app YouTube video embedding, rich article preview cards with domain display, AI-powered article summarization (connected to /api/summarize), resource completion tracking per user.'),
        bullet('Topics Management: Topics.jsx — CRUD interface for managing learning topics, admin-only creation with icon/color customization.'),
        bullet('Companies Directory: Companies.jsx — company listing with details, used for targeting specific company preparation.'),
        bullet('404 & Error Pages: NotFound.jsx — styled not-found page with navigation.'),
        bullet('Mobile Responsiveness: Comprehensive media queries for all breakpoints — sidebar overlay on mobile, stacked grids, compact forms, touch-friendly controls.'),
        new Paragraph({ spacing: { after: 100 }, children: [] }),
        para('Files Owned:', true),
        code('client/src/index.css (entire design system)'),
        code('client/src/components/Layout.jsx, Sidebar.jsx, Sidebar.css'),
        code('client/src/App.jsx (routing configuration)'),
        code('client/src/pages/ResumeBuilder.jsx, ResumeAnalysis.jsx, Resources.jsx, Topics.jsx, Companies.jsx, NotFound.jsx'),
        code('server/routes/resources.js, resumeAnalysis.js, progress.js, codingQuestions.js'),
        new Paragraph({ spacing: { after: 400 }, children: [] }),

        // ==================== 3. BACKEND IMPLEMENTATION ====================
        heading('3. Backend Implementation'),

        subheading('3.1 Server Setup & Configuration'),
        para('The server entry point is server.js, which initializes:'),
        bullet('Express application with CORS (allowing all origins for development), JSON body parsing.'),
        bullet('MongoDB connection via Mongoose using MONGO_URI from environment variables.'),
        bullet('HTTP server creation with Socket.IO integration for real-time features.'),
        bullet('18 API route groups mounted under /api/* prefix.'),
        bullet('Global error handler middleware.'),
        bullet('Socket handler initialization for interview rooms, GD rooms, code sync, and video call signaling.'),
        para('Environment variables required: MONGO_URI, JWT_SECRET, JWT_EXPIRE, PORT, GROQ_API_KEY, GEMINI_API_KEY, EMAIL_USER, EMAIL_PASS, CLIENT_URL, JUDGE0_API_URL.'),

        subheading('3.2 Database Schema Design (MongoDB)'),
        para('The database uses 18 Mongoose models. Key design decisions:'),
        bullet('User Model: Unified schema for all three roles (mentor/mentee/admin) using a role enum field. Contains professional info (skills, expertise, company), academic info (college, graduationYear), social links (LinkedIn, GitHub), and computed fields (rating, totalReviews). Passwords are stored as bcrypt hashes with 10 salt rounds.'),
        bullet('MentorshipSession Model: References both mentor and mentee User documents via ObjectId. Implements a state machine pattern with status enum (pending → approved → in-progress → completed/rejected/cancelled). Includes bidirectional feedback fields and rating.'),
        bullet('InterviewGame Model: Uses embedded sub-documents for rounds (roundSchema within interviewGameSchema). Each round tracks type, score, answers array, status, and completion time. The parent document tracks overall progress and total score calculation.'),
        bullet('LearningPath Model: Embedded step sub-documents with resource references, completion tracking per step, and computed progress percentage. Steps include order, title, description, resource link, and estimated time.'),
        bullet('ResumeDraft Model: Deeply nested schema for personal info, education array, experience array, skills array, projects array, certifications array, and cover letter. Uses pre-save hook to auto-update the updatedAt timestamp.'),
        bullet('Progress Model: Per-user tracker with completedResources (array of Resource ObjectIds) and topicProgress (embedded array with topic reference and percentage).'),
        bullet('QuestionBank Model: Polymorphic schema supporting MCQ (q, opts, ans), HR (q only), and coding questions (title, description, examples, testCases, boilerplate per language). Indexed on type and difficulty for efficient querying.'),
        bullet('Resource Model: References Topic and User (uploader), with type enum (video/article/pdf/link) and optional company tagging.'),

        subheading('3.3 Authentication & Authorization'),
        para('Implementation in middleware/auth.js and routes/auth.js:'),
        bullet('Registration Flow: Validates required fields (name, email, password, role), checks email format via regex, enforces name length (2-50 chars), password minimum (6 chars), prevents duplicate emails (case-insensitive). Creates bcrypt hash (10 rounds), creates User document, auto-creates Progress tracker for mentees, returns JWT token.'),
        bullet('Login Flow: Case-insensitive email lookup, bcrypt password comparison, JWT generation with configurable expiry (default 7 days). Returns full user profile (excluding password hash) to populate client-side AuthContext.'),
        bullet('JWT Middleware (protect): Extracts token from Authorization Bearer header or cookies. Verifies via jsonwebtoken, fetches user from DB (excluding password), attaches to req.user. Returns 401 on missing/invalid token.'),
        bullet('Role Middleware (authorize): Accepts spread of allowed roles, checks req.user.role. Returns 403 with descriptive message for unauthorized roles. Used to restrict routes like session booking (mentee only) and admin operations.'),
        bullet('Client-Side Auth (AuthContext.jsx): React Context with useAuth hook. Stores token in localStorage, sets Axios default Authorization header, auto-fetches /api/auth/me on mount to restore session, provides login/register/logout functions.'),

        subheading('3.4 REST API Routes'),
        para('The server exposes 18 route groups. Key routes with their methods:'),
        bullet('/api/auth: POST /register, POST /login, GET /me'),
        bullet('/api/users: GET / (all), GET /mentors, GET /:id, PUT /profile, DELETE /:id'),
        bullet('/api/mentorship: POST / (book), GET / (list), PATCH /:id/status, PATCH /:id/rate'),
        bullet('/api/resources: GET / (filtered), GET /:id, POST /, PUT /:id, DELETE /:id'),
        bullet('/api/topics: GET /, POST /, PUT /:id, DELETE /:id'),
        bullet('/api/progress: GET /, POST /complete/:resourceId, DELETE /uncomplete/:resourceId'),
        bullet('/api/interview-game: POST /start, GET /questions/:round, POST /submit-round, GET /history, GET /:id, GET /leaderboard/top'),
        bullet('/api/learning-paths: GET /, GET /:id, POST /generate, PATCH /:id/progress, DELETE /:id'),
        bullet('/api/resume-builder: GET /drafts, GET /drafts/:id, POST /drafts, PUT /drafts/:id, DELETE /drafts/:id, POST /generate, POST /cover-letter'),
        bullet('/api/resume-analysis: POST / (analyze), GET / (history), GET /:id'),
        bullet('/api/code-execution: POST /submit, POST /run-tests, POST /run-custom, GET /languages'),
        bullet('/api/group-discussion: POST /start, POST /respond, POST /evaluate'),
        bullet('/api/summarize: POST / (summarize article URL or text)'),
        bullet('/api/analytics: GET /dashboard'),
        bullet('/api/notifications: GET /, PATCH /:id/read, PATCH /read-all'),
        bullet('/api/availability: GET /:mentorId, POST /, DELETE /:id'),
        bullet('/api/companies: GET /, POST /, PUT /:id, DELETE /:id'),
        bullet('/api/coding-questions: GET /, GET /:id, POST /, PUT /:id, DELETE /:id'),

        subheading('3.5 AI Integration (Groq & Gemini)'),
        para('Two AI providers are used for different capabilities:'),
        para('Groq SDK (LLaMA 3.1-8b-instant):', true),
        bullet('Interview Game: Generates aptitude MCQs, technical MCQs, HR behavioral questions, GD topics, and coding problems with test cases. Uses temperature 0.8 for diversity, max_tokens 4000 for MCQs. JSON output with regex-based cleanup (removing markdown code fences).'),
        bullet('Learning Paths: Designs ordered roadmaps from resource lists. Temperature 0.4 for consistency, max_tokens 2000.'),
        bullet('Group Discussion: Simulates 4-5 AI participants with distinct personality profiles. Maintains conversation context across turns. Evaluates user performance across communication, content, leadership, and reasoning dimensions.'),
        bullet('Resume Builder: Generates professional summaries, ATS-optimized experience descriptions, and skill lists. Structured JSON output with strict format instructions to prevent raw JSON leaking into UI.'),
        bullet('Article Summarization: Fetches URL content via Axios, strips HTML tags, truncates to 8000 chars, generates bullet-point summary. Temperature 0.3 for factual accuracy.'),
        para('Google Gemini 2.0 Flash:', true),
        bullet('Resume ATS Analysis: Analyzes resume text against job description. Returns structured JSON with matchScore (0-100), missingKeywords array, redFlags array (ATS formatting issues), suggestions text, and starSuggestions array (STAR-method rewrites). Uses temperature 0.3 for analytical precision.'),
        bullet('Fallback: When Gemini API is unavailable, falls back to basic keyword matching — extracting JD words, comparing against resume words, computing match percentage.'),

        subheading('3.6 Real-Time Communication (Socket.IO)'),
        para('The socketHandler.js manages 5 categories of real-time events:'),
        bullet('Online Tracking: register-user event sets User.isOnline to true. On disconnect, checks if user has other active sockets before setting offline. Enables real-time mentor availability display.'),
        bullet('Interview Rooms: join-room/leave-room events with room participant tracking via Map. New joiners receive current code state (sync-code). All participants receive participant list updates (room-participants). Used by TechnicalInterview.jsx.'),
        bullet('Code Sync: code-change events broadcast code updates to all room participants except sender. cursor-change events share cursor positions for collaborative awareness.'),
        bullet('WebRTC Signaling: session-peer-id for PeerJS peer exchange, offer/answer/ice-candidate forwarding for NAT traversal. Used by VideoCall.jsx for mentor-mentee video calls.'),
        bullet('GD Video Rooms: Separate room management for group discussions. gd-video-join with PeerJS integration, peer-joined/peer-left notifications, timer alerts (5-min warning, 1-min warning, session end). Supports multi-peer video calls.'),
        bullet('Chat & Sessions: send-message/receive-message for in-room chat. join-session/end-session for mentorship video call rooms.'),

        subheading('3.7 Code Execution Engine'),
        para('The code execution pipeline (codeExecution.js) implements a dual-strategy approach:'),
        bullet('Primary: Judge0 CE — Self-hosted via Docker (judge0-docker-compose.yml). Submissions sent as POST to /submissions?base64_encoded=false&wait=true. Supports JavaScript (63), Python (71), Java (62), C++ (54), C (50).'),
        bullet('Fallback: Local execution via child_process — Used when Judge0 is unreachable. Creates temporary files in OS temp directory, executes with 10-second timeout, captures stdout/stderr, cleans up temp files.'),
        bullet('Security: Pre-execution validation with language-specific regex patterns — blocks require(fs/child_process/net), process.env, eval, exec, import os/subprocess, system(), Runtime.getRuntime().exec(). Code size limited to 50KB.'),
        bullet('Test Case Execution: POST /run-tests endpoint runs user code against multiple test cases sequentially, comparing stdout against expected output (trimmed). Returns per-test pass/fail status.'),

        subheading('3.8 Email Notification Service'),
        para('Implemented in utils/emailService.js using Nodemailer with Gmail SMTP:'),
        bullet('Configuration: Gmail service with app password authentication (EMAIL_USER, EMAIL_PASS env vars).'),
        bullet('Template: Styled HTML email with PRISM branding (dark theme, green accent), session details, and direct link to sessions page.'),
        bullet('Trigger: Automatically sent when a mentee books a session (mentorship.js POST handler). Non-blocking — uses catch to prevent email failures from blocking the session creation response.'),
        bullet('Graceful Degradation: If email credentials are not configured, createTransporter returns null and skips email silently with a console warning.'),

        // ==================== 4. FRONTEND IMPLEMENTATION ====================
        heading('4. Frontend Implementation'),

        subheading('4.1 React Application Structure'),
        para('The client is a Vite-powered React 19 SPA with the following structure:'),
        code('client/src/'),
        code('├── App.jsx          # Root component with routing'),
        code('├── index.css        # Global design system (CSS custom properties)'),
        code('├── context/'),
        code('│   └── AuthContext.jsx  # Authentication state management'),
        code('├── services/'),
        code('│   └── api.js       # Axios instance + all API functions'),
        code('├── components/'),
        code('│   ├── Layout.jsx   # Main layout with sidebar + content area'),
        code('│   ├── Sidebar.jsx  # Navigation sidebar with role-based menus'),
        code('│   └── Sidebar.css  # Sidebar responsive styles'),
        code('└── pages/           # 21 page components'),

        subheading('4.2 State Management & Auth Context'),
        para('PRISM uses React Context API (not Redux) for global state. The AuthContext provides:'),
        bullet('State: user object, loading boolean, token string.'),
        bullet('Actions: login(email, password), register(userData), logout(), updateUser(data).'),
        bullet('Persistence: JWT stored in localStorage. On app mount, token is checked and /api/auth/me is called to restore the session. Axios interceptor auto-attaches Bearer token to all requests.'),
        bullet('Per-page state: Each page component manages its own local state via useState hooks. No global state store needed since pages are independent and data is fetched on mount.'),

        subheading('4.3 Routing & Protected Routes'),
        para('React Router v7 with the following route structure:'),
        bullet('Public Routes: /login, /register — accessible without authentication.'),
        bullet('Protected Routes: All /dashboard/*, /resources, /mentors, /sessions, etc. — wrapped in ProtectedRoute component that checks AuthContext.user and redirects to /login if null.'),
        bullet('Standalone Routes: /interview/:id (TechnicalInterview), /video-call/:sessionId (VideoCall) — protected but rendered outside the Layout sidebar.'),
        bullet('Nested Routes: All main pages are nested under / with Layout as the parent route, which renders the Sidebar and an Outlet for child pages.'),
        bullet('Catch-All: /* renders NotFound.jsx.'),

        subheading('4.4 UI Design System'),
        para('The global design system is defined in index.css using CSS custom properties (variables):'),
        bullet('Color Palette: Dark theme with --bg-primary (#050d0e), --bg-secondary (#0a1a1c), --bg-card (#0f2427). Accent colors: --accent-primary (#10b981, emerald green), --accent-info (#06b6d4, cyan), --accent-warning (#f59e0b, amber), --accent-danger (#ef4444, red), --accent-success (#10b981, green).'),
        bullet('Typography: Inter font family loaded from Google Fonts. Base size 14px, heading hierarchy from 28px (h1) to 14px (h6).'),
        bullet('Components: .glass-card (glassmorphism with backdrop-filter: blur + semi-transparent border), .btn (primary/secondary/danger/success variants with gradient backgrounds), .badge (colored pills), .form-input/.form-select/.form-textarea (dark-themed inputs), .modal-overlay + .modal (centered modals with backdrop), .progress-bar + .fill (animated progress), .chat-bubble (AI vs user message styling), .stat-card (dashboard statistics), .video-embed-container (16:9 responsive iframe).'),
        bullet('Animations: @keyframes fadeIn, slideUp, pulse, shimmer. Smooth transitions on all interactive elements (0.3s ease). Gradient shift animation on primary buttons.'),
        bullet('Responsive: Media queries at 768px (tablet) and 480px (mobile). Grid system collapses from multi-column to single-column. Sidebar becomes slide-out overlay on mobile.'),

        subheading('4.5 Page-by-Page Implementation'),
        
        para('Dashboard.jsx (16KB):', true),
        bullet('Fetches analytics data from /api/analytics/dashboard on mount.'),
        bullet('Displays stat cards (resources completed, games played, best score, overall progress).'),
        bullet('Renders Recharts RadarChart for skill breakdown (Technical, Communication, Confidence, Problem Solving).'),
        bullet('Shows topic progress bars, weakness alerts, and quick-action buttons.'),

        para('InterviewGame.jsx (71KB — largest component):', true),
        bullet('Multi-phase state machine: setup → playing (6 rounds) → results.'),
        bullet('Round-specific UIs: MCQ grid with timer for aptitude/technical, Monaco Editor with test runner for coding, chat interface for GD, text area for HR.'),
        bullet('Live scoring animations, round progression sidebar, detailed feedback per round.'),
        bullet('Leaderboard integration showing top performers.'),

        para('ResumeBuilder.jsx (29KB):', true),
        bullet('Tab-based form: Personal Info, Education, Experience, Skills, Projects, Certifications, Cover Letter.'),
        bullet('Live preview panel with 3 switchable templates (Modern/Classic/Creative).'),
        bullet('AI content generation buttons that call /api/resume-builder/generate.'),
        bullet('Export: PDF via html2pdf.js, DOCX via docx npm package.'),

        para('Resources.jsx (22KB):', true),
        bullet('Filter bar: topic dropdown, level selector, type selector, search input.'),
        bullet('Expandable resource cards: YouTube videos embed via iframe, articles show rich preview card with domain and AI summary button, PDFs/links show card with external link.'),
        bullet('AI Summary: Calls /api/summarize which fetches article content and generates bullet-point summary via Groq.'),
        bullet('Completion tracking: checkmark toggle per resource, synced with Progress model.'),

        para('GDRooms.jsx (23KB):', true),
        bullet('Chat-style interface with AI participants showing distinct avatars/names.'),
        bullet('Timestamp-based message flow with typing indicators.'),
        bullet('PeerJS video call integration for multi-user group discussions.'),
        bullet('AI evaluation button generating scores across multiple dimensions.'),

        para('Sessions.jsx (9KB):', true),
        bullet('Lists mentorship sessions with status badges (pending/approved/completed/etc).'),
        bullet('"Start Call" button navigates to /video-call/:sessionId for approved sessions.'),
        bullet('Rating modal with 1-5 star selector and feedback textarea for completed sessions.'),
        bullet('Role-aware: mentors see approve/reject actions, mentees see booking and rating.'),

        para('TechnicalInterview.jsx (38KB):', true),
        bullet('Dual-mode: AI-only (when no mentor joins the socket room) vs mentor-led (when mentor connects).'),
        bullet('Monaco Editor for collaborative coding with real-time sync via Socket.IO.'),
        bullet('WebRTC video call with PeerJS for face-to-face technical interviews.'),
        bullet('Code execution panel with Judge0 integration.'),

        para('VideoCall.jsx (7KB):', true),
        bullet('Dedicated 1:1 video call page using PeerJS.'),
        bullet('Controls: mute/unmute, camera on/off, screen share, end call.'),
        bullet('Elapsed time counter. Auto-cleanup of media streams on unmount.'),
        bullet('Socket.IO session room joining for peer discovery.'),

        para('LearningPaths.jsx (12KB):', true),
        bullet('Path creation modal with topic dropdown (showing resource counts, disabling topics with 0 resources).'),
        bullet('AI generation via /api/learning-paths/generate with loading state and error display.'),
        bullet('Step-by-step timeline view with checkmark completion tracking.'),
        bullet('Progress bar computed from completed/total steps ratio.'),

        para('Mentors.jsx (21KB):', true),
        bullet('Grid of mentor cards with online status indicator, skills, rating, and company.'),
        bullet('Filter by expertise, company, and experience level.'),
        bullet('Session booking modal with date picker, duration, and agenda input.'),

        para('Analytics.jsx (8KB):', true),
        bullet('Recharts-powered visualizations: RadarChart for skill breakdown, BarChart for round averages.'),
        bullet('Topic progress section with color-coded bars.'),
        bullet('Weakness detection alerts with improvement suggestions.'),

        para('ResumeAnalysis.jsx (11KB):', true),
        bullet('Two-pane input: resume text area + job description text area.'),
        bullet('ATS match score displayed as animated circular gauge.'),
        bullet('Missing keywords shown as red badges, suggestions in expandable sections.'),
        bullet('History list of past analyses with timestamp and score.'),

        // ==================== 5. FEATURE DEEP DIVES ====================
        heading('5. Feature Deep Dives'),

        subheading('5.1 Interview Simulation Game — Technical Flow'),
        para('The interview game is the platform\'s flagship feature, simulating a complete placement process:'),
        bullet('Step 1 — Game Start: User selects difficulty (easy/medium/hard) and optional company focus. POST /api/interview-game/start creates an InterviewGame document with 6 round stubs (status: pending).'),
        bullet('Step 2 — Round Generation: GET /api/interview-game/questions/:round generates questions dynamically via Groq LLM. For aptitude/technical: 10 MCQs as JSON array [{q, opts, ans}]. For coding: 2 problems with test cases and boilerplate code. For GD: a debatable topic. For HR: 5 behavioral questions.'),
        bullet('Step 3 — Round Submission: POST /api/interview-game/submit-round receives answers, calculates scores (MCQ: 10 points each, Coding: score based on test cases passed, GD/HR: AI evaluation via Groq). Updates round status to "completed" and advances currentRound.'),
        bullet('Step 4 — Results: After all 6 rounds, game status becomes "completed". Frontend displays per-round scores, total score, strengths/weaknesses analysis, and updates the leaderboard.'),

        subheading('5.2 AI Learning Path Generation — Technical Flow'),
        bullet('Step 1: User selects a topic and difficulty level. Frontend shows resource count per topic (fetched via getResources), disabling topics with 0 resources.'),
        bullet('Step 2: POST /api/learning-paths/generate is called. Backend fetches all Resources for the topic, creates a resource list string with IDs, titles, levels, and types.'),
        bullet('Step 3: Groq LLM receives the resource list with a system prompt instructing it to design an ordered path of 15-25 steps. Returns JSON array with resourceId, order, title, description, estimatedTime.'),
        bullet('Step 4: Backend maps AI output to actual Resource documents (resolving IDs), creates a LearningPath document with embedded steps, and returns to client.'),
        bullet('Step 5: User progresses through steps, toggling completion via PATCH. Progress percentage auto-computed ( completedSteps / totalSteps × 100).'),
        bullet('Fallback: If GROQ_API_KEY is missing, resources are simply ordered by difficulty level (beginner → intermediate → advanced).'),

        subheading('5.3 Resume Builder & ATS Analysis — Technical Flow'),
        para('Resume Builder:', true),
        bullet('Data is stored in ResumeDraft model with sections for personalInfo, education, experience, skills, projects, certifications, and coverLetter.'),
        bullet('AI Generation: POST /api/resume-builder/generate sends user profile to Groq, which returns {summary, experienceDescriptions, skillsOptimized, additionalSuggestions}. Frontend merges suggestions into the form.'),
        bullet('Cover Letter: POST /api/resume-builder/cover-letter generates a targeted cover letter using job title, company name, and user skills.'),
        bullet('Export: Frontend renders the resume preview using styled HTML, then converts to PDF via html2pdf.js or to DOCX using the docx npm package with programmatic document building.'),
        para('ATS Analysis:', true),
        bullet('POST /api/resume-analysis sends resumeText and jobDescription to the server.'),
        bullet('If GEMINI_API_KEY is configured: Sends structured prompt to Gemini 2.0 Flash requesting matchScore, missingKeywords, redFlags, suggestions, and starSuggestions. Parses JSON from response using regex.'),
        bullet('Rate limited: 10 requests per 15 minutes via express-rate-limit to prevent API abuse.'),
        bullet('Results stored in ResumeAnalysis model for history tracking.'),

        subheading('5.4 Mentorship & Video Calls — Technical Flow'),
        bullet('Discovery: Mentees browse /mentors page, filter by expertise/company. Mentor online status is maintained via Socket.IO register-user/disconnect events.'),
        bullet('Booking: POST /api/mentorship validates: no past dates, no self-booking, no double-booking (checks for time overlap with existing sessions). Creates session with status "pending". Sends in-app Notification and email via Nodemailer.'),
        bullet('Approval: Mentor receives notification, navigates to /sessions, clicks Approve/Reject. PATCH /api/mentorship/:id/status updates status. Notifies mentee via in-app notification.'),
        bullet('Video Call: Mentee clicks "Start Call" → navigates to /video-call/:sessionId. VideoCall.jsx gets user media (camera + mic), connects to Socket.IO (join-session), creates PeerJS peer. When both parties join, WebRTC peer connection is established for live video.'),
        bullet('Rating: After session completion, mentee can rate 1-5 stars with feedback. PATCH /api/mentorship/:id/rate updates mentor\'s running average: newRating = (oldRating × totalReviews + givenRating) / (totalReviews + 1).'),

        subheading('5.5 Group Discussion Simulation — Technical Flow'),
        bullet('Start: POST /api/group-discussion/start optionally accepts a customTopic, otherwise generates one via Groq. Selects 4-5 AI participants from 5 profiles with distinct discussion styles.'),
        bullet('Conversation Flow: POST /api/group-discussion/respond sends user message + conversation context. AI generates 2-3 participant responses, each in-character (analytical, passionate, diplomatic, etc). Context grows with each exchange.'),
        bullet('Evaluation: POST /api/group-discussion/evaluate sends full conversation to Groq with evaluation prompt measuring Communication Skills, Content Quality, Leadership, Logical Reasoning, Team Player attitude on a scale of 0-100 each.'),

        subheading('5.6 Collaborative Code Editor — Technical Flow'),
        bullet('Editor: Monaco Editor React component (@monaco-editor/react) with syntax highlighting for JavaScript, Python, Java, C++, C.'),
        bullet('Real-Time Sync: On each keystroke, code-change event is emitted via Socket.IO. All room participants receive code-update and update their editor state. Cursor positions are shared via cursor-change events.'),
        bullet('Execution: User clicks Run → POST /api/code-execution/submit → security validation → Judge0 submission → results returned. For coding round: POST /run-tests runs all test cases.'),

        // ==================== 6. SECURITY ====================
        heading('6. Security Implementation'),
        bullet('Authentication: bcryptjs with 10 salt rounds for password hashing. JWT tokens with configurable expiry. Tokens verified on every protected route.'),
        bullet('Authorization: Role-based middleware restricting routes to specific roles (mentee-only booking, admin-only user deletion).'),
        bullet('Input Validation: Email regex, name length constraints, password minimums, past-date rejection, self-booking prevention, double-booking detection, session rating constraints (1-5).'),
        bullet('Code Execution Security: Language-specific regex patterns blocking dangerous operations (file I/O, system commands, network access, process manipulation). Code size limit (50KB). Execution timeout (10s).'),
        bullet('Rate Limiting: express-rate-limit on resume analysis (10 requests per 15 minutes).'),
        bullet('CORS: Configured in server.js for cross-origin requests between frontend and backend.'),
        bullet('API Error Handling: Global error middleware catches unhandled errors. Per-route try/catch blocks return structured error responses.'),

        // ==================== 7. DEPLOYMENT ====================
        heading('7. Deployment & Environment Configuration'),
        para('Required environment variables (server/.env):'),
        code('MONGO_URI=mongodb+srv://<username>:<password>@cluster.mongodb.net/prism'),
        code('JWT_SECRET=<random-256-bit-secret>'),
        code('JWT_EXPIRE=7d'),
        code('PORT=5000'),
        code('GROQ_API_KEY=gsk_<your-groq-api-key>'),
        code('GEMINI_API_KEY=<your-gemini-api-key>'),
        code('EMAIL_USER=<gmail-address>'),
        code('EMAIL_PASS=<gmail-app-password>'),
        code('CLIENT_URL=http://localhost:5173'),
        code('JUDGE0_API_URL=http://localhost:2358'),

        para('Required environment variables (client/.env):'),
        code('VITE_API_URL=http://localhost:5000/api'),
        code('VITE_SOCKET_URL=http://localhost:5000'),

        para('Judge0 CE Deployment:'),
        code('docker-compose -f judge0-docker-compose.yml up -d'),
        para('This starts Judge0 CE with PostgreSQL on ports 2358 (API) and 5432 (DB).'),

        para('Development Commands:'),
        code('cd server && npm run dev     # Starts backend with --watch'),
        code('cd client && npm run dev     # Starts Vite dev server'),
        code('cd client && npm run build   # Production build'),
      ]
    }]
  });
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================
function heading(text) {
  return new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { before: 400, after: 200 }, children: [new TextRun({ text, bold: true, size: 32, font: 'Calibri', color: '10B981' })] });
}

function subheading(text) {
  return new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 150 }, children: [new TextRun({ text, bold: true, size: 26, font: 'Calibri', color: '0D9488' })] });
}

function para(text, bold = false) {
  return new Paragraph({ spacing: { after: 150 }, children: [new TextRun({ text, size: 22, font: 'Calibri', bold })] });
}

function bullet(text) {
  return new Paragraph({ bullet: { level: 0 }, spacing: { after: 80 }, children: [new TextRun({ text, size: 22, font: 'Calibri' })] });
}

function code(text) {
  return new Paragraph({ spacing: { after: 60 }, indent: { left: 720 }, children: [new TextRun({ text, size: 20, font: 'Consolas', color: '6EE7B7' })] });
}

function tocEntry(text) {
  return new Paragraph({ spacing: { after: 60 }, children: [new TextRun({ text, size: 22, font: 'Calibri', color: '94A3B8' })] });
}

// ============================================================
// GENERATE BOTH DOCUMENTS
// ============================================================
async function main() {
  console.log('📄 Generating Document 1: Project Abstract...');
  const abstractDoc = createAbstractDoc();
  const abstractBuffer = await Packer.toBuffer(abstractDoc);
  fs.writeFileSync('PRISM_Abstract.docx', abstractBuffer);
  console.log('✅ PRISM_Abstract.docx created');

  console.log('📄 Generating Document 2: Detailed Implementation...');
  const implDoc = createImplementationDoc();
  const implBuffer = await Packer.toBuffer(implDoc);
  fs.writeFileSync('PRISM_Implementation_Document.docx', implBuffer);
  console.log('✅ PRISM_Implementation_Document.docx created');

  console.log('\n🎉 Both documents generated successfully!');
}

main().catch(console.error);
