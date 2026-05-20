require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const connectDB = require('./config/db');
const socketHandler = require('./socket/socketHandler');

const app = express();
const server = http.createServer(app);

// Socket.io setup
const allowedOrigins = (process.env.CLIENT_URL || 'http://localhost:5173').split(',');
const io = new Server(server, {
    cors: { origin: allowedOrigins, methods: ['GET', 'POST'] }
});

// Middleware
app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

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
app.use('/api/code-execution', require('./routes/codeExecution'));
app.use('/api/group-discussion', require('./routes/groupDiscussion'));
app.use('/api/summarize', require('./routes/summarize'));

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handler
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
});

// Socket handler
socketHandler(io);

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
    console.log(`🚀 PRISM Server running on port ${PORT}`);
});
