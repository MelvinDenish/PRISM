const socketHandler = (io) => {
    // Track rooms and participants
    const rooms = new Map();

    io.on('connection', (socket) => {
        console.log(`🔌 User connected: ${socket.id}`);

        // ==================== INTERVIEW ROOMS ====================

        // Join an interview room
        socket.on('join-room', ({ roomId, userId, userName }) => {
            socket.join(roomId);

            if (!rooms.has(roomId)) {
                rooms.set(roomId, { participants: [], code: '// Start coding here...\n' });
            }

            const room = rooms.get(roomId);
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
            }, durationMs - 5 * 60 * 1000);

            setTimeout(() => {
                io.to(`gd-${roomId}`).emit('gd-alert', { message: '⏰ 1 minute remaining! Conclusion phase.' });
            }, durationMs - 60 * 1000);

            setTimeout(() => {
                io.to(`gd-${roomId}`).emit('gd-ended', { message: '🔔 GD session has ended!' });
            }, durationMs);
        });

        // ==================== CHAT ====================

        socket.on('send-message', ({ roomId, message, userName }) => {
            io.to(roomId).emit('receive-message', { message, userName, timestamp: new Date() });
        });

        // ==================== DISCONNECT ====================

        socket.on('disconnect', () => {
            // Clean up from all rooms
            rooms.forEach((room, roomId) => {
                const participant = room.participants.find((p) => p.socketId === socket.id);
                if (participant) {
                    room.participants = room.participants.filter((p) => p.socketId !== socket.id);
                    io.to(roomId).emit('room-participants', room.participants);
                    io.to(roomId).emit('user-left', { socketId: socket.id });
                }
            });
            console.log(`❌ User disconnected: ${socket.id}`);
        });
    });
};

module.exports = socketHandler;
