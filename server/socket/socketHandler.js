const User = require('../models/User');
const MentorshipSession = require('../models/MentorshipSession');
const socketAuth = require('./socketAuth');

const socketHandler = (io) => {
    const userSockets = new Map(); // socketId => userId (for online tracking)
    // NOTE: live video (1:1 mentorship, technical interview, GD, webinar) is now
    // handled by the LiveKit SFU — tokens are minted in routes/rtc.js and media
    // flows through LiveKit, not Socket.IO. The old PeerJS signaling + peer maps
    // (sessionPeers / gdVideoRooms) and the in-memory interview-coding `rooms`
    // map + its join-room/leave-room/code-change/cursor-change handlers (the
    // unmounted MockInterview collaborative editor) were removed.

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

        // `disconnecting` fires while socket.rooms is still populated — use it to
        // tell GD rooms a participant left so their presence list shrinks (the
        // `disconnect` event below runs after rooms are already cleared).
        socket.on('disconnecting', () => {
            socket.rooms.forEach((r) => {
                if (typeof r === 'string' && r.startsWith('gd-')) {
                    socket.to(r).emit('gd-user-left', { userId: authUserId, socketId: socket.id });
                }
            });
        });

        socket.on('disconnect', () => {
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
