/**
 * Socket.IO authentication middleware (Phase 1 security).
 *
 * Before this, sockets were unauthenticated: any client could connect and emit
 * events with a forged `userId`/`roomId`/`sessionId`. This verifies the JWT from
 * the connection handshake and attaches the real user as `socket.user`, so
 * handlers can trust server-derived identity instead of client-sent payloads.
 *
 * The client must connect with:  io(URL, { auth: { token } })
 */

const jwt = require('jsonwebtoken');
const User = require('../models/User');
const logger = require('../utils/logger');

module.exports = async function socketAuth(socket, next) {
  try {
    const token =
      (socket.handshake.auth && socket.handshake.auth.token) ||
      (socket.handshake.query && socket.handshake.query.token);

    if (!token) return next(new Error('Authentication required'));

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');
    if (!user) return next(new Error('User not found'));

    socket.user = user; // authoritative identity for all events on this socket
    next();
  } catch (err) {
    logger.warn('socket_auth_failed', { socketId: socket.id, reason: err.message });
    next(new Error('Authentication failed'));
  }
};
