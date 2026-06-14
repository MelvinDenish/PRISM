import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import {
    getGDRooms, createGDRoom, joinGDRoom, joinGDRoomByCode,
    startGDRoom, endGDRoom, evaluateGDRoom, endWebinar,
} from '../services/api';
import { io } from 'socket.io-client';
import LiveRoom from '../components/rtc/LiveRoom';
import GdModerator from '../components/gd/GdModerator';
import { FiPlus, FiUsers, FiClock, FiMessageSquare, FiPhoneOff, FiCopy, FiCheck, FiPlay } from 'react-icons/fi';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';
const GD_DURATION_MIN = 10;

/**
 * Group Discussion rooms — now PRIVATE (invite-code gated) with an AI voice
 * moderator and per-person feedback. A mentee creates a room, shares the code with
 * friends, everyone joins, the host presses Start → cams/mics turn on, a topic is
 * revealed, the moderator speaks guidance, and at the end each person gets their
 * own scorecard (server-authoritative; silence is flagged as the #1 thing to fix).
 * Video is the LiveKit SFU via <LiveRoom>; this page owns the list, chat, timer,
 * presence, start/end flow, and results.
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
    const [joinCode, setJoinCode] = useState('');
    const [joinError, setJoinError] = useState('');
    const [copied, setCopied] = useState(false);

    const [gdParticipants, setGdParticipants] = useState([]);
    const [started, setStarted] = useState(false);
    const [topic, setTopic] = useState('');
    const [ended, setEnded] = useState(false);
    const [evaluating, setEvaluating] = useState(false);
    const [result, setResult] = useState(null);

    const socketRef = useRef(null);
    const chatEndRef = useRef(null);

    const isHostOf = (room) => String(room?.host?._id || room?.host || '') === String(user._id);
    const isHost = activeRoom && isHostOf(activeRoom);
    const isWebinar = activeRoom?.mode === 'webinar';

    useEffect(() => {
        fetchRooms();
        // Deep-link: /gd-rooms?join=CODE auto-joins via the invite code.
        const code = new URLSearchParams(window.location.search).get('join');
        if (code) { setJoinCode(code.toUpperCase()); handleJoinByCode(code); }
        return () => { socketRef.current?.disconnect(); };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

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
            const res = await createGDRoom(); // group room with a fresh invite code
            await fetchRooms();
            openRoom(res.data.room);
        } catch (err) { console.error(err); }
    };

    const handleJoinByCode = async (codeArg) => {
        const code = String(codeArg ?? joinCode).trim();
        if (!code) return;
        setJoinError('');
        try {
            const res = await joinGDRoomByCode(code);
            openRoom(res.data.room);
        } catch (err) {
            setJoinError(err?.response?.data?.message || 'Could not join with that code');
        }
    };

    // Join a room I already belong to (from my list).
    const handleJoin = async (room) => {
        try {
            // Webinar viewers don't consume a participant slot; group members (re)join.
            const joined = room.mode === 'webinar' && !isHostOf(room) ? room : (await joinGDRoom(room._id)).data.room;
            openRoom(joined);
        } catch (err) { console.error(err); }
    };

    // Open the live room view + wire the presence/chat/timer socket.
    const openRoom = (room) => {
        socketRef.current?.disconnect(); // never leak a prior room's socket
        setActiveRoom(room);
        setGdParticipants(room.participants || []);
        setMessages([]);
        setTimer(null);
        setEnded(false);
        setResult(null);
        // If we join a room that's already running, pick up its topic + started state.
        const live = room.status === 'active';
        setStarted(live);
        setTopic(room.gdTopic || '');

        socketRef.current = io(SOCKET_URL, { auth: { token: localStorage.getItem('prism_token') } });
        socketRef.current.emit('join-gd', { roomId: room._id });

        socketRef.current.on('receive-message', (msg) => setMessages((prev) => [...prev, msg]));
        socketRef.current.on('gd-alert', ({ message }) => {
            setGdAlert(message);
            setTimeout(() => setGdAlert(''), 5000);
        });
        socketRef.current.on('gd-started', ({ topic: t, duration }) => {
            setTopic(t || '');
            setStarted(true);
            setTimer((duration || GD_DURATION_MIN) * 60);
        });
        socketRef.current.on('gd-ended', () => { setGdAlert('🔔 GD session has ended!'); setTimer(0); setEnded(true); });
        socketRef.current.on('gd-user-joined', ({ userId: joinedUserId, userName: joinedName }) => {
            setGdParticipants((prev) => (
                prev.find((p) => p._id === joinedUserId || p.userId === joinedUserId)
                    ? prev
                    : [...prev, { _id: joinedUserId, name: joinedName, userId: joinedUserId }]
            ));
        });
        socketRef.current.on('gd-user-left', ({ userId: leftUserId }) => {
            if (!leftUserId) return;
            setGdParticipants((prev) => prev.filter((p) => (p.userId || p._id) !== leftUserId));
        });
    };

    // Host starts: server reveals a topic, flips to active, and broadcasts gd-started
    // (which every client — including the host — receives to enable cam/mic + timer).
    const startGD = async () => {
        try { await startGDRoom(activeRoom._id, { duration: GD_DURATION_MIN }); }
        catch (err) { console.error(err); }
    };

    const hostEnd = async () => {
        try { await endGDRoom(activeRoom._id); } catch (err) { console.error(err); }
        setEnded(true); setTimer(0);
    };

    // Webinar host ends → server completes every linked mentorship request (history).
    const hostEndWebinar = async () => {
        try { await endWebinar(activeRoom._id); } catch (err) { console.error(err); }
        leaveRoom();
    };

    // The moderator reports THIS user's participation + transcript when the GD ends.
    const handleReport = async (participation, transcript) => {
        if (isWebinar) return;
        setEvaluating(true);
        try {
            const res = await evaluateGDRoom(activeRoom._id, { topic, participation, transcript });
            setResult(res.data.evaluation);
        } catch (err) {
            setResult({ error: err?.response?.data?.message || 'Could not generate feedback.' });
        }
        setEvaluating(false);
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
        setGdParticipants([]);
        setStarted(false);
        setEnded(false);
        setResult(null);
        setTimer(null);
        fetchRooms();
    };

    const copyInvite = async () => {
        if (!activeRoom?.inviteCode) return;
        const link = `${window.location.origin}/gd-rooms?join=${activeRoom.inviteCode}`;
        try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 2000); }
        catch { /* clipboard blocked — the code is shown on screen as a fallback */ }
    };

    // Timer countdown
    useEffect(() => {
        if (timer === null || timer <= 0) return;
        const interval = setInterval(() => setTimer((t) => (t > 0 ? t - 1 : 0)), 1000);
        return () => clearInterval(interval);
    }, [timer]);

    // When the countdown reaches 0 mid-GD, end it (triggers the moderator's report).
    // The host also tells the server so the room is marked completed and cleaned up.
    useEffect(() => {
        if (started && timer === 0 && !ended) {
            setEnded(true);
            if (isHost && !isWebinar) endGDRoom(activeRoom._id).catch(() => {});
        }
    }, [timer, started, ended]); // eslint-disable-line react-hooks/exhaustive-deps

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
                            {isWebinar ? '📡 Webinar' : '💬 Group Discussion'}
                        </h2>
                        <p style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 2 }}>
                            {started ? `Topic: ${topic || '…'}` : 'Waiting to start — share the invite code with your friends'}
                        </p>
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        {/* Invite code chip (host shares this) */}
                        <button className="btn btn-secondary btn-sm" onClick={copyInvite} title="Copy invite link">
                            {copied ? <FiCheck /> : <FiCopy />} <span style={{ fontFamily: 'monospace', letterSpacing: 1 }}>{activeRoom.inviteCode}</span>
                        </button>
                        {!isWebinar && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', background: 'var(--bg-card)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
                                <FiClock style={{ color: 'var(--accent-warning)' }} />
                                <span style={{ fontFamily: 'monospace', fontSize: 18, fontWeight: 700, color: timer && timer < 60 ? 'var(--accent-danger)' : 'var(--text-primary)' }}>{formatTime(timer)}</span>
                            </div>
                        )}
                        {isHost && !started && !isWebinar && (
                            <button className="btn btn-primary btn-sm" onClick={startGD}><FiPlay /> Start GD</button>
                        )}
                        {isHost && started && !ended && !isWebinar && (
                            <button className="btn btn-danger btn-sm" onClick={hostEnd}>End</button>
                        )}
                        {isHost && isWebinar && (
                            <button className="btn btn-danger btn-sm" onClick={hostEndWebinar}>End Webinar</button>
                        )}
                        <button className="btn btn-secondary btn-sm" onClick={leaveRoom}><FiPhoneOff /> Leave</button>
                    </div>
                </div>

                {gdAlert && (
                    <div style={{ padding: '8px 20px', textAlign: 'center', fontWeight: 600, color: 'var(--accent-warning)', background: 'rgba(245,158,11,0.08)', borderBottom: '1px solid rgba(245,158,11,0.2)', fontSize: 13 }}>
                        {gdAlert}
                    </div>
                )}

                {/* Main content: Video (LiveKit) + Chat */}
                <div style={{ display: 'flex', height: 'calc(100% - 60px)', overflow: 'hidden', position: 'relative' }}>
                    <div style={{ flex: 2, display: 'flex', flexDirection: 'column', borderRight: '1px solid var(--border-color)', overflow: 'hidden', minWidth: 0, position: 'relative' }}>
                        <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
                            <LiveRoom
                                roomName={`gd:${activeRoom._id}`}
                                onLeave={leaveRoom}
                                startMediaOnConnect={isWebinar}  // group: stay off until Start; webinar: host goes live now
                            >
                                {!isWebinar && (
                                    <GdModerator
                                        started={started}
                                        ended={ended}
                                        topic={topic}
                                        durationMin={GD_DURATION_MIN}
                                        remaining={timer}
                                        myUserId={user._id}
                                        onReport={handleReport}
                                    />
                                )}
                            </LiveRoom>
                        </div>
                    </div>

                    {/* Chat */}
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                        <div style={{ padding: '8px 16px', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-card)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h3 style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                                <FiMessageSquare /> Discussion Chat
                            </h3>
                            <span style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                                <FiUsers /> {gdParticipants.length || 0}
                            </span>
                        </div>
                        <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
                            {messages.length === 0 && <div className="empty-state"><p>{started ? 'Discuss the topic!' : 'Waiting for the host to start…'}</p></div>}
                            {messages.map((m, i) => (
                                <div key={i} style={{ marginBottom: 12, padding: '10px 14px', background: m.userName === user.name ? 'rgba(99,102,241,0.08)' : 'var(--bg-input)', borderRadius: 10 }}>
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

                    {/* Results overlay (per-person feedback) */}
                    {ended && !isWebinar && (
                        <ResultsOverlay evaluating={evaluating} result={result} onClose={leaveRoom} />
                    )}
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
                {/* Only mentees create peer GD rooms. Mentors host webinars from My Sessions. */}
                {(user?.role === 'mentee' || user?.role === 'admin') && (
                    <button className="btn btn-primary" onClick={handleCreate}><FiPlus /> Create Room</button>
                )}
            </div>

            {/* Join by invite code */}
            <div className="glass-card" style={{ marginBottom: 20, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 600 }}>Have an invite code?</span>
                <input
                    className="form-input"
                    style={{ width: 160, fontFamily: 'monospace', letterSpacing: 2, textTransform: 'uppercase' }}
                    placeholder="ABC123"
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                    onKeyDown={(e) => e.key === 'Enter' && handleJoinByCode()}
                />
                <button className="btn btn-secondary" onClick={() => handleJoinByCode()}>Join</button>
                {joinError && <span style={{ color: 'var(--accent-danger)', fontSize: 12 }}>{joinError}</span>}
            </div>

            {loading ? <div className="spinner" /> : (
                <div className="grid grid-3">
                    {rooms.map((r) => (
                        <div key={r._id} className="glass-card">
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                                <span className={`badge badge-${r.status === 'waiting' ? 'warning' : r.status === 'active' ? 'success' : 'info'}`}>{r.status}</span>
                                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{r.participants?.length || 0}/{r.maxParticipants} joined</span>
                            </div>
                            <h3 style={{ fontSize: 14, marginBottom: 8, color: 'var(--text-secondary)' }}>
                                {r.status === 'completed' ? (r.gdTopic || 'Discussion') : (r.mode === 'webinar' ? 'Webinar' : 'Group Discussion')}
                            </h3>
                            <div style={{ display: 'flex', gap: 6, fontSize: 11, color: 'var(--text-muted)', marginBottom: 12 }}>
                                <span>{r.mode === 'webinar' ? '📡 Webinar (1-to-many)' : '🎥 Live GD'}</span>
                                {isHostOf(r) && <span>• You host • Code <strong style={{ fontFamily: 'monospace' }}>{r.inviteCode}</strong></span>}
                            </div>
                            {r.status !== 'completed' && (
                                <button className="btn btn-primary btn-sm" style={{ width: '100%' }} onClick={() => handleJoin(r)}>
                                    {r.mode === 'webinar' && !isHostOf(r) ? 'Join Webinar' : 'Enter Room'}
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            )}
            {!loading && rooms.length === 0 && (
                <div className="empty-state"><div className="icon">💬</div><p>No rooms yet. Create one and share the code with your friends!</p></div>
            )}
        </div>
    );
};

// Per-person scorecard shown when the GD ends.
const ResultsOverlay = ({ evaluating, result, onClose }) => {
    const overall = result ? (result.overallScore ?? result.overall ?? 0) : 0;
    const dims = result ? [
        ['Communication', result.communication], ['Content', result.contentQuality],
        ['Leadership', result.leadership], ['Teamwork', result.teamwork], ['Reasoning', result.reasoning],
    ].filter(([, v]) => typeof v === 'number') : [];
    return (
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(4,17,13,0.86)', backdropFilter: 'blur(8px)', zIndex: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, overflow: 'auto' }}>
            <div className="glass-card" style={{ maxWidth: 560, width: '100%' }}>
                <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 4 }}>Your GD Feedback</h2>
                {evaluating && <p style={{ color: 'var(--text-muted)' }}>Analyzing your participation and contributions…</p>}
                {!evaluating && result?.error && <p style={{ color: 'var(--accent-danger)' }}>{result.error}</p>}
                {!evaluating && result && !result.error && (
                    <>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, margin: '8px 0 16px' }}>
                            <span style={{ fontSize: 40, fontWeight: 800, color: 'var(--accent-primary)' }}>{overall}</span>
                            <span style={{ color: 'var(--text-muted)' }}>/ 100 · {result.verdict}</span>
                        </div>
                        {dims.length > 0 && (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, marginBottom: 16 }}>
                                {dims.map(([label, v]) => (
                                    <div key={label} style={{ fontSize: 12, display: 'flex', justifyContent: 'space-between', padding: '6px 10px', background: 'var(--bg-input)', borderRadius: 8 }}>
                                        <span style={{ color: 'var(--text-muted)' }}>{label}</span><strong>{v}</strong>
                                    </div>
                                ))}
                            </div>
                        )}
                        {result.detailedFeedback && <p style={{ fontSize: 13, lineHeight: 1.6, marginBottom: 12 }}>{result.detailedFeedback}</p>}
                        {Array.isArray(result.improvements) && result.improvements.length > 0 && (
                            <div style={{ marginBottom: 12 }}>
                                <h4 style={{ fontSize: 13, color: 'var(--accent-warning)', marginBottom: 6 }}>To improve</h4>
                                <ul style={{ fontSize: 13, paddingLeft: 18, lineHeight: 1.6 }}>
                                    {result.improvements.map((s, i) => <li key={i}>{s}</li>)}
                                </ul>
                            </div>
                        )}
                    </>
                )}
                <button className="btn btn-primary" style={{ width: '100%', marginTop: 8 }} onClick={onClose}>Back to Rooms</button>
            </div>
        </div>
    );
};

export default GDRooms;
