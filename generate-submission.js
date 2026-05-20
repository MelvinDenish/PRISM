const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, Table, TableRow, TableCell, WidthType, BorderStyle } = require('docx');
const fs = require('fs');

function createSubmissionDoc() {
  const border = { style: BorderStyle.SINGLE, size: 1, color: '999999' };
  const borders = { top: border, bottom: border, left: border, right: border };

  const cell = (text, bold = false, width = undefined, shading = undefined) => {
    const opts = { children: [new Paragraph({ spacing: { before: 40, after: 40 }, children: [new TextRun({ text, size: 22, font: 'Calibri', bold })] })], borders };
    if (width) opts.width = { size: width, type: WidthType.PERCENTAGE };
    if (shading) opts.shading = { type: 'clear', fill: shading };
    return new TableCell(opts);
  };

  const heading = (text) => new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { before: 400, after: 200 }, children: [new TextRun({ text, bold: true, size: 30, font: 'Calibri', color: '10B981' })] });
  const subheading = (text) => new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 150 }, children: [new TextRun({ text, bold: true, size: 26, font: 'Calibri', color: '0D9488' })] });
  const para = (text, bold = false) => new Paragraph({ spacing: { after: 120 }, children: [new TextRun({ text, size: 22, font: 'Calibri', bold })] });
  const bullet = (text) => new Paragraph({ bullet: { level: 0 }, spacing: { after: 60 }, children: [new TextRun({ text, size: 22, font: 'Calibri' })] });
  const code = (text) => new Paragraph({ spacing: { after: 40 }, indent: { left: 360 }, children: [new TextRun({ text, size: 20, font: 'Consolas', color: '374151' })] });
  const spacer = (n = 200) => new Paragraph({ spacing: { after: n }, children: [] });

  return new Document({
    styles: { default: { document: { run: { font: 'Calibri', size: 22 } } } },
    sections: [{
      properties: { page: { margin: { top: 1200, bottom: 1200, left: 1200, right: 1200 } } },
      children: [

        // ==================== FRONT PAGE ====================
        spacer(600),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 60 }, children: [new TextRun({ text: 'Anna University', size: 28, font: 'Calibri', bold: true })] }),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 60 }, children: [new TextRun({ text: 'College of Engineering Guindy', size: 24, font: 'Calibri', color: '444444' })] }),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 60 }, children: [new TextRun({ text: 'Department of Computer Science and Engineering', size: 22, font: 'Calibri', color: '666666' })] }),
        spacer(300),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 80 }, children: [new TextRun({ text: 'PRISM', bold: true, size: 56, font: 'Calibri', color: '10B981' })] }),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 60 }, children: [new TextRun({ text: 'Placement Resources & Interview Skill Manager', bold: true, size: 30, font: 'Calibri' })] }),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 300 }, children: [new TextRun({ text: 'Full Stack Development Project', size: 24, font: 'Calibri', color: '888888' })] }),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 300 }, children: [new TextRun({ text: '─────────────────────────────────────', color: '10B981', size: 24 })] }),

        // Team Info Table
        new Table({
          width: { size: 60, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({ children: [cell('Team No.', true, 40, 'F0F0F0'), cell('13', false, 60)] }),
            new TableRow({ children: [cell('Subject', true, 40, 'F0F0F0'), cell('Full Stack Development', false, 60)] }),
          ]
        }),
        spacer(300),

        // Student Details Table
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 150 }, children: [new TextRun({ text: 'Team Members', bold: true, size: 26, font: 'Calibri' })] }),
        new Table({
          width: { size: 80, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({ children: [cell('S.No', true, 10, 'E8F5E9'), cell('Register Number', true, 30, 'E8F5E9'), cell('Student Name', true, 35, 'E8F5E9'), cell('Role', true, 25, 'E8F5E9')] }),
            new TableRow({ children: [cell('1', false, 10), cell('[RegNo]', false, 30), cell('Mohammed Muksith', false, 35), cell('Backend Core & Auth', false, 25)] }),
            new TableRow({ children: [cell('2', false, 10), cell('[RegNo]', false, 30), cell('Melvin Denish', false, 35), cell('AI Features & Interview', false, 25)] }),
            new TableRow({ children: [cell('3', false, 10), cell('[RegNo]', false, 30), cell('Nithish', false, 35), cell('Frontend UI & Resume', false, 25)] }),
          ]
        }),
        spacer(400),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 100 }, children: [new TextRun({ text: 'Submitted on: April 2026', size: 22, font: 'Calibri', color: '888888' })] }),

        // Page break
        new Paragraph({ pageBreakBefore: true, children: [] }),

        // ==================== TABLE OF CONTENTS ====================
        heading('Table of Contents'),
        para('1. Final List of Modules'),
        para('2. Project Structure'),
        para('3. Module-wise Code Files & Libraries'),
        para('   3.1 Module 1: Authentication & User Management'),
        para('   3.2 Module 2: Mentorship & Session Management'),
        para('   3.3 Module 3: Resource Management & Learning Paths'),
        para('   3.4 Module 4: Interview Simulation Game'),
        para('   3.5 Module 5: AI Integration Services'),
        para('   3.6 Module 6: Resume Builder & ATS Analysis'),
        para('   3.7 Module 7: Code Execution Engine'),
        para('   3.8 Module 8: Group Discussion Simulation'),
        para('   3.9 Module 9: Real-Time Communication'),
        para('   3.10 Module 10: Analytics & Dashboard'),
        para('   3.11 Module 11: Admin & Notifications'),
        para('   3.12 Module 12: UI Design System & Layout'),
        spacer(200),

        // ==================== 1. FINAL LIST OF MODULES ====================
        new Paragraph({ pageBreakBefore: true, children: [] }),
        heading('1. Final List of Modules'),
        para('The PRISM platform is organized into 12 functional modules:'),
        spacer(100),

        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({ children: [cell('Module No.', true, 10, 'E8F5E9'), cell('Module Name', true, 30, 'E8F5E9'), cell('Description', true, 40, 'E8F5E9'), cell('Owner', true, 20, 'E8F5E9')] }),
            new TableRow({ children: [cell('M1', false, 10), cell('Authentication & User Management', false, 30), cell('JWT login/register, role-based access (mentee/mentor/admin), profile CRUD, password hashing', false, 40), cell('Mohammed Muksith', false, 20)] }),
            new TableRow({ children: [cell('M2', false, 10), cell('Mentorship & Sessions', false, 30), cell('Session booking with conflict detection, approval workflow, video calls via WebRTC/PeerJS, rating system, email notifications', false, 40), cell('Mohammed Muksith', false, 20)] }),
            new TableRow({ children: [cell('M3', false, 10), cell('Resources & Learning Paths', false, 30), cell('Resource CRUD with filters, in-app YouTube embedding, AI article summarization, AI-generated learning roadmaps with progress tracking', false, 40), cell('Melvin Denish', false, 20)] }),
            new TableRow({ children: [cell('M4', false, 10), cell('Interview Simulation Game', false, 30), cell('6-round gamified interview: Aptitude, Technical R1, Coding, GD, Technical R2, HR with AI-generated questions and leaderboard', false, 40), cell('Member 2', false, 20)] }),
            new TableRow({ children: [cell('M5', false, 10), cell('AI Integration Services', false, 30), cell('Groq LLM (LLaMA 3.1) for question generation, evaluation, summarization; Gemini for ATS analysis', false, 40), cell('Member 2', false, 20)] }),
            new TableRow({ children: [cell('M6', false, 10), cell('Resume Builder & ATS Analysis', false, 30), cell('Multi-template resume builder, AI content generation, cover letter, PDF/DOCX export, ATS scoring with keyword analysis', false, 40), cell('Nithish', false, 20)] }),
            new TableRow({ children: [cell('M7', false, 10), cell('Code Execution Engine', false, 30), cell('Judge0 CE integration with Docker, 5-language support, security validation, local fallback execution', false, 40), cell('Member 2', false, 20)] }),
            new TableRow({ children: [cell('M8', false, 10), cell('Group Discussion Simulation', false, 30), cell('AI-powered GD with 5 distinct participant personalities, multi-turn conversation, performance evaluation', false, 40), cell('Member 2', false, 20)] }),
            new TableRow({ children: [cell('M9', false, 10), cell('Real-Time Communication', false, 30), cell('Socket.IO for code sync, chat, notifications, online tracking; PeerJS/WebRTC for video calls', false, 40), cell('Member 1', false, 20)] }),
            new TableRow({ children: [cell('M10', false, 10), cell('Analytics & Dashboard', false, 30), cell('Performance tracking, Recharts visualizations, weakness detection, topic progress, game score aggregation', false, 40), cell('Member 1', false, 20)] }),
            new TableRow({ children: [cell('M11', false, 10), cell('Admin & Notifications', false, 30), cell('Admin panel for user/topic/company management, in-app notification system with read/unread state', false, 40), cell('Member 1', false, 20)] }),
            new TableRow({ children: [cell('M12', false, 10), cell('UI Design System & Layout', false, 30), cell('CSS custom properties, glassmorphism theme, responsive sidebar, mobile layout, animations', false, 40), cell('Nithish', false, 20)] }),
          ]
        }),

        // ==================== 2. PROJECT STRUCTURE ====================
        new Paragraph({ pageBreakBefore: true, children: [] }),
        heading('2. Project Structure'),
        spacer(100),

        subheading('2.1 Overall Directory Structure'),
        code('PRISM/'),
        code('├── client/                    # React Frontend (Vite)'),
        code('│   ├── src/'),
        code('│   │   ├── App.jsx            # Root routing component'),
        code('│   │   ├── index.css           # Global design system'),
        code('│   │   ├── context/'),
        code('│   │   │   └── AuthContext.jsx  # Auth state management'),
        code('│   │   ├── services/'),
        code('│   │   │   └── api.js          # Axios API client (50+ endpoints)'),
        code('│   │   ├── components/'),
        code('│   │   │   ├── Layout.jsx      # Main layout wrapper'),
        code('│   │   │   ├── Sidebar.jsx     # Role-based navigation'),
        code('│   │   │   └── Sidebar.css     # Sidebar responsive styles'),
        code('│   │   └── pages/              # 21 page components'),
        code('│   │       ├── Login.jsx, Register.jsx'),
        code('│   │       ├── Dashboard.jsx, Analytics.jsx'),
        code('│   │       ├── Resources.jsx, LearningPaths.jsx, Topics.jsx'),
        code('│   │       ├── Mentors.jsx, MentorProfile.jsx, Sessions.jsx'),
        code('│   │       ├── InterviewGame.jsx (71KB - largest)'),
        code('│   │       ├── TechnicalInterview.jsx, VideoCall.jsx'),
        code('│   │       ├── GDRooms.jsx'),
        code('│   │       ├── ResumeBuilder.jsx, ResumeAnalysis.jsx'),
        code('│   │       ├── CodingQuestions.jsx, Companies.jsx'),
        code('│   │       ├── Admin.jsx, Notifications.jsx, NotFound.jsx'),
        code('│   │       └── AIInterview.jsx'),
        code('│   ├── package.json'),
        code('│   └── vite.config.js'),
        code('│'),
        code('├── server/                    # Node.js Backend (Express)'),
        code('│   ├── server.js              # Entry point, route mounting'),
        code('│   ├── middleware/'),
        code('│   │   └── auth.js            # JWT protect & role authorize'),
        code('│   ├── models/                # 18 Mongoose schemas'),
        code('│   │   ├── User.js, MentorshipSession.js, Resource.js'),
        code('│   │   ├── Topic.js, Company.js, Notification.js'),
        code('│   │   ├── Progress.js, Availability.js'),
        code('│   │   ├── InterviewGame.js, QuestionBank.js'),
        code('│   │   ├── LearningPath.js, ResumeDraft.js, ResumeAnalysis.js'),
        code('│   │   ├── CodingQuestion.js, CodeSubmission.js'),
        code('│   │   ├── GDRoom.js, MockInterview.js, MockFeedback.js'),
        code('│   ├── routes/                # 18+ API route files'),
        code('│   │   ├── auth.js, users.js'),
        code('│   │   ├── mentorship.js, availability.js'),
        code('│   │   ├── resources.js, topics.js, companies.js'),
        code('│   │   ├── progress.js, notifications.js, analytics.js'),
        code('│   │   ├── interviewGame.js, aiInterview.js'),
        code('│   │   ├── codeExecution.js, codingQuestions.js'),
        code('│   │   ├── groupDiscussion.js, gdRooms.js'),
        code('│   │   ├── resumeBuilder.js, resumeAnalysis.js'),
        code('│   │   ├── learningPaths.js, summarize.js'),
        code('│   │   └── mockInterviews.js, mockFeedback.js, codeSubmissions.js'),
        code('│   ├── socket/'),
        code('│   │   └── socketHandler.js   # Real-time event management'),
        code('│   ├── utils/'),
        code('│   │   └── emailService.js    # Nodemailer email sender'),
        code('│   ├── seeds/'),
        code('│   │   └── seedAll.js         # Database seed script'),
        code('│   ├── package.json'),
        code('│   └── .env                   # Environment variables'),
        code('│'),
        code('└── judge0-docker-compose.yml  # Judge0 CE code execution engine'),

        // ==================== 3. MODULE-WISE DETAILS ====================
        new Paragraph({ pageBreakBefore: true, children: [] }),
        heading('3. Module-wise Code Files & Libraries'),

        // M1
        subheading('3.1 Module 1: Authentication & User Management'),
        para('Purpose: User registration, login, JWT-based authentication, role-based access control, and profile management.'),
        spacer(50),
        para('Code Files:', true),
        new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [
          new TableRow({ children: [cell('File', true, 45, 'F0F0F0'), cell('Purpose', true, 55, 'F0F0F0')] }),
          new TableRow({ children: [cell('server/routes/auth.js'), cell('POST /register, POST /login, GET /me endpoints')] }),
          new TableRow({ children: [cell('server/routes/users.js'), cell('GET /mentors, GET /:id, PUT /profile, DELETE /:id')] }),
          new TableRow({ children: [cell('server/middleware/auth.js'), cell('JWT verification (protect) and role check (authorize)')] }),
          new TableRow({ children: [cell('server/models/User.js'), cell('Mongoose schema: name, email, password, role, skills, rating')] }),
          new TableRow({ children: [cell('client/src/context/AuthContext.jsx'), cell('React Context for auth state, login/logout functions')] }),
          new TableRow({ children: [cell('client/src/pages/Login.jsx'), cell('Login form with email/password')] }),
          new TableRow({ children: [cell('client/src/pages/Register.jsx'), cell('Registration form with role selection')] }),
        ]}),
        spacer(80),
        para('Libraries Used:', true),
        new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [
          new TableRow({ children: [cell('Library', true, 30, 'F0F0F0'), cell('Version', true, 15, 'F0F0F0'), cell('Usage', true, 55, 'F0F0F0')] }),
          new TableRow({ children: [cell('jsonwebtoken'), cell('^9.0.2'), cell('JWT token generation and verification')] }),
          new TableRow({ children: [cell('bcryptjs'), cell('^2.4.3'), cell('Password hashing with salt rounds (10)')] }),
          new TableRow({ children: [cell('mongoose'), cell('^8.6.0'), cell('MongoDB ODM for User schema')] }),
          new TableRow({ children: [cell('axios'), cell('^1.13.6'), cell('HTTP client for API calls (client-side)')] }),
          new TableRow({ children: [cell('react-router-dom'), cell('^7.13.1'), cell('Client-side routing and navigation')] }),
        ]}),

        // M2
        spacer(200),
        subheading('3.2 Module 2: Mentorship & Session Management'),
        para('Purpose: Session booking with conflict detection, approval workflow, video calls, rating/feedback, and email notifications.'),
        spacer(50),
        para('Code Files:', true),
        new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [
          new TableRow({ children: [cell('File', true, 45, 'F0F0F0'), cell('Purpose', true, 55, 'F0F0F0')] }),
          new TableRow({ children: [cell('server/routes/mentorship.js'), cell('POST / (book), GET / (list), PATCH /:id/status, PATCH /:id/rate')] }),
          new TableRow({ children: [cell('server/routes/availability.js'), cell('Mentor availability slot management')] }),
          new TableRow({ children: [cell('server/models/MentorshipSession.js'), cell('Schema: mentor, mentee, status workflow, feedback, rating')] }),
          new TableRow({ children: [cell('server/models/Availability.js'), cell('Schema: mentor availability time slots')] }),
          new TableRow({ children: [cell('server/utils/emailService.js'), cell('Nodemailer Gmail SMTP email sender')] }),
          new TableRow({ children: [cell('client/src/pages/Sessions.jsx'), cell('Session list with status badges, rating modal')] }),
          new TableRow({ children: [cell('client/src/pages/Mentors.jsx'), cell('Mentor grid with filters, booking modal')] }),
          new TableRow({ children: [cell('client/src/pages/MentorProfile.jsx'), cell('Individual mentor profile with skills/reviews')] }),
          new TableRow({ children: [cell('client/src/pages/VideoCall.jsx'), cell('1:1 PeerJS video call with controls')] }),
        ]}),
        spacer(80),
        para('Libraries Used:', true),
        new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [
          new TableRow({ children: [cell('Library', true, 30, 'F0F0F0'), cell('Version', true, 15, 'F0F0F0'), cell('Usage', true, 55, 'F0F0F0')] }),
          new TableRow({ children: [cell('nodemailer'), cell('^8.0.3'), cell('Gmail SMTP email notifications to mentors')] }),
          new TableRow({ children: [cell('peerjs'), cell('^1.5.5'), cell('WebRTC peer-to-peer video call abstraction')] }),
          new TableRow({ children: [cell('socket.io-client'), cell('^4.8.3'), cell('Real-time session room joining')] }),
        ]}),

        // M3
        new Paragraph({ pageBreakBefore: true, children: [] }),
        subheading('3.3 Module 3: Resources & Learning Paths'),
        para('Purpose: Curated learning resources with filters, in-app YouTube embedding, AI article summarization, and AI-generated learning roadmaps.'),
        spacer(50),
        para('Code Files:', true),
        new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [
          new TableRow({ children: [cell('File', true, 45, 'F0F0F0'), cell('Purpose', true, 55, 'F0F0F0')] }),
          new TableRow({ children: [cell('server/routes/resources.js'), cell('CRUD with topic/level/type filters')] }),
          new TableRow({ children: [cell('server/routes/learningPaths.js'), cell('AI-generated learning path creation, progress tracking')] }),
          new TableRow({ children: [cell('server/routes/summarize.js'), cell('Article URL fetching + Groq LLM summarization')] }),
          new TableRow({ children: [cell('server/routes/progress.js'), cell('Resource completion tracking per user')] }),
          new TableRow({ children: [cell('server/models/Resource.js'), cell('Schema: title, topic ref, level, type, link')] }),
          new TableRow({ children: [cell('server/models/LearningPath.js'), cell('Schema: user, topic, steps array with completion')] }),
          new TableRow({ children: [cell('server/models/Progress.js'), cell('Schema: completedResources, topicProgress')] }),
          new TableRow({ children: [cell('client/src/pages/Resources.jsx'), cell('Filter bar, expandable cards, YouTube embed, AI summary')] }),
          new TableRow({ children: [cell('client/src/pages/LearningPaths.jsx'), cell('Path creation modal, step timeline, progress tracking')] }),
        ]}),
        spacer(80),
        para('Libraries Used:', true),
        new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [
          new TableRow({ children: [cell('Library', true, 30, 'F0F0F0'), cell('Version', true, 15, 'F0F0F0'), cell('Usage', true, 55, 'F0F0F0')] }),
          new TableRow({ children: [cell('groq-sdk'), cell('^1.1.1'), cell('LLaMA 3.1 for learning path design & article summarization')] }),
          new TableRow({ children: [cell('axios (server)'), cell('^1.13.6'), cell('Fetch article HTML content from URLs')] }),
        ]}),

        // M4
        spacer(200),
        subheading('3.4 Module 4: Interview Simulation Game'),
        para('Purpose: 6-round gamified interview simulation (Aptitude → Technical R1 → Coding → GD → Technical R2 → HR) with AI-generated questions, scoring, and leaderboard.'),
        spacer(50),
        para('Code Files:', true),
        new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [
          new TableRow({ children: [cell('File', true, 45, 'F0F0F0'), cell('Purpose', true, 55, 'F0F0F0')] }),
          new TableRow({ children: [cell('server/routes/interviewGame.js (15KB)'), cell('Game start, question generation, round submission, leaderboard')] }),
          new TableRow({ children: [cell('server/models/InterviewGame.js'), cell('Schema: rounds sub-docs, scores, status, difficulty')] }),
          new TableRow({ children: [cell('server/models/QuestionBank.js'), cell('Polymorphic schema: MCQ, HR, coding question types')] }),
          new TableRow({ children: [cell('client/src/pages/InterviewGame.jsx (71KB)'), cell('Multi-phase UI: setup → 6 rounds → results, MCQ grid, code editor, GD chat, HR answers')] }),
        ]}),
        spacer(80),
        para('Libraries Used:', true),
        new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [
          new TableRow({ children: [cell('Library', true, 30, 'F0F0F0'), cell('Version', true, 15, 'F0F0F0'), cell('Usage', true, 55, 'F0F0F0')] }),
          new TableRow({ children: [cell('groq-sdk'), cell('^1.1.1'), cell('AI question generation (MCQ, HR, GD topics, coding problems)')] }),
          new TableRow({ children: [cell('@monaco-editor/react'), cell('^4.7.0'), cell('Code editor for coding round')] }),
          new TableRow({ children: [cell('framer-motion'), cell('^12.35.1'), cell('Round transition animations')] }),
        ]}),

        // M5
        new Paragraph({ pageBreakBefore: true, children: [] }),
        subheading('3.5 Module 5: AI Integration Services'),
        para('Purpose: Central AI capabilities powering question generation, evaluation, content generation, and summarization across all features.'),
        spacer(50),
        para('Code Files:', true),
        new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [
          new TableRow({ children: [cell('File', true, 45, 'F0F0F0'), cell('Purpose', true, 55, 'F0F0F0')] }),
          new TableRow({ children: [cell('server/routes/aiInterview.js'), cell('AI chat interview: start, chat, evaluate endpoints')] }),
          new TableRow({ children: [cell('server/routes/summarize.js'), cell('Article summarization via Groq')] }),
          new TableRow({ children: [cell('server/routes/resumeAnalysis.js'), cell('ATS analysis via Google Gemini')] }),
          new TableRow({ children: [cell('server/routes/resumeBuilder.js'), cell('AI resume content generation via Groq')] }),
          new TableRow({ children: [cell('server/routes/groupDiscussion.js'), cell('AI GD participant simulation via Groq')] }),
        ]}),
        spacer(80),
        para('Libraries Used:', true),
        new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [
          new TableRow({ children: [cell('Library', true, 30, 'F0F0F0'), cell('Version', true, 15, 'F0F0F0'), cell('Usage', true, 55, 'F0F0F0')] }),
          new TableRow({ children: [cell('groq-sdk'), cell('^1.1.1'), cell('Groq Cloud API — LLaMA 3.1-8b-instant model')] }),
          new TableRow({ children: [cell('Google Gemini API'), cell('v1beta'), cell('Gemini 2.0 Flash for ATS resume analysis (via fetch)')] }),
        ]}),

        // M6
        spacer(200),
        subheading('3.6 Module 6: Resume Builder & ATS Analysis'),
        para('Purpose: Multi-template resume builder with AI content generation, cover letter, PDF/DOCX export, and ATS compatibility scoring.'),
        spacer(50),
        para('Code Files:', true),
        new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [
          new TableRow({ children: [cell('File', true, 45, 'F0F0F0'), cell('Purpose', true, 55, 'F0F0F0')] }),
          new TableRow({ children: [cell('server/routes/resumeBuilder.js'), cell('Draft CRUD, AI content generation, cover letter generation')] }),
          new TableRow({ children: [cell('server/routes/resumeAnalysis.js'), cell('ATS scoring with Gemini, keyword matching fallback')] }),
          new TableRow({ children: [cell('server/models/ResumeDraft.js'), cell('Schema: personalInfo, education, experience, skills, projects')] }),
          new TableRow({ children: [cell('server/models/ResumeAnalysis.js'), cell('Schema: matchScore, missingKeywords, suggestions')] }),
          new TableRow({ children: [cell('client/src/pages/ResumeBuilder.jsx (29KB)'), cell('Tab-based form, live preview, 3 templates, AI buttons')] }),
          new TableRow({ children: [cell('client/src/pages/ResumeAnalysis.jsx'), cell('Resume vs JD input, ATS score gauge, keyword analysis')] }),
        ]}),
        spacer(80),
        para('Libraries Used:', true),
        new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [
          new TableRow({ children: [cell('Library', true, 30, 'F0F0F0'), cell('Version', true, 15, 'F0F0F0'), cell('Usage', true, 55, 'F0F0F0')] }),
          new TableRow({ children: [cell('html2pdf.js'), cell('^0.14.0'), cell('Client-side PDF export from HTML')] }),
          new TableRow({ children: [cell('docx'), cell('^9.6.1'), cell('Client-side DOCX generation')] }),
          new TableRow({ children: [cell('file-saver'), cell('^2.0.5'), cell('Trigger file download in browser')] }),
          new TableRow({ children: [cell('express-rate-limit'), cell('^7.4.0'), cell('Rate limiting on analysis endpoint (10/15min)')] }),
        ]}),

        // M7
        new Paragraph({ pageBreakBefore: true, children: [] }),
        subheading('3.7 Module 7: Code Execution Engine'),
        para('Purpose: Secure code execution supporting 5 languages with Judge0 CE (Docker) primary and local fallback.'),
        spacer(50),
        para('Code Files:', true),
        new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [
          new TableRow({ children: [cell('File', true, 45, 'F0F0F0'), cell('Purpose', true, 55, 'F0F0F0')] }),
          new TableRow({ children: [cell('server/routes/codeExecution.js (12KB)'), cell('Judge0 submission, security validation, local fallback, test runner')] }),
          new TableRow({ children: [cell('server/routes/codingQuestions.js'), cell('Coding question CRUD')] }),
          new TableRow({ children: [cell('server/models/CodingQuestion.js'), cell('Schema: title, description, testCases, boilerplate')] }),
          new TableRow({ children: [cell('judge0-docker-compose.yml'), cell('Docker Compose for Judge0 CE + PostgreSQL')] }),
          new TableRow({ children: [cell('client/src/pages/CodingQuestions.jsx'), cell('Question list and code editor interface')] }),
        ]}),
        spacer(80),
        para('Libraries Used:', true),
        new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [
          new TableRow({ children: [cell('Library', true, 30, 'F0F0F0'), cell('Version', true, 15, 'F0F0F0'), cell('Usage', true, 55, 'F0F0F0')] }),
          new TableRow({ children: [cell('Judge0 CE'), cell('v1.13.1'), cell('Docker-based sandboxed code execution (5 languages)')] }),
          new TableRow({ children: [cell('child_process (Node.js)'), cell('built-in'), cell('Local fallback execution when Judge0 unavailable')] }),
          new TableRow({ children: [cell('@monaco-editor/react'), cell('^4.7.0'), cell('VS Code-based code editor component')] }),
        ]}),

        // M8
        spacer(200),
        subheading('3.8 Module 8: Group Discussion Simulation'),
        para('Purpose: AI-powered group discussion with 5 distinct personality participants, multi-turn conversation, and performance evaluation.'),
        spacer(50),
        para('Code Files:', true),
        new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [
          new TableRow({ children: [cell('File', true, 45, 'F0F0F0'), cell('Purpose', true, 55, 'F0F0F0')] }),
          new TableRow({ children: [cell('server/routes/groupDiscussion.js'), cell('Start GD, respond (AI participants reply), evaluate performance')] }),
          new TableRow({ children: [cell('server/routes/gdRooms.js'), cell('GD room CRUD for multi-user rooms')] }),
          new TableRow({ children: [cell('server/models/GDRoom.js'), cell('Schema: topic, participants, status')] }),
          new TableRow({ children: [cell('client/src/pages/GDRooms.jsx (23KB)'), cell('Chat interface, AI participants, PeerJS video, timer')] }),
        ]}),
        spacer(80),
        para('Libraries Used:', true),
        new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [
          new TableRow({ children: [cell('Library', true, 30, 'F0F0F0'), cell('Version', true, 15, 'F0F0F0'), cell('Usage', true, 55, 'F0F0F0')] }),
          new TableRow({ children: [cell('groq-sdk'), cell('^1.1.1'), cell('AI participant responses and evaluation')] }),
          new TableRow({ children: [cell('socket.io'), cell('^4.7.5'), cell('Real-time GD room events and video signaling')] }),
          new TableRow({ children: [cell('peerjs'), cell('^1.5.5'), cell('Multi-peer video calls in GD rooms')] }),
        ]}),

        // M9
        new Paragraph({ pageBreakBefore: true, children: [] }),
        subheading('3.9 Module 9: Real-Time Communication'),
        para('Purpose: WebSocket-based real-time features — code synchronization, chat, online tracking, WebRTC video call signaling, and GD room management.'),
        spacer(50),
        para('Code Files:', true),
        new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [
          new TableRow({ children: [cell('File', true, 45, 'F0F0F0'), cell('Purpose', true, 55, 'F0F0F0')] }),
          new TableRow({ children: [cell('server/socket/socketHandler.js (9KB)'), cell('All Socket.IO events: rooms, code sync, WebRTC, GD, chat, sessions')] }),
          new TableRow({ children: [cell('server/server.js'), cell('HTTP + Socket.IO server initialization')] }),
          new TableRow({ children: [cell('client/src/pages/TechnicalInterview.jsx (38KB)'), cell('Collaborative code editor with Socket.IO sync + PeerJS video')] }),
        ]}),
        spacer(80),
        para('Libraries Used:', true),
        new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [
          new TableRow({ children: [cell('Library', true, 30, 'F0F0F0'), cell('Version', true, 15, 'F0F0F0'), cell('Usage', true, 55, 'F0F0F0')] }),
          new TableRow({ children: [cell('socket.io'), cell('^4.7.5'), cell('Server-side WebSocket event handling')] }),
          new TableRow({ children: [cell('socket.io-client'), cell('^4.8.3'), cell('Client-side WebSocket connection')] }),
          new TableRow({ children: [cell('peerjs'), cell('^1.5.5'), cell('WebRTC video call abstraction')] }),
        ]}),

        // M10
        spacer(200),
        subheading('3.10 Module 10: Analytics & Dashboard'),
        para('Purpose: Performance tracking with score aggregation, weakness detection, topic progress, and data visualization.'),
        spacer(50),
        para('Code Files:', true),
        new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [
          new TableRow({ children: [cell('File', true, 45, 'F0F0F0'), cell('Purpose', true, 55, 'F0F0F0')] }),
          new TableRow({ children: [cell('server/routes/analytics.js'), cell('Dashboard aggregation: scores, weaknesses, progress')] }),
          new TableRow({ children: [cell('client/src/pages/Dashboard.jsx (17KB)'), cell('Stat cards, RadarChart, progress bars, quick actions')] }),
          new TableRow({ children: [cell('client/src/pages/Analytics.jsx'), cell('RadarChart skill breakdown, BarChart round averages')] }),
        ]}),
        spacer(80),
        para('Libraries Used:', true),
        new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [
          new TableRow({ children: [cell('Library', true, 30, 'F0F0F0'), cell('Version', true, 15, 'F0F0F0'), cell('Usage', true, 55, 'F0F0F0')] }),
          new TableRow({ children: [cell('recharts'), cell('^3.8.0'), cell('RadarChart, BarChart, PieChart visualizations')] }),
        ]}),

        // M11
        spacer(200),
        subheading('3.11 Module 11: Admin & Notifications'),
        para('Purpose: Admin panel for platform management and in-app notification system.'),
        spacer(50),
        para('Code Files:', true),
        new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [
          new TableRow({ children: [cell('File', true, 45, 'F0F0F0'), cell('Purpose', true, 55, 'F0F0F0')] }),
          new TableRow({ children: [cell('server/routes/notifications.js'), cell('GET /, PATCH /:id/read, PATCH /read-all')] }),
          new TableRow({ children: [cell('server/routes/companies.js'), cell('Company CRUD (admin)')] }),
          new TableRow({ children: [cell('server/routes/topics.js'), cell('Topic CRUD (admin)')] }),
          new TableRow({ children: [cell('server/models/Notification.js'), cell('Schema: user, type, message, read status')] }),
          new TableRow({ children: [cell('client/src/pages/Admin.jsx'), cell('User management, stats overview')] }),
          new TableRow({ children: [cell('client/src/pages/Notifications.jsx'), cell('Notification list with mark-read')] }),
          new TableRow({ children: [cell('client/src/pages/Topics.jsx'), cell('Topic CRUD interface')] }),
          new TableRow({ children: [cell('client/src/pages/Companies.jsx'), cell('Company directory management')] }),
        ]}),

        // M12
        new Paragraph({ pageBreakBefore: true, children: [] }),
        subheading('3.12 Module 12: UI Design System & Layout'),
        para('Purpose: Global CSS design system, responsive layout, glassmorphism theme, and mobile-first design.'),
        spacer(50),
        para('Code Files:', true),
        new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [
          new TableRow({ children: [cell('File', true, 45, 'F0F0F0'), cell('Purpose', true, 55, 'F0F0F0')] }),
          new TableRow({ children: [cell('client/src/index.css'), cell('CSS custom properties, component styles, animations, responsive')] }),
          new TableRow({ children: [cell('client/src/components/Layout.jsx'), cell('Main layout: sidebar + content with mobile hamburger')] }),
          new TableRow({ children: [cell('client/src/components/Sidebar.jsx'), cell('Role-based nav links with auto-close on mobile')] }),
          new TableRow({ children: [cell('client/src/components/Sidebar.css'), cell('Sidebar responsive styles: desktop fixed, mobile overlay')] }),
          new TableRow({ children: [cell('client/src/App.jsx'), cell('Root routing with ProtectedRoute wrapper')] }),
          new TableRow({ children: [cell('client/src/pages/NotFound.jsx'), cell('Styled 404 error page')] }),
        ]}),
        spacer(80),
        para('Libraries Used:', true),
        new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [
          new TableRow({ children: [cell('Library', true, 30, 'F0F0F0'), cell('Version', true, 15, 'F0F0F0'), cell('Usage', true, 55, 'F0F0F0')] }),
          new TableRow({ children: [cell('react'), cell('^19.2.0'), cell('UI component framework')] }),
          new TableRow({ children: [cell('react-dom'), cell('^19.2.0'), cell('DOM rendering')] }),
          new TableRow({ children: [cell('react-router-dom'), cell('^7.13.1'), cell('Client-side routing with protected routes')] }),
          new TableRow({ children: [cell('react-icons'), cell('^5.6.0'), cell('Feather icon set (Fi* components)')] }),
          new TableRow({ children: [cell('framer-motion'), cell('^12.35.1'), cell('Page transitions and animations')] }),
          new TableRow({ children: [cell('vite'), cell('^7.3.1'), cell('Build tool and dev server')] }),
        ]}),

        // Summary
        spacer(300),
        heading('Summary'),
        para('Total Modules: 12'),
        para('Total Server Route Files: 18+'),
        para('Total Mongoose Models: 18'),
        para('Total React Page Components: 21'),
        para('Total Client Dependencies: 13'),
        para('Total Server Dependencies: 12'),
        para('Total Lines of Code: ~8,000+ (combined client + server)'),
      ]
    }]
  });
}

async function main() {
  console.log('📄 Generating Project Submission Document...');
  const doc = createSubmissionDoc();
  const buffer = await Packer.toBuffer(doc);
  fs.writeFileSync('PRISM_Project_Submission.docx', buffer);
  console.log('✅ PRISM_Project_Submission.docx created');
}

main().catch(console.error);
