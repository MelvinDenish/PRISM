import { useEffect, useState } from 'react';
import {
    LiveKitRoom,
    GridLayout,
    ParticipantTile,
    RoomAudioRenderer,
    ControlBar,
    useTracks,
} from '@livekit/components-react';
import { Track } from 'livekit-client';
import '@livekit/components-styles';
import { FiLoader, FiVideoOff } from 'react-icons/fi';
import { getRtcToken } from '../../services/api';

/**
 * Camera + screen-share grid. `onlySubscribed: false` keeps a placeholder tile
 * for participants who haven't published yet (e.g. webinar viewers), so the
 * room never looks empty while people are connecting.
 */
function VideoStage() {
    const tracks = useTracks(
        [
            { source: Track.Source.Camera, withPlaceholder: true },
            { source: Track.Source.ScreenShare, withPlaceholder: false },
        ],
        { onlySubscribed: false },
    );
    return (
        <GridLayout tracks={tracks} style={{ height: '100%' }}>
            <ParticipantTile />
        </GridLayout>
    );
}

/**
 * LiveRoom — connects to the self-hosted LiveKit SFU for any topology
 * (1:1, n-n group, or 1-to-many webinar). The server decides publish rights;
 * the ControlBar hides camera/mic/screen-share for subscribe-only participants.
 *
 * Props:
 *   roomName  "session:<id>" (1:1) or "gd:<id>" (group/webinar)
 *   onLeave   called when the local participant disconnects / leaves
 *   children  optional — rendered INSIDE <LiveKitRoom>, so it can use LiveKit
 *             hooks (e.g. the GD moderator's participation tracking + auto cam/mic).
 *   startMediaOnConnect  default true (1:1 / webinar go live immediately). Pass
 *             false for group GD so cam/mic stay OFF until the host presses Start —
 *             the moderator then turns them on for everyone.
 */
const LiveRoom = ({ roomName, onLeave, children, startMediaOnConnect = true }) => {
    const [conn, setConn] = useState({ status: 'loading', token: '', wsUrl: '', canPublish: false, error: '' });

    useEffect(() => {
        let alive = true;
        setConn({ status: 'loading', token: '', wsUrl: '', canPublish: false, error: '' });
        getRtcToken(roomName)
            .then(({ data }) => {
                if (alive) setConn({ status: 'ready', token: data.token, wsUrl: data.wsUrl, canPublish: !!data.canPublish, error: '' });
            })
            .catch((err) => {
                if (!alive) return;
                const msg = err?.response?.data?.message
                    || (err?.response?.status === 503 ? 'Live video is not configured on this server.' : 'Could not connect to live video.');
                setConn({ status: 'error', token: '', wsUrl: '', canPublish: false, error: msg });
            });
        return () => { alive = false; };
    }, [roomName]);

    if (conn.status === 'loading') {
        return (
            <div className="lk-state">
                <FiLoader className="spin-icon" style={{ fontSize: 28 }} />
                <p>Connecting to live video…</p>
            </div>
        );
    }
    if (conn.status === 'error') {
        return (
            <div className="lk-state">
                <FiVideoOff style={{ fontSize: 28, color: 'var(--text-muted)' }} />
                <p>{conn.error}</p>
            </div>
        );
    }

    return (
        <LiveKitRoom
            token={conn.token}
            serverUrl={conn.wsUrl}
            connect
            video={startMediaOnConnect && conn.canPublish}
            audio={startMediaOnConnect && conn.canPublish}
            data-lk-theme="default"
            style={{ height: '100%' }}
            onDisconnected={onLeave}
        >
            <VideoStage />
            <RoomAudioRenderer />
            {/* ControlBar self-hides camera/mic/screen for subscribe-only (webinar) viewers. */}
            <ControlBar />
            {/* Optional in-room logic (LiveKit hooks work here): GD moderator, etc. */}
            {children}
        </LiveKitRoom>
    );
};

export default LiveRoom;
