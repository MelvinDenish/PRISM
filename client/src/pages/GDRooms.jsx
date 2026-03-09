import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { getGDRooms, createGDRoom, joinGDRoom } from '../services/api';
import { io } from 'socket.io-client';
import { FiPlus, FiUsers, FiClock, FiMessageSquare } from 'react-icons/fi';

const SOCKET_URL = 'http://localhost:5000';

const GDRooms = () => {
    const { user } = useAuth();
    const [rooms, setRooms] = useState([]);
    const [activeRoom, setActiveRoom] = useState(null);
    const [messages, setMessages] = useState([]);
    const [chatMsg, setChatMsg] = useState('');
    const [timer, setTimer] = useState(null);
    const [gdAlert, setGdAlert] = useState('');
    const [loading, setLoading] = useState(true);
    const socketRef = useRef(null);

    useEffect(() => {
        fetchRooms();
        return () => {
            socketRef.current?.disconnect();
        };
    }, []);

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

    const handleJoin = async (room) => {
        try {
            const res = await joinGDRoom(room._id);
            const joined = res.data.room;
            setActiveRoom(joined);

            // Connect socket
            socketRef.current = io(SOCKET_URL);
            socketRef.current.emit('join-gd', { roomId: room._id, userId: user._id, userName: user.name });

            socketRef.current.on('receive-message', (msg) => setMessages((prev) => [...prev, msg]));
            socketRef.current.on('gd-alert', ({ message }) => {
                setGdAlert(message);
                setTimeout(() => setGdAlert(''), 5000);
            });
            socketRef.current.on('gd-started', ({ topic, duration }) => {
                setTimer(duration * 60);
            });
            socketRef.current.on('gd-ended', () => {
                setGdAlert('GD session has ended!');
                setTimer(0);
            });
        } catch (err) { console.error(err); }
    };

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
        socketRef.current?.emit('send-message', { roomId: activeRoom._id, message: chatMsg, userName: user.name });
        setChatMsg('');
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

    // Active room view
    if (activeRoom) {
        return (
            <div className="page">
                <div className="page-header">
                    <div>
                        <h1 className="page-title">💬 <span>Group Discussion</span></h1>
                        <p style={{ color: 'var(--text-muted)', marginTop: 4 }}>Topic: {activeRoom.gdTopic || 'Waiting for topic...'}</p>
                    </div>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', background: 'var(--bg-card)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
                            <FiClock style={{ color: 'var(--accent-warning)' }} />
                            <span style={{ fontFamily: 'monospace', fontSize: 20, fontWeight: 700, color: timer && timer < 60 ? 'var(--accent-danger)' : 'var(--text-primary)' }}>{formatTime(timer)}</span>
                        </div>
                        {activeRoom.status === 'waiting' && (
                            <button className="btn btn-primary" onClick={startGD}>Start GD</button>
                        )}
                        <button className="btn btn-secondary" onClick={() => { setActiveRoom(null); socketRef.current?.disconnect(); fetchRooms(); }}>Leave</button>
                    </div>
                </div>

                {gdAlert && (
                    <div className="glass-card" style={{ borderColor: 'rgba(245, 158, 11, 0.4)', marginBottom: 24, textAlign: 'center', fontWeight: 600, color: 'var(--accent-warning)', animation: 'slideInRight 0.3s ease' }}>
                        {gdAlert}
                    </div>
                )}

                <div style={{ display: 'flex', gap: 20, height: 'calc(100vh - 220px)' }}>
                    {/* Participants */}
                    <div className="glass-card" style={{ width: 220, overflow: 'auto' }}>
                        <h3 style={{ fontSize: 14, marginBottom: 16 }}><FiUsers style={{ marginRight: 4 }} /> Participants ({activeRoom.participants?.length || 0}/{activeRoom.maxParticipants})</h3>
                        {activeRoom.participants?.map((p, i) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: '1px solid var(--border-color)' }}>
                                <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--gradient-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: 'white' }}>
                                    {(p.name || 'U')[0]}
                                </div>
                                <span style={{ fontSize: 13 }}>{p.name || 'User'}</span>
                            </div>
                        ))}
                    </div>

                    {/* Chat */}
                    <div className="glass-card" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                        <h3 style={{ fontSize: 14, marginBottom: 12 }}><FiMessageSquare style={{ marginRight: 4 }} /> Discussion</h3>
                        <div style={{ flex: 1, overflow: 'auto', marginBottom: 12 }}>
                            {messages.length === 0 && <div className="empty-state"><p>Start discussing the topic!</p></div>}
                            {messages.map((m, i) => (
                                <div key={i} style={{ marginBottom: 12, padding: '8px 12px', background: 'var(--bg-input)', borderRadius: 8 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                        <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--accent-primary)' }}>{m.userName}</span>
                                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{new Date(m.timestamp).toLocaleTimeString()}</span>
                                    </div>
                                    <p style={{ fontSize: 14 }}>{m.message}</p>
                                </div>
                            ))}
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                            <input className="form-input" style={{ flex: 1 }} placeholder="Share your thoughts..." value={chatMsg} onChange={(e) => setChatMsg(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && sendMessage()} />
                            <button className="btn btn-primary" onClick={sendMessage}>Send</button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // Room list view
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

export default GDRooms;
