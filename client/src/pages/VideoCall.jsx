import { useState, useRef, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { updateSessionStatus } from '../services/api';
import { io } from 'socket.io-client';
import Peer from 'peerjs';
import { FiVideo, FiVideoOff, FiMic, FiMicOff, FiMonitor, FiPhoneOff, FiClock } from 'react-icons/fi';

const VideoCall = () => {
    const { sessionId } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const [connected, setConnected] = useState(false);
    const [muted, setMuted] = useState(false);
    const [videoOff, setVideoOff] = useState(false);
    const [elapsed, setElapsed] = useState(0);
    const [peerName, setPeerName] = useState('Waiting for peer...');
    const [ending, setEnding] = useState(false);
    const [status, setStatus] = useState('Initializing camera...');

    const localVideoRef = useRef(null);
    const remoteVideoRef = useRef(null);
    const peerRef = useRef(null);
    const socketRef = useRef(null);
    const streamRef = useRef(null);
    const timerRef = useRef(null);
    const callRef = useRef(null);
    const mountedRef = useRef(true);
    // Queue of peers to call (in case call-peer arrives before PeerJS is open)
    const pendingCallsRef = useRef([]);
    const peerOpenRef = useRef(false);

    const attachRemoteStream = useCallback((remoteStream) => {
        if (!mountedRef.current) return;
        if (remoteVideoRef.current && remoteStream) {
            remoteVideoRef.current.srcObject = remoteStream;
            setConnected(true);
            setStatus('Connected');
            if (!timerRef.current) {
                timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000);
            }
        }
    }, []);

    // Make a PeerJS call to a remote peer
    const makeCall = useCallback((remotePeerId, remoteName, peer, stream) => {
        if (!peer || peer.destroyed || !stream) return;

        setPeerName(remoteName);
        setStatus(`Calling ${remoteName}...`);

        const outgoingCall = peer.call(remotePeerId, stream);
        if (!outgoingCall) {
            setStatus('Call failed - retrying...');
            // Retry after 2 seconds
            setTimeout(() => {
                if (mountedRef.current && peerRef.current && !peerRef.current.destroyed) {
                    makeCall(remotePeerId, remoteName, peerRef.current, streamRef.current);
                }
            }, 2000);
            return;
        }

        callRef.current = outgoingCall;

        outgoingCall.on('stream', (remoteStream) => {
            attachRemoteStream(remoteStream);
        });

        outgoingCall.on('close', () => {
            if (mountedRef.current) {
                setConnected(false);
                setPeerName('Peer disconnected');
            }
        });

        outgoingCall.on('error', (err) => {
            console.error('Call error:', err);
            setStatus('Call error - retrying...');
            setTimeout(() => {
                if (mountedRef.current && peerRef.current && !peerRef.current.destroyed) {
                    makeCall(remotePeerId, remoteName, peerRef.current, streamRef.current);
                }
            }, 3000);
        });
    }, [attachRemoteStream]);

    useEffect(() => {
        mountedRef.current = true;

        const init = async () => {
            try {
                // ─── 1. Camera + Mic (with fallback) ───
                let stream;
                try {
                    stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
                    setStatus('Camera ready. Connecting...');
                } catch (camErr) {
                    console.warn('Camera unavailable, trying audio only:', camErr.message);
                    try {
                        stream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
                        setStatus('Audio only (camera busy). Connecting...');
                    } catch (audioErr) {
                        console.warn('Audio also unavailable, using silent stream:', audioErr.message);
                        // Create a dummy silent stream so PeerJS can still connect
                        const ctx = new AudioContext();
                        const oscillator = ctx.createOscillator();
                        const dest = ctx.createMediaStreamDestination();
                        oscillator.connect(dest);
                        oscillator.start();
                        stream = dest.stream;
                        setStatus('No camera/mic. Connecting...');
                    }
                }
                if (!mountedRef.current) { stream.getTracks().forEach(t => t.stop()); return; }
                streamRef.current = stream;
                if (localVideoRef.current) localVideoRef.current.srcObject = stream;

                // ─── 2. Socket ───
                const socket = io(import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000');
                socketRef.current = socket;

                socket.on('connect', () => {
                    socket.emit('join-session', {
                        sessionId,
                        userId: user?._id,
                        userName: user?.name || 'User'
                    });
                });

                // ─── 3. PeerJS with STUN config ───
                const peer = new Peer(undefined, {
                    config: {
                        iceServers: [
                            { urls: 'stun:stun.l.google.com:19302' },
                            { urls: 'stun:stun1.l.google.com:19302' },
                            { urls: 'stun:stun2.l.google.com:19302' },
                        ]
                    },
                    debug: 0
                });
                peerRef.current = peer;

                peer.on('open', (myPeerId) => {
                    peerOpenRef.current = true;
                    setStatus('Connected to server. Waiting for peer...');

                    // Register with socket server
                    socket.emit('session-peer-id', {
                        sessionId,
                        peerId: myPeerId,
                        userName: user?.name || 'User'
                    });

                    // Process any queued calls that arrived before PeerJS was ready
                    while (pendingCallsRef.current.length > 0) {
                        const { peerId, name } = pendingCallsRef.current.shift();
                        makeCall(peerId, name, peer, stream);
                    }
                });

                // ─── 4. Answer incoming calls (I was here first, they call me) ───
                peer.on('call', (incomingCall) => {
                    callRef.current = incomingCall;
                    incomingCall.answer(stream);

                    incomingCall.on('stream', (remoteStream) => {
                        attachRemoteStream(remoteStream);
                    });

                    incomingCall.on('close', () => {
                        if (mountedRef.current) {
                            setConnected(false);
                            setPeerName('Peer disconnected');
                        }
                    });

                    incomingCall.on('error', (err) => {
                        console.error('Incoming call error:', err);
                    });
                });

                // ─── 5. Server says: "Call this peer" (I joined after them) ───
                socket.on('call-peer', ({ peerId, name }) => {
                    if (peerOpenRef.current && peerRef.current && !peerRef.current.destroyed) {
                        makeCall(peerId, name, peerRef.current, streamRef.current);
                    } else {
                        // PeerJS not ready yet — queue the call
                        pendingCallsRef.current.push({ peerId, name });
                        setPeerName(name);
                        setStatus(`Found ${name}. Connecting PeerJS...`);
                    }
                });

                // ─── 6. Server says: "Someone new joined, they will call you" ───
                socket.on('incoming-peer', ({ peerId, name }) => {
                    setPeerName(name);
                    setStatus(`${name} joined. Connecting...`);
                });

                // ─── 7. Other person ended the session ───
                socket.on('session-ended', () => {
                    cleanup();
                    navigate('/sessions');
                });

                // ─── 8. Other person disconnected ───
                socket.on('session-peer-left', ({ userName: leftName }) => {
                    setPeerName(`${leftName} left`);
                    setConnected(false);
                    setStatus(`${leftName} disconnected`);
                    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
                });

                peer.on('error', (err) => {
                    console.error('PeerJS error:', err);
                    setStatus(`Connection error: ${err.type}`);
                });

                peer.on('disconnected', () => {
                    // Try to reconnect PeerJS
                    if (mountedRef.current && !peer.destroyed) {
                        peer.reconnect();
                    }
                });

            } catch (err) {
                console.error('Init error:', err);
                setStatus(`Error: ${err.message}`);
            }
        };

        init();
        return () => {
            mountedRef.current = false;
            cleanup();
        };
    }, [sessionId]);

    const cleanup = useCallback(() => {
        clearInterval(timerRef.current);
        timerRef.current = null;
        pendingCallsRef.current = [];
        peerOpenRef.current = false;
        try { callRef.current?.close(); } catch {}
        callRef.current = null;
        streamRef.current?.getTracks().forEach(t => t.stop());
        streamRef.current = null;
        try { peerRef.current?.destroy(); } catch {}
        peerRef.current = null;
        socketRef.current?.disconnect();
        socketRef.current = null;
    }, []);

    const toggleMute = () => {
        const audio = streamRef.current?.getAudioTracks()[0];
        if (audio) { audio.enabled = !audio.enabled; setMuted(!audio.enabled); }
    };

    const toggleVideo = () => {
        const video = streamRef.current?.getVideoTracks()[0];
        if (video) { video.enabled = !video.enabled; setVideoOff(!video.enabled); }
    };

    const shareScreen = async () => {
        try {
            const screen = await navigator.mediaDevices.getDisplayMedia({ video: true });
            const screenTrack = screen.getVideoTracks()[0];
            if (localVideoRef.current) localVideoRef.current.srcObject = screen;
            if (callRef.current) {
                const sender = callRef.current.peerConnection
                    ?.getSenders()?.find(s => s.track?.kind === 'video');
                if (sender) sender.replaceTrack(screenTrack);
            }
            screenTrack.onended = () => {
                const camTrack = streamRef.current?.getVideoTracks()[0];
                if (localVideoRef.current) localVideoRef.current.srcObject = streamRef.current;
                if (callRef.current && camTrack) {
                    const sender = callRef.current.peerConnection
                        ?.getSenders()?.find(s => s.track?.kind === 'video');
                    if (sender) sender.replaceTrack(camTrack);
                }
            };
        } catch (err) { console.error('Screen share error:', err); }
    };

    const endCall = async () => {
        setEnding(true);
        try { await updateSessionStatus(sessionId, { status: 'completed' }); }
        catch (err) { console.error('Failed to update session:', err); }
        socketRef.current?.emit('end-session', { sessionId });
        cleanup();
        navigate('/sessions');
    };

    const fmt = (s) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

    return (
        <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-primary)' }}>
            {/* Header */}
            <div style={{ padding: '12px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-secondary)' }}>
                <div>
                    <h3 style={{ fontSize: 16, marginBottom: 2 }}>📹 Mentorship Session</h3>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{status}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <span className={`badge ${connected ? 'badge-success' : 'badge-warning'}`}>
                        {connected ? '🟢 Connected' : '🟡 Waiting'}
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-muted)' }}>
                        <FiClock /> {fmt(elapsed)}
                    </span>
                </div>
            </div>

            {/* Videos */}
            <div className="video-call-container" style={{ flex: 1 }}>
                {/* REMOTE — the other person */}
                <div className="video-box" style={{ position: 'relative' }}>
                    <video ref={remoteVideoRef} autoPlay playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    {!connected && (
                        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12, background: 'rgba(0,0,0,0.6)' }}>
                            <div className="spinner" style={{ margin: 0, width: 36, height: 36 }} />
                            <span style={{ color: '#ccc', fontSize: 14 }}>{peerName}</span>
                            <span style={{ color: '#888', fontSize: 12 }}>{status}</span>
                        </div>
                    )}
                    {connected && (
                        <div style={{ position: 'absolute', bottom: 12, left: 12, padding: '4px 12px', background: 'rgba(0,0,0,0.7)', borderRadius: 6, fontSize: 13, color: 'white' }}>
                            {peerName}
                        </div>
                    )}
                </div>

                {/* LOCAL — you */}
                <div className="video-box" style={{ position: 'relative' }}>
                    <video ref={localVideoRef} autoPlay muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }} />
                    <div style={{ position: 'absolute', bottom: 12, left: 12, padding: '4px 12px', background: 'rgba(0,0,0,0.7)', borderRadius: 6, fontSize: 13, color: 'white' }}>
                        You ({user?.name || 'Me'})
                    </div>
                </div>
            </div>

            {/* Controls */}
            <div className="video-controls">
                <button className={`control-btn ${muted ? 'active' : ''}`} onClick={toggleMute} title={muted ? 'Unmute' : 'Mute'}>
                    {muted ? <FiMicOff /> : <FiMic />}
                </button>
                <button className={`control-btn ${videoOff ? 'active' : ''}`} onClick={toggleVideo} title={videoOff ? 'Turn on camera' : 'Turn off camera'}>
                    {videoOff ? <FiVideoOff /> : <FiVideo />}
                </button>
                <button className="control-btn" onClick={shareScreen} title="Share screen">
                    <FiMonitor />
                </button>
                <button className="control-btn end-call" onClick={endCall} disabled={ending} title="End call & complete session">
                    <FiPhoneOff />
                </button>
            </div>
        </div>
    );
};

export default VideoCall;
