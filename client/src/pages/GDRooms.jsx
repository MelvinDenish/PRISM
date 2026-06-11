import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { getGDRooms, createGDRoom, joinGDRoom } from '../services/api';
import { io } from 'socket.io-client';
import LiveRoom from '../components/rtc/LiveRoom';
import { FiPlus, FiUsers, FiClock, FiMessageSquare, FiVideo, FiVideoOff, FiPhoneOff } from 'react-icons/fi';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

/**
 * Group Discussion rooms. Video is now powered by the self-hosted LiveKit SFU
 * via <LiveRoom> (replaces the old PeerJS full mesh — which capped at 4 peers and
 * had no TURN). The SFU scales n-n group discussion and 1-to-many webinars
 * (GDRoom.mode === 'webinar'). This page keeps the room list, chat, GD timer,
 * and participant presence; LiveKit owns all media.
 */
const GDRooms = () => {
    const { user } = useAuth();
    const [rooms, setRooms] = useState([]);
    const [activeRoom, setActiveRoom] = useState(null);
    const [messages, setMessages] = useState([]);
    const [chatMsg, setChatMsg] = useState('');
    const [timer, setTimer] = useState(null);
    const [gdAlert, setGdAlert] = useState('');
    const [loading, setLoading] = useState(true);

    // Video panel visibility (media itself lives in <LiveRoom>).
    const [videoEnabled, setVideoEnabled] = useState(false);
    const [gdParticipants, setGdParticipants] = useState([]);

    const socketRef = useRef(null);
    const chatEndRef = useRef(null);

    useEffect(() => {
        fetchRooms();
        return () => { socketRef.current?.disconnect(); };
    }, []);

    useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

    const fetchRooms = async () => {
        setLoading(true);
        try {
            const res = await getGDRooms();
            setRooms(res.data.rooms || []);
        } catch (err) { console.error(err); }
        setLoading(false);
    };

    // mode: 'group' (n-n, everyone publishes) or 'webinar' (1-to-many, host publishes)
    const handleCreate = async (mode = 'group') => {
        try {
            const payload = mode === 'webinar' ? { mode: 'webinar', maxParticipants: 100 } : {};
            const res = await createGDRoom(payload);
            await fetchRooms();
            handleJoin(res.data.room);
        } catch (err) { console.error(err); }
    };

    // ─── Join room: chat + GD timer sockets (no media signaling) ───
    // Webinar viewers (non-host) subscribe via LiveKit without consuming a
    // participant slot, so a broadcast can scale past maxParticipants.
    const handleJoin = async (room) => {
        try {
            const isWebinar = room.mode === 'webinar';
            const isHost = String(room.host?._id || room.host || '') === String(user._id);
            let joined = room;
            if (!isWebinar || isHost) {
                const res = await joinGDRoom(room._id);
                joined = res.data.room;
            }
            setActiveRoom(joined);
            setGdParticipants(joined.participants || []);
            // A webinar is for watching — open the video panel immediately.
            if (isWebinar) setVideoEnabled(true);

            socketRef.current = io(SOCKET_URL, { auth: { token: localStorage.getItem('prism_token') } });
            socketRef.current.emit('join-gd', { roomId: room._id });

            socketRef.current.on('receive-message', (msg) => setMessages((prev) => [...prev, msg]));
            socketRef.current.on('gd-alert', ({ message }) => {
                setGdAlert(message);
                setTimeout(() => setGdAlert(''), 5000);
            });
            socketRef.current.on('gd-started', ({ duration }) => setTimer(duration * 60));
            socketRef.current.on('gd-ended', () => { setGdAlert('🔔 GD session has ended!'); setTimer(0); });
            socketRef.current.on('gd-user-joined', ({ userId: joinedUserId, userName: joinedName }) => {
                setGdParticipants((prev) => (
                    prev.find((p) => p._id === joinedUserId || p.userId === joinedUserId)
                        ? prev
                        : [...prev, { _id: joinedUserId, name: joinedName, userId: joinedUserId }]
                ));
            });
            // Shrink the presence list when someone leaves (server emits this on
            // socket disconnect) — without it the participant count only ever grew.
            socketRef.current.on('gd-user-left', ({ userId: leftUserId }) => {
                if (!leftUserId) return;
                setGdParticipants((prev) => prev.filter((p) => (p.userId || p._id) !== leftUserId));
            });
        } catch (err) { console.error(err); }
    };

    const startGD = () => {
        socketRef.current?.emit('start-gd', { roomId: activeRoom._id, topic: activeRoom.gdTopic, duration: 10 });
        setTimer(600);
    };

    const sendMessage = () => {
        if (!chatMsg.trim()) return;
        socketRef.current?.emit('send-message', { roomId: `gd-${activeRoom._id}`, message: chatMsg, userName: user.name });
        setMessages((prev) => [...prev, { message: chatMsg, userName: user.name, timestamp: new Date() }]);
        setChatMsg('');
    };

    const leaveRoom = () => {
        socketRef.current?.disconnect();
        socketRef.current = null;
        setActiveRoom(null);
        setMessages([]);
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
                        <button className={`btn btn-sm ${videoEnabled ? 'btn-danger' : 'btn-secondary'}`} onClick={() => setVideoEnabled((v) => !v)}>
                            {videoEnabled ? <FiVideoOff /> : <FiVideo />} {videoEnabled ? 'Hide Video' : 'Join Video'}
                        </button>
                        <button className="btn btn-secondary btn-sm" onClick={leaveRoom}><FiPhoneOff /> Leave</button>
                    </div>
                </div>

                {gdAlert && (
                    <div style={{ padding: '8px 20px', textAlign: 'center', fontWeight: 600, color: 'var(--accent-warning)', background: 'rgba(245,158,11,0.08)', borderBottom: '1px solid rgba(245,158,11,0.2)', fontSize: 13 }}>
                        {gdAlert}
                    </div>
                )}

                {/* Main content: Video (LiveKit) + Chat */}
                <div style={{ display: 'flex', height: 'calc(100% - 60px)', overflow: 'hidden' }}>
                    {/* Video grid (LiveKit SFU) */}
                    {videoEnabled && (
                        <div style={{ flex: 2, display: 'flex', flexDirection: 'column', borderRight: '1px solid var(--border-color)', overflow: 'hidden', minWidth: 0 }}>
                            <div style={{ flex: 1, minHeight: 0 }}>
                                <LiveRoom roomName={`gd:${activeRoom._id}`} onLeave={() => setVideoEnabled(false)} />
                            </div>
                        </div>
                    )}

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
                <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-secondary" onClick={() => handleCreate('webinar')}><FiVideo /> Create Webinar</button>
                    <button className="btn btn-primary" onClick={() => handleCreate('group')}><FiPlus /> Create Room</button>
                </div>
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
                                <span>🎥 {r.mode === 'webinar' ? 'Webinar (1-to-many)' : 'Live Video'}</span>
                                <span>• Max {r.maxParticipants}</span>
                            </div>
                            {r.status !== 'completed' && (
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

export default GDRooms;
