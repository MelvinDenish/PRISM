/**
 * Live-video access tokens for the self-hosted LiveKit SFU.
 *
 * The client asks for a token for a specific room; this endpoint is the trust
 * boundary. It re-uses the app's EXISTING authorization (MentorshipSession
 * membership for `session:*` rooms, GDRoom for `gd:*` rooms) and derives the
 * LiveKit publish/subscribe grants from the caller's role — the client never
 * chooses its own permissions. See docs/LIVEKIT.md.
 */
const express = require('express');
const crypto = require('crypto');
const { AccessToken } = require('livekit-server-sdk');
const MentorshipSession = require('../models/MentorshipSession');
const GDRoom = require('../models/GDRoom');
const { protect } = require('../middleware/auth');
const { config } = require('../config/env');
const router = express.Router();

const sameId = (a, b) => String(a) === String(b);

// Resolve who may join `roomName` and with what grants. Returns
// { canPublish, canSubscribe } on success, or { error: { status, message } }.
async function authorizeRoom(roomName, user) {
    const [kind, id] = String(roomName).split(':');
    if (!kind || !id) return { error: { status: 400, message: 'Invalid roomName (expected "session:<id>" or "gd:<id>").' } };

    if (kind === 'session') {
        const session = await MentorshipSession.findById(id).select('mentor mentee');
        if (!session) return { error: { status: 404, message: 'Session not found' } };
        const allowed = sameId(session.mentor, user._id) || sameId(session.mentee, user._id) || user.role === 'admin';
        if (!allowed) return { error: { status: 403, message: 'Not authorized for this session' } };
        // 1:1 mentorship / technical interview — both sides publish and subscribe.
        return { canPublish: true, canSubscribe: true };
    }

    if (kind === 'gd') {
        const room = await GDRoom.findById(id).select('participants host mode');
        if (!room) return { error: { status: 404, message: 'Room not found' } };

        if (room.mode === 'webinar') {
            // 1-to-many: the host publishes; any authenticated user may watch.
            return { canPublish: sameId(room.host, user._id) || user.role === 'admin', canSubscribe: true };
        }
        // Group discussion (n-n): must be a joined participant to publish.
        const isMember = room.participants.some((p) => sameId(p, user._id)) || user.role === 'admin';
        if (!isMember) return { error: { status: 403, message: 'Join the room before connecting to video' } };
        return { canPublish: true, canSubscribe: true };
    }

    return { error: { status: 400, message: `Unknown room kind "${kind}"` } };
}

// POST /api/rtc/token  { roomName: "session:<id>" | "gd:<id>" }
router.post('/token', protect, async (req, res) => {
    try {
        if (!config.hasLiveKit()) {
            return res.status(503).json({ success: false, message: 'Live video is not configured on this server.' });
        }

        const { roomName } = req.body;
        if (!roomName) return res.status(400).json({ success: false, message: 'roomName is required' });

        const authz = await authorizeRoom(roomName, req.user);
        if (authz.error) return res.status(authz.error.status).json({ success: false, message: authz.error.message });

        const { apiKey, apiSecret, wsUrl } = config.livekit();
        // Unique identity per connection (userId + random suffix). Display name carries
        // the real name. This lets the same user hold multiple connections without the
        // SFU evicting the older one — covers multi-tab and React StrictMode's
        // double-mount in dev (which otherwise self-evicts and drops the call).
        const at = new AccessToken(apiKey, apiSecret, {
            identity: `${req.user._id}-${crypto.randomBytes(4).toString('hex')}`,
            name: req.user.name,
            ttl: '2h',
        });
        at.addGrant({
            roomJoin: true,
            room: roomName,
            canPublish: authz.canPublish,
            canSubscribe: authz.canSubscribe,
            canPublishData: true, // chat / data channel for everyone
        });

        const token = await at.toJwt(); // livekit-server-sdk v2 returns a Promise
        res.json({ success: true, token, wsUrl, canPublish: authz.canPublish });
    } catch (error) {
        res.status(500).json({ success: false, message: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : error.message });
    }
});

module.exports = router;
