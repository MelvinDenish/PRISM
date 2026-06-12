const { validateEnv, config } = require('./config/env');
// Validate environment BEFORE anything else — fail fast on missing required vars.
validateEnv();

const express = require('express');
const cors = require('cors');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');
const connectDB = require('./config/db');
const socketHandler = require('./socket/socketHandler');
const logger = require('./utils/logger');
const requestContext = require('./middleware/requestContext');
const { generalLimiter } = require('./middleware/rateLimit');
const { notFound, errorHandler } = require('./middleware/errorHandler');

const app = express();
const server = http.createServer(app);

// Socket.io setup
const allowedOrigins = config.clientOrigins();
const io = new Server(server, {
    cors: { origin: allowedOrigins, methods: ['GET', 'POST'] }
});

// Middleware
app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(requestContext);   // request id + structured request logging
app.use('/api', generalLimiter); // broad rate-limit safety net

// Serve locally-stored uploads when STORAGE_DRIVER=local (no-op for s3).
// Files are written to server/uploads by utils/storage/local.js.
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Connect to MongoDB
connectDB();

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/companies', require('./routes/companies'));
app.use('/api/topics', require('./routes/topics'));
app.use('/api/resources', require('./routes/resources'));
app.use('/api/progress', require('./routes/progress'));
app.use('/api/mentorship', require('./routes/mentorship'));
app.use('/api/availability', require('./routes/availability'));
app.use('/api/coding-questions', require('./routes/codingQuestions'));

app.use('/api/resume-analysis', require('./routes/resumeAnalysis'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/analytics', require('./routes/analytics'));
app.use('/api/interview-game', require('./routes/interviewGame'));
app.use('/api/ai-interview', require('./routes/aiInterview'));
app.use('/api/resume-builder', require('./routes/resumeBuilder'));
app.use('/api/learning-paths', require('./routes/learningPaths'));
app.use('/api/behavioral', require('./routes/behavioralAnswers'));
app.use('/api/review', require('./routes/review'));
app.use('/api/code-execution', require('./routes/codeExecution'));
app.use('/api/group-discussion', require('./routes/groupDiscussion'));
app.use('/api/gd-rooms', require('./routes/gdRooms'));
app.use('/api/summarize', require('./routes/summarize'));
app.use('/api/rtc', require('./routes/rtc'));
app.use('/api/assistant', require('./routes/assistant'));
app.use('/api/artifacts', require('./routes/artifacts'));
app.use('/api/prep-profile', require('./routes/prepProfile'));

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 404 for unmatched routes, then the centralized error handler (must be last).
app.use(notFound);
app.use(errorHandler);

// Socket handler
socketHandler(io);

const PORT = config.port();
server.listen(PORT, () => {
    logger.info('server_started', { port: PORT, env: config.nodeEnv() });
});
