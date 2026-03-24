import { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import Peer from 'peerjs';
import { FiVideo, FiVideoOff, FiMic, FiMicOff, FiMonitor, FiPhoneOff, FiClock } from 'react-icons/fi';

const VideoCall = () => {
    const { sessionId } = useParams();
    const navigate = useNavigate();
    const [connected, setConnected] = useState(false);
    const [muted, setMuted] = useState(false);
    const [videoOff, setVideoOff] = useState(false);
    const [elapsed, setElapsed] = useState(0);
    const [peerName, setPeerName] = useState('Waiting...');
    const localVideoRef = useRef(null);
    const remoteVideoRef = useRef(null);
    const peerRef = useRef(null);
    const socketRef = useRef(null);
    const streamRef = useRef(null);
    const timerRef = useRef(null);

    useEffect(() => {
        const init = async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
                streamRef.current = stream;
                if (localVideoRef.current) localVideoRef.current.srcObject = stream;

                socketRef.current = io('http://localhost:5000');
                socketRef.current.emit('join-session', { sessionId });

                const peer = new Peer();
                peerRef.current = peer;

                peer.on('open', (id) => {
                    socketRef.current.emit('session-peer-id', { sessionId, peerId: id });
                });

                peer.on('call', (call) => {
                    call.answer(stream);
                    call.on('stream', (remoteStream) => {
                        if (remoteVideoRef.current) remoteVideoRef.current.srcObject = remoteStream;
                        setConnected(true);
                        setPeerName('Connected');
                        startTimer();
                    });
                });

                socketRef.current.on('peer-joined', ({ peerId, name }) => {
                    setPeerName(name || 'Peer');
                    const call = peer.call(peerId, stream);
                    call.on('stream', (remoteStream) => {
                        if (remoteVideoRef.current) remoteVideoRef.current.srcObject = remoteStream;
                        setConnected(true);
                        startTimer();
                    });
                });

                socketRef.current.on('session-ended', () => { endCall(); });
            } catch (err) {
                console.error('Media error:', err);
            }
        };

        init();
        return () => { cleanup(); };
    }, [sessionId]);

    const startTimer = () => {
        timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000);
    };

    const cleanup = () => {
        clearInterval(timerRef.current);
        streamRef.current?.getTracks().forEach(t => t.stop());
        peerRef.current?.destroy();
        socketRef.current?.disconnect();
    };

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
            const videoTrack = screen.getVideoTracks()[0];
            const sender = peerRef.current?.connections;
            if (localVideoRef.current) localVideoRef.current.srcObject = screen;
            videoTrack.onended = () => {
                if (localVideoRef.current) localVideoRef.current.srcObject = streamRef.current;
            };
        } catch (err) { console.error('Screen share error:', err); }
    };

    const endCall = () => {
        socketRef.current?.emit('end-session', { sessionId });
        cleanup();
        navigate('/sessions');
    };

    const formatTime = (s) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

    return (
        <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-primary)' }}>
            <div style={{ padding: '12px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-glass)', backdropFilter: 'blur(16px)' }}>
                <h3 style={{ fontSize: 16 }}>📹 Mentorship Session</h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <span className={`badge ${connected ? 'badge-success' : 'badge-warning'}`}>{connected ? '🟢 Connected' : '🟡 Waiting'}</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-muted)' }}><FiClock /> {formatTime(elapsed)}</span>
                </div>
            </div>
            <div className="video-call-container" style={{ flex: 1 }}>
                <div className="video-box">
                    <video ref={remoteVideoRef} autoPlay playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    <div style={{ position: 'absolute', bottom: 12, left: 12, padding: '4px 12px', background: 'rgba(0,0,0,0.6)', borderRadius: 6, fontSize: 13, color: 'white' }}>{peerName}</div>
                </div>
                <div className="video-box" style={{ position: 'relative' }}>
                    <video ref={localVideoRef} autoPlay muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }} />
                    <div style={{ position: 'absolute', bottom: 12, left: 12, padding: '4px 12px', background: 'rgba(0,0,0,0.6)', borderRadius: 6, fontSize: 13, color: 'white' }}>You</div>
                </div>
            </div>
            <div className="video-controls">
                <button className={`control-btn ${muted ? 'active' : ''}`} onClick={toggleMute}>{muted ? <FiMicOff /> : <FiMic />}</button>
                <button className={`control-btn ${videoOff ? 'active' : ''}`} onClick={toggleVideo}>{videoOff ? <FiVideoOff /> : <FiVideo />}</button>
                <button className="control-btn" onClick={shareScreen}><FiMonitor /></button>
                <button className="control-btn end-call" onClick={endCall}><FiPhoneOff /></button>
            </div>
        </div>
    );
};

export default VideoCall;
