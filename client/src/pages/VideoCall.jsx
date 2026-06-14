import { useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { updateSessionStatus } from '../services/api';
import LiveRoom from '../components/rtc/LiveRoom';

/**
 * 1:1 mentorship video — now backed by the self-hosted LiveKit SFU (replaces the
 * old PeerJS P2P path). Media, signaling, reconnection and NAT traversal (TURN)
 * are handled inside <LiveRoom>; this page owns only the session lifecycle.
 */
const VideoCall = () => {
    const { sessionId } = useParams();
    const navigate = useNavigate();
    const [ending, setEnding] = useState(false);

    // Leaving the room completes the mentorship session and returns to the list.
    const handleLeave = useCallback(async () => {
        if (ending) return;
        setEnding(true);
        try { await updateSessionStatus(sessionId, { status: 'completed' }); }
        catch (err) { console.error('Failed to update session:', err); }
        navigate('/sessions');
    }, [sessionId, ending, navigate]);

    return (
        <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-primary)' }}>
            <div style={{ padding: '12px 24px', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-secondary)' }}>
                <h3 style={{ fontSize: 16 }}>📹 Mentorship Session</h3>
            </div>
            <div style={{ flex: 1, minHeight: 0 }}>
                <LiveRoom roomName={`session:${sessionId}`} onLeave={handleLeave} />
            </div>
        </div>
    );
};

export default VideoCall;
