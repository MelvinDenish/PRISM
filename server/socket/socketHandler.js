const User = require('../models/User');
const MentorshipSession = require('../models/MentorshipSession');
const socketAuth = require('./socketAuth');

const socketHandler = (io) => {
    const rooms = new Map();
    const userSockets = new Map(); // socketId => userId (for online tracking)
    // NOTE: live video (1:1 mentorship, technical interview, GD, webinar) is now
    // handled by the LiveKit SFU — tokens are minted in routes/rtc.js and media
    // flows through LiveKit, not Socket.IO. The old PeerJS signaling + peer maps
    // (sessionPeers / gdVideoRooms) were removed.

    // Authorization: a coding room / video session is keyed by a MentorshipSession
    // _id. Only that session's mentor or mentee (or an admin) may join — otherwise
    // any authenticated user could join a private 1:1 session by guessing the id.
    const isSessionParticipant = async (sessionId, user) => {
        try {
            if (user.role === 'admin') return true;
            const session = await MentorshipSession.findById(sessionId).select('mentor mentee');
            if (!session) return false;
            return session.mentor.equals(user._id) || session.mentee.equals(user._id);
        } catch {
            return false; // invalid id / lookup error → deny
        }
    };

    // Reject unauthenticated connections; attaches socket.user (real identity).
    io.use(socketAuth);

    io.on('connection', (socket) => {
        // socket.user is guaranteed by socketAuth — use it as the source of truth
        // for identity. Client-sent userId/userName are ignored for identity.
        const authUserId = socket.user._id.toString();
        const authUserName = socket.user.name;
        console.log(`🔌 User connected: ${socket.id} (${authUserName})`);

        // ==================== ONLINE TRACKING ====================
        socket.on('register-user', async () => {
            userSockets.set(socket.id, authUserId);
            try { await User.findByIdAndUpdate(authUserId, { isOnline: true }); } catch {}
        });

        // ==================== INTERVIEW ROOMS ====================

        // Join an interview room. NOTE: this room id comes from the (currently
        // unmounted) MockInterview feature, NOT a MentorshipSession, so it can't
        // be authorized against MentorshipSession. When MockInterviews is revived
        // (see the orphaned-routes chore), add participant authz against that model.
        socket.on('join-room', ({ roomId }) => {
            if (!roomId) return;
            const userId = authUserId;
            const userName = authUserName;
            socket.join(roomId);

            if (!rooms.has(roomId)) {
                rooms.set(roomId, { participants: [], code: '// Start coding here...\n' });
            }

            const room = rooms.get(roomId);
            // Remove existing entry for this user
            room.participants = room.participants.filter(p => p.userId !== userId);
            room.participants.push({ socketId: socket.id, userId, userName });

            // Notify others in room
            socket.to(roomId).emit('user-joined', { userId, userName, socketId: socket.id });

            // Send current code state to new joiner
            socket.emit('sync-code', { code: room.code });

            // Send participant list
            io.to(roomId).emit('room-participants', room.participants);
        });

        // Leave room
        socket.on('leave-room', ({ roomId }) => {
            socket.leave(roomId);
            if (rooms.has(roomId)) {
                const room = rooms.get(roomId);
                room.participants = room.participants.filter((p) => p.socketId !== socket.id);
                io.to(roomId).emit('room-participants', room.participants);
                socket.to(roomId).emit('user-left', { socketId: socket.id });
            }
        });

        // ==================== CODE SYNC ====================

        // Sync code changes — only broadcast to rooms this socket actually joined.
        socket.on('code-change', ({ roomId, code }) => {
            if (!socket.rooms.has(roomId)) return;
            if (rooms.has(roomId)) {
                rooms.get(roomId).code = code;
            }
            socket.to(roomId).emit('code-update', { code });
        });

        // Sync cursor position
        socket.on('cursor-change', ({ roomId, cursor, userId }) => {
            if (!socket.rooms.has(roomId)) return;
            socket.to(roomId).emit('cursor-update', { cursor, userId });
        });

        // ==================== GD ROOM EVENTS ====================
        // Video media is handled by the LiveKit SFU (see routes/rtc.js). These
        // events only carry presence, chat, and the discussion timer.

        // Join GD room (presence + chat + timer channel)
        socket.on('join-gd', ({ roomId }) => {
            if (!roomId) return;
            socket.join(`gd-${roomId}`);
            socket.to(`gd-${roomId}`).emit('gd-user-joined', { userId: authUserId, userName: authUserName, socketId: socket.id });
        });

        // GD timer events
        socket.on('gd-timer-alert', ({ roomId, message }) => {
            io.to(`gd-${roomId}`).emit('gd-alert', { message });
        });

        // GD start
        socket.on('start-gd', ({ roomId, topic, duration }) => {
            io.to(`gd-${roomId}`).emit('gd-started', { topic, duration });

            // Auto timer alerts
            const durationMs = (duration || 10) * 60 * 1000;

            setTimeout(() => {
                io.to(`gd-${roomId}`).emit('gd-alert', { message: '⏰ 5 minutes remaining!' });
            }, Math.max(0, durationMs - 5 * 60 * 1000));

            setTimeout(() => {
                io.to(`gd-${roomId}`).emit('gd-alert', { message: '⏰ 1 minute remaining! Conclusion phase.' });
            }, Math.max(0, durationMs - 60 * 1000));

            setTimeout(() => {
                io.to(`gd-${roomId}`).emit('gd-ended', { message: '🔔 GD session has ended!' });
            }, durationMs);
        });

        // ==================== CHAT ====================

        // Broadcast chat using the server-derived identity — never trust a
        // client-sent userName (prevents chat impersonation).
        socket.on('send-message', ({ roomId, message }) => {
            if (!roomId || typeof message !== 'string' || !socket.rooms.has(roomId)) return;
            socket.to(roomId).emit('receive-message', {
                message: message.slice(0, 4000),
                userName: authUserName,
                timestamp: new Date(),
            });
        });

        // ==================== SESSION EVENTS ====================

        socket.on('join-session', async ({ sessionId }) => {
            if (!sessionId) return;
            if (!(await isSessionParticipant(sessionId, socket.user))) {
                return socket.emit('session-unauthorized', { sessionId });
            }
            socket.join(sessionId);
            console.log(`📹 ${authUserName || 'User'} joined session room: ${sessionId}`);
        });

        socket.on('end-session', ({ sessionId }) => {
            io.to(sessionId).emit('session-ended');
        });

        // ==================== DISCONNECT ====================

        socket.on('disconnect', () => {
            // Clean up from interview rooms
            rooms.forEach((room, roomId) => {
                const participant = room.participants.find((p) => p.socketId === socket.id);
                if (participant) {
                    room.participants = room.participants.filter((p) => p.socketId !== socket.id);
                    io.to(roomId).emit('room-participants', room.participants);
                    io.to(roomId).emit('user-left', { socketId: socket.id });
                }
            });

            // Set user offline
            const userId = userSockets.get(socket.id);
            if (userId) {
                userSockets.delete(socket.id);
                // Only set offline if no other sockets for this user
                const stillConnected = [...userSockets.values()].includes(userId);
                if (!stillConnected) {
                    User.findByIdAndUpdate(userId, { isOnline: false }).catch(() => {});
                }
            }

            console.log(`❌ User disconnected: ${socket.id}`);
        });
    });
};

module.exports = socketHandler;
