const User = require('../models/User');

const socketHandler = (io) => {
    const rooms = new Map();
    const gdVideoRooms = new Map();
    const sessionPeers = new Map(); // sessionId => [{ peerId, userId, userName, socketId }]
    const userSockets = new Map(); // socketId => userId (for online tracking)

    io.on('connection', (socket) => {
        console.log(`🔌 User connected: ${socket.id}`);

        // ==================== ONLINE TRACKING ====================
        socket.on('register-user', async ({ userId, role }) => {
            if (!userId) return;
            userSockets.set(socket.id, userId);
            try { await User.findByIdAndUpdate(userId, { isOnline: true }); } catch {}
        });

        // ==================== INTERVIEW ROOMS ====================

        // Join an interview room
        socket.on('join-room', ({ roomId, userId, userName }) => {
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

        // Sync code changes
        socket.on('code-change', ({ roomId, code }) => {
            if (rooms.has(roomId)) {
                rooms.get(roomId).code = code;
            }
            socket.to(roomId).emit('code-update', { code });
        });

        // Sync cursor position
        socket.on('cursor-change', ({ roomId, cursor, userId }) => {
            socket.to(roomId).emit('cursor-update', { cursor, userId });
        });

        // ==================== WEBRTC SIGNALING ====================

        // Session peer ID exchange (for 1:1 video in mentorship sessions)
        // Flow: New joiner sends peer-id → server tells new joiner to CALL existing peers
        //       → server tells existing peers to WAIT (incoming-peer, don't call back)
        socket.on('session-peer-id', ({ sessionId, peerId, userName }) => {
            if (!sessionPeers.has(sessionId)) {
                sessionPeers.set(sessionId, []);
            }
            const peers = sessionPeers.get(sessionId);
            // Remove old entry for this socket (e.g. reconnect)
            const filtered = peers.filter(p => p.socketId !== socket.id);
            filtered.push({ peerId, userName: userName || 'Participant', socketId: socket.id });
            sessionPeers.set(sessionId, filtered);

            const existingPeers = filtered.filter(p => p.socketId !== socket.id);

            // Tell the NEW joiner about existing peers → new joiner will CALL them
            existingPeers.forEach(ep => {
                socket.emit('call-peer', { peerId: ep.peerId, name: ep.userName });
            });

            // Tell EXISTING peers about the new joiner → they should NOT call,
            // just update the name label and wait for the incoming call
            socket.to(sessionId).emit('incoming-peer', { peerId, name: userName || 'Participant' });

            console.log(`📹 Session ${sessionId}: ${userName} joined (peer: ${peerId}). Total: ${filtered.length}`);
        });

        // WebRTC offer
        socket.on('offer', ({ roomId, offer, to }) => {
            socket.to(to).emit('offer', { offer, from: socket.id });
        });

        // WebRTC answer
        socket.on('answer', ({ roomId, answer, to }) => {
            socket.to(to).emit('answer', { answer, from: socket.id });
        });

        // ICE candidate
        socket.on('ice-candidate', ({ roomId, candidate, to }) => {
            socket.to(to).emit('ice-candidate', { candidate, from: socket.id });
        });

        // ==================== GD ROOM EVENTS ====================

        // Join GD room
        socket.on('join-gd', ({ roomId, userId, userName }) => {
            socket.join(`gd-${roomId}`);
            socket.to(`gd-${roomId}`).emit('gd-user-joined', { userId, userName, socketId: socket.id });
        });

        // GD Video: Join with PeerJS peer ID
        socket.on('gd-video-join', ({ roomId, peerId, name, userId }) => {
            const gdRoom = `gd-${roomId}`;

            if (!gdVideoRooms.has(roomId)) {
                gdVideoRooms.set(roomId, []);
            }

            const videoRoom = gdVideoRooms.get(roomId);
            // Remove old entry for same user
            const filtered = videoRoom.filter(p => p.userId !== userId);
            filtered.push({ peerId, userId, name, socketId: socket.id });
            gdVideoRooms.set(roomId, filtered);

            // Notify existing video peers about the new peer
            socket.to(gdRoom).emit('gd-peer-joined', { peerId, name, userId });

            // Send existing peers to the new joiner so they can call them
            const existingPeers = filtered.filter(p => p.userId !== userId);
            existingPeers.forEach(peer => {
                socket.emit('gd-peer-joined', { peerId: peer.peerId, name: peer.name, userId: peer.userId });
            });

            console.log(`🎥 GD Video: ${name} joined room ${roomId} with peer ${peerId}. Total peers: ${filtered.length}`);
        });

        // GD Video: Leave
        socket.on('gd-leave-video', ({ roomId }) => {
            if (gdVideoRooms.has(roomId)) {
                const videoRoom = gdVideoRooms.get(roomId);
                const leaving = videoRoom.find(p => p.socketId === socket.id);
                if (leaving) {
                    const filtered = videoRoom.filter(p => p.socketId !== socket.id);
                    gdVideoRooms.set(roomId, filtered);
                    io.to(`gd-${roomId}`).emit('gd-peer-left', { peerId: leaving.peerId, userId: leaving.userId });
                    console.log(`🎥 GD Video: ${leaving.name} left room ${roomId}`);
                }
            }
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

        socket.on('send-message', ({ roomId, message, userName }) => {
            socket.to(roomId).emit('receive-message', { message, userName, timestamp: new Date() });
        });

        // ==================== SESSION EVENTS ====================

        socket.on('join-session', ({ sessionId, userId, userName }) => {
            socket.join(sessionId);
            console.log(`📹 ${userName || 'User'} joined session room: ${sessionId}`);
        });

        socket.on('end-session', ({ sessionId }) => {
            io.to(sessionId).emit('session-ended');
            // Clean up session peers
            sessionPeers.delete(sessionId);
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

            // Clean up from GD video rooms
            gdVideoRooms.forEach((peers, roomId) => {
                const leaving = peers.find(p => p.socketId === socket.id);
                if (leaving) {
                    const filtered = peers.filter(p => p.socketId !== socket.id);
                    gdVideoRooms.set(roomId, filtered);
                    io.to(`gd-${roomId}`).emit('gd-peer-left', { peerId: leaving.peerId, userId: leaving.userId });
                }
            });

            // Clean up from mentorship session rooms
            sessionPeers.forEach((peers, sessionId) => {
                const leaving = peers.find(p => p.socketId === socket.id);
                if (leaving) {
                    const filtered = peers.filter(p => p.socketId !== socket.id);
                    sessionPeers.set(sessionId, filtered);
                    io.to(sessionId).emit('session-peer-left', { userName: leaving.userName });
                    if (filtered.length === 0) sessionPeers.delete(sessionId);
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
