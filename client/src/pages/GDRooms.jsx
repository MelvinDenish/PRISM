import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { getGDRooms, createGDRoom, joinGDRoom } from '../services/api';
import { io } from 'socket.io-client';
import Peer from 'peerjs';
import { FiPlus, FiUsers, FiClock, FiMessageSquare, FiVideo, FiVideoOff, FiMic, FiMicOff, FiPhoneOff, FiMonitor } from 'react-icons/fi';

const SOCKET_URL = 'http://localhost:5000';
const MAX_VIDEO_PEERS = 4;

const GDRooms = () => {
    const { user } = useAuth();
    const [rooms, setRooms] = useState([]);
    const [activeRoom, setActiveRoom] = useState(null);
    const [messages, setMessages] = useState([]);
    const [chatMsg, setChatMsg] = useState('');
    const [timer, setTimer] = useState(null);
    const [gdAlert, setGdAlert] = useState('');
    const [loading, setLoading] = useState(true);

    // Video state
    const [videoEnabled, setVideoEnabled] = useState(false);
    const [audioEnabled, setAudioEnabled] = useState(true);
    const [remotePeers, setRemotePeers] = useState([]); // [{peerId, stream, name}]
    const [gdParticipants, setGdParticipants] = useState([]);

    // Refs
    const socketRef = useRef(null);
    const peerRef = useRef(null);
    const streamRef = useRef(null);
    const localVideoRef = useRef(null);
    const callsRef = useRef(new Map()); // peerId => call object
    const chatEndRef = useRef(null);

    useEffect(() => {
        fetchRooms();
        return () => {
            cleanup();
        };
    }, []);

    useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

    const cleanup = () => {
        streamRef.current?.getTracks().forEach(t => t.stop());
        peerRef.current?.destroy();
        socketRef.current?.disconnect();
        callsRef.current.forEach(call => call.close());
        callsRef.current.clear();
    };

    const fetchRooms = async () => {
        setLoading(true);
        try {
            const res = await getGDRooms();
            setRooms(res.data.rooms || []);
        } catch (err) { console.error(err); }
        setLoading(false);
    };

    const handleCreate = async () => {
        try {
            const res = await createGDRoom({});
            await fetchRooms();
            handleJoin(res.data.room);
        } catch (err) { console.error(err); }
    };

    // ═══════════════════════════════════════════
    // JOIN ROOM — Socket + PeerJS Setup
    // ═══════════════════════════════════════════
    const handleJoin = async (room) => {
        try {
            const res = await joinGDRoom(room._id);
            const joined = res.data.room;
            setActiveRoom(joined);
            setGdParticipants(joined.participants || []);

            // Connect socket
            socketRef.current = io(SOCKET_URL);
            socketRef.current.emit('join-gd', { roomId: room._id, userId: user._id, userName: user.name });

            socketRef.current.on('receive-message', (msg) => {
                setMessages((prev) => [...prev, msg]);
            });

            socketRef.current.on('gd-alert', ({ message }) => {
                setGdAlert(message);
                setTimeout(() => setGdAlert(''), 5000);
            });

            socketRef.current.on('gd-started', ({ topic, duration }) => {
                setTimer(duration * 60);
            });

            socketRef.current.on('gd-ended', () => {
                setGdAlert('🔔 GD session has ended!');
                setTimer(0);
            });

            // PeerJS signaling for video
            socketRef.current.on('gd-peer-joined', ({ peerId, name, userId: joinedUserId }) => {
                if (joinedUserId === user._id) return;
                // Call the new peer if we have a stream
                if (streamRef.current && peerRef.current) {
                    const call = peerRef.current.call(peerId, streamRef.current, { metadata: { name: user.name } });
                    handleCall(call, name);
                }
                setGdParticipants(prev => {
                    if (prev.find(p => p._id === joinedUserId || p.userId === joinedUserId)) return prev;
                    return [...prev, { _id: joinedUserId, name, userId: joinedUserId }];
                });
            });

            socketRef.current.on('gd-peer-left', ({ peerId, userId: leftUserId }) => {
                setRemotePeers(prev => prev.filter(p => p.peerId !== peerId));
                callsRef.current.get(peerId)?.close();
                callsRef.current.delete(peerId);
            });

            socketRef.current.on('gd-user-joined', ({ userId: joinedUserId, userName: joinedName }) => {
                setGdParticipants(prev => {
                    if (prev.find(p => p._id === joinedUserId || p.userId === joinedUserId)) return prev;
                    return [...prev, { _id: joinedUserId, name: joinedName, userId: joinedUserId }];
                });
            });

        } catch (err) { console.error(err); }
    };

    // ═══════════════════════════════════════════
    // VIDEO — Toggle Camera & PeerJS
    // ═══════════════════════════════════════════
    const toggleVideo = async () => {
        if (videoEnabled) {
            // Stop video
            streamRef.current?.getTracks().forEach(t => t.stop());
            peerRef.current?.destroy();
            callsRef.current.forEach(call => call.close());
            callsRef.current.clear();
            setRemotePeers([]);
            setVideoEnabled(false);
            socketRef.current?.emit('gd-leave-video', { roomId: activeRoom._id });
        } else {
            try {
                // Get low-quality stream (240p for reliability)
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: { width: 320, height: 240, frameRate: 15 },
                    audio: true
                });
                streamRef.current = stream;
                if (localVideoRef.current) localVideoRef.current.srcObject = stream;

                // Initialize PeerJS
                const peer = new Peer();
                peerRef.current = peer;

                peer.on('open', (peerId) => {
                    // Tell the room about our peer ID
                    socketRef.current?.emit('gd-video-join', {
                        roomId: activeRoom._id,
                        peerId,
                        name: user.name,
                        userId: user._id
                    });
                });

                // Handle incoming calls
                peer.on('call', (call) => {
                    call.answer(stream);
                    const callerName = call.metadata?.name || 'Participant';
                    handleCall(call, callerName);
                });

                setVideoEnabled(true);
            } catch (err) {
                console.error('Camera error:', err);
                setGdAlert('❌ Camera access denied. Check browser permissions.');
                setTimeout(() => setGdAlert(''), 3000);
            }
        }
    };

    const handleCall = (call, name) => {
        call.on('stream', (remoteStream) => {
            setRemotePeers(prev => {
                // Limit video peers to MAX_VIDEO_PEERS
                if (prev.length >= MAX_VIDEO_PEERS) return prev;
                const existing = prev.find(p => p.peerId === call.peer);
                if (existing) return prev;
                return [...prev, { peerId: call.peer, stream: remoteStream, name }];
            });
        });
        call.on('close', () => {
            setRemotePeers(prev => prev.filter(p => p.peerId !== call.peer));
        });
        callsRef.current.set(call.peer, call);
    };

    const toggleAudio = () => {
        const audio = streamRef.current?.getAudioTracks()[0];
        if (audio) { audio.enabled = !audio.enabled; setAudioEnabled(audio.enabled); }
    };

    // ═══════════════════════════════════════════
    // GD CONTROLS
    // ═══════════════════════════════════════════
    const startGD = () => {
        socketRef.current?.emit('start-gd', {
            roomId: activeRoom._id,
            topic: activeRoom.gdTopic,
            duration: 10
        });
        setTimer(600);
    };

    const sendMessage = () => {
        if (!chatMsg.trim()) return;
        socketRef.current?.emit('send-message', { roomId: `gd-${activeRoom._id}`, message: chatMsg, userName: user.name });
        setMessages(prev => [...prev, { message: chatMsg, userName: user.name, timestamp: new Date() }]);
        setChatMsg('');
    };

    const leaveRoom = () => {
        cleanup();
        setActiveRoom(null);
        setMessages([]);
        setRemotePeers([]);
        setVideoEnabled(false);
        setGdParticipants([]);
        fetchRooms();
    };

    // Timer countdown
    useEffect(() => {
        if (timer === null || timer <= 0) return;
        const interval = setInterval(() => setTimer((t) => (t > 0 ? t - 1 : 0)), 1000);
        return () => clearInterval(interval);
    }, [timer]);

    const formatTime = (s) => {
        if (s === null) return '--:--';
        const m = Math.floor(s / 60);
        const sec = s % 60;
        return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
    };

    // ═══════════════════════════════════════════
    // ACTIVE ROOM VIEW
    // ═══════════════════════════════════════════
    if (activeRoom) {
        return (
            <div className="page" style={{ padding: 0, height: 'calc(100vh - 64px)' }}>
                {/* Header */}
                <div style={{ padding: '10px 20px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-glass)', backdropFilter: 'blur(16px)' }}>
                    <div>
                        <h2 style={{ fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                            💬 Group Discussion
                        </h2>
                        <p style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 2 }}>Topic: {activeRoom.gdTopic || 'Waiting for topic...'}</p>
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', background: 'var(--bg-card)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
                            <FiClock style={{ color: 'var(--accent-warning)' }} />
                            <span style={{ fontFamily: 'monospace', fontSize: 18, fontWeight: 700, color: timer && timer < 60 ? 'var(--accent-danger)' : 'var(--text-primary)' }}>{formatTime(timer)}</span>
                        </div>
                        {activeRoom.status === 'waiting' && (
                            <button className="btn btn-primary btn-sm" onClick={startGD}>Start GD</button>
                        )}
                        <button className={`btn btn-sm ${videoEnabled ? 'btn-danger' : 'btn-secondary'}`} onClick={toggleVideo}>
                            {videoEnabled ? <FiVideoOff /> : <FiVideo />} {videoEnabled ? 'Stop Video' : 'Join Video'}
                        </button>
                        <button className={`btn btn-sm ${!audioEnabled ? 'btn-danger' : 'btn-secondary'}`} onClick={toggleAudio} disabled={!videoEnabled}>
                            {audioEnabled ? <FiMic /> : <FiMicOff />}
                        </button>
                        <button className="btn btn-secondary btn-sm" onClick={leaveRoom}><FiPhoneOff /> Leave</button>
                    </div>
                </div>

                {gdAlert && (
                    <div style={{ padding: '8px 20px', textAlign: 'center', fontWeight: 600, color: 'var(--accent-warning)', background: 'rgba(245,158,11,0.08)', borderBottom: '1px solid rgba(245,158,11,0.2)', fontSize: 13 }}>
                        {gdAlert}
                    </div>
                )}

                {/* Main content: Video Grid + Chat */}
                <div style={{ display: 'flex', height: 'calc(100% - 60px)', overflow: 'hidden' }}>
                    {/* Video Grid + Participants */}
                    <div style={{ flex: videoEnabled ? 2 : 0, display: videoEnabled ? 'flex' : 'none', flexDirection: 'column', borderRight: '1px solid var(--border-color)', overflow: 'hidden' }}>
                        {/* Video grid */}
                        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: remotePeers.length > 1 ? '1fr 1fr' : '1fr', gap: 4, padding: 8, overflow: 'auto' }}>
                            {/* Local video */}
                            <div style={{ position: 'relative', background: '#111', borderRadius: 8, overflow: 'hidden', aspectRatio: '4/3', minHeight: 0 }}>
                                <video ref={localVideoRef} autoPlay muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }} />
                                <div style={{ position: 'absolute', bottom: 6, left: 6, padding: '2px 8px', background: 'rgba(0,0,0,0.7)', borderRadius: 4, fontSize: 11, color: 'white' }}>
                                    You {!audioEnabled && '🔇'}
                                </div>
                            </div>

                            {/* Remote video feeds */}
                            {remotePeers.map((peer) => (
                                <RemoteVideo key={peer.peerId} stream={peer.stream} name={peer.name} />
                            ))}

                            {/* Audio-only overflow message */}
                            {gdParticipants.length > MAX_VIDEO_PEERS + 1 && (
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-card)', borderRadius: 8, padding: 16 }}>
                                    <p style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>
                                        +{gdParticipants.length - MAX_VIDEO_PEERS - 1} participants<br />(audio only)
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* Participant list below video */}
                        <div style={{ padding: '8px 12px', borderTop: '1px solid var(--border-color)', background: 'var(--bg-card)' }}>
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                                <FiUsers style={{ fontSize: 12, color: 'var(--text-muted)' }} />
                                {gdParticipants.map((p, i) => (
                                    <span key={i} className="chip" style={{ fontSize: 10, padding: '2px 8px' }}>{p.name || 'User'}</span>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Participants sidebar when video is off */}
                    {!videoEnabled && (
                        <div style={{ width: 220, borderRight: '1px solid var(--border-color)', overflow: 'auto', padding: 16 }}>
                            <h3 style={{ fontSize: 13, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 6 }}>
                                <FiUsers /> Participants ({gdParticipants.length || 0}/{activeRoom.maxParticipants})
                            </h3>
                            {gdParticipants.map((p, i) => (
                                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: '1px solid var(--border-color)' }}>
                                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--gradient-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: 'white' }}>
                                        {(p.name || 'U')[0]}
                                    </div>
                                    <span style={{ fontSize: 13 }}>{p.name || 'User'}</span>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Chat */}
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                        <div style={{ padding: '8px 16px', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-card)' }}>
                            <h3 style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                                <FiMessageSquare /> Discussion Chat
                            </h3>
                        </div>
                        <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
                            {messages.length === 0 && <div className="empty-state"><p>Start discussing the topic!</p></div>}
                            {messages.map((m, i) => (
                                <div key={i} style={{ marginBottom: 12, padding: '10px 14px', background: m.userName === user.name ? 'rgba(99,102,241,0.08)' : 'var(--bg-input)', borderRadius: 10, borderTopLeftRadius: m.userName === user.name ? 10 : 2, borderTopRightRadius: m.userName !== user.name ? 10 : 2 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                        <span style={{ fontWeight: 600, fontSize: 12, color: m.userName === user.name ? 'var(--accent-primary)' : 'var(--accent-success)' }}>{m.userName}</span>
                                        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{m.timestamp ? new Date(m.timestamp).toLocaleTimeString() : ''}</span>
                                    </div>
                                    <p style={{ fontSize: 13, lineHeight: 1.5 }}>{m.message}</p>
                                </div>
                            ))}
                            <div ref={chatEndRef} />
                        </div>
                        <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border-color)', display: 'flex', gap: 8 }}>
                            <input className="form-input" style={{ flex: 1, fontSize: 13 }} placeholder="Share your thoughts..." value={chatMsg}
                                onChange={(e) => setChatMsg(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && sendMessage()} />
                            <button className="btn btn-primary" onClick={sendMessage}>Send</button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // ═══════════════════════════════════════════
    // ROOM LIST VIEW
    // ═══════════════════════════════════════════
    return (
        <div className="page">
            <div className="page-header">
                <h1 className="page-title">💬 <span>Group Discussion Rooms</span></h1>
                <button className="btn btn-primary" onClick={handleCreate}><FiPlus /> Create Room</button>
            </div>

            {loading ? <div className="spinner" /> : (
                <div className="grid grid-3">
                    {rooms.map((r) => (
                        <div key={r._id} className="glass-card">
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                                <span className={`badge badge-${r.status === 'waiting' ? 'warning' : r.status === 'active' ? 'success' : 'info'}`}>{r.status}</span>
                                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{r.participants?.length || 0}/{r.maxParticipants} joined</span>
                            </div>
                            <h3 style={{ fontSize: 14, marginBottom: 8, color: 'var(--text-secondary)' }}>{r.gdTopic || 'Topic TBD'}</h3>
                            <div className="progress-bar" style={{ marginBottom: 12 }}>
                                <div className="fill" style={{ width: `${((r.participants?.length || 0) / r.maxParticipants) * 100}%` }} />
                            </div>
                            <div style={{ display: 'flex', gap: 6, fontSize: 11, color: 'var(--text-muted)', marginBottom: 12 }}>
                                <span>🎥 Video Call Supported</span>
                                <span>• Max {r.maxParticipants} participants</span>
                            </div>
                            {r.status === 'waiting' && (
                                <button className="btn btn-primary btn-sm" style={{ width: '100%' }} onClick={() => handleJoin(r)}>Join Room</button>
                            )}
                        </div>
                    ))}
                </div>
            )}
            {!loading && rooms.length === 0 && <div className="empty-state"><div className="icon">💬</div><p>No GD rooms yet. Create one!</p></div>}
        </div>
    );
};

// Remote video component — handles srcObject properly
const RemoteVideo = ({ stream, name }) => {
    const videoRef = useRef(null);
    useEffect(() => {
        if (videoRef.current && stream) {
            videoRef.current.srcObject = stream;
        }
    }, [stream]);

    return (
        <div style={{ position: 'relative', background: '#111', borderRadius: 8, overflow: 'hidden', aspectRatio: '4/3', minHeight: 0 }}>
            <video ref={videoRef} autoPlay playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            <div style={{ position: 'absolute', bottom: 6, left: 6, padding: '2px 8px', background: 'rgba(0,0,0,0.7)', borderRadius: 4, fontSize: 11, color: 'white' }}>
                {name}
            </div>
        </div>
    );
};

export default GDRooms;
