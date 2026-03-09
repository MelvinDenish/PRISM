import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { getSessions, updateSessionStatus, rateSession } from '../services/api';
import { FiCheck, FiX, FiStar, FiClock } from 'react-icons/fi';

const Sessions = () => {
    const { user } = useAuth();
    const [sessions, setSessions] = useState([]);
    const [filter, setFilter] = useState('');
    const [loading, setLoading] = useState(true);
    const [ratingModal, setRatingModal] = useState(null);
    const [rating, setRating] = useState(5);
    const [feedback, setFeedback] = useState('');

    useEffect(() => { fetchSessions(); }, [filter]);

    const fetchSessions = async () => {
        setLoading(true);
        try {
            const res = await getSessions(filter ? { status: filter } : {});
            setSessions(res.data.sessions || []);
        } catch (err) { console.error(err); }
        setLoading(false);
    };

    const handleStatusUpdate = async (id, status) => {
        try {
            await updateSessionStatus(id, { status });
            fetchSessions();
        } catch (err) { console.error(err); }
    };

    const handleRate = async (e) => {
        e.preventDefault();
        try {
            await rateSession(ratingModal._id, { rating, feedback });
            setRatingModal(null);
            fetchSessions();
        } catch (err) { console.error(err); }
    };

    const statusColors = { pending: 'warning', approved: 'primary', completed: 'success', rejected: 'danger', cancelled: 'danger' };

    return (
        <div className="page">
            <div className="page-header">
                <h1 className="page-title">📅 <span>Mentorship Sessions</span></h1>
                <div style={{ display: 'flex', gap: 8 }}>
                    {['', 'pending', 'approved', 'completed'].map((f) => (
                        <button key={f} className={`btn btn-sm ${filter === f ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setFilter(f)}>
                            {f || 'All'}
                        </button>
                    ))}
                </div>
            </div>

            {loading ? <div className="spinner" /> : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {sessions.map((s) => (
                        <div key={s._id} className="glass-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
                            <div style={{ flex: 1 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                                    <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--gradient-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: 'white' }}>
                                        {(user?.role === 'mentor' ? s.mentee?.name : s.mentor?.name)?.[0]}
                                    </div>
                                    <div>
                                        <div style={{ fontWeight: 600 }}>{user?.role === 'mentor' ? s.mentee?.name : s.mentor?.name}</div>
                                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{user?.role === 'mentor' ? 'Mentee' : s.mentor?.currentCompany || 'Mentor'}</div>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: 16, color: 'var(--text-muted)', fontSize: 13 }}>
                                    <span><FiClock style={{ marginRight: 4 }} />{new Date(s.scheduledDate).toLocaleString()}</span>
                                    {s.duration && <span>{s.duration} min</span>}
                                </div>
                                {s.agenda && <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 8 }}>{s.agenda}</p>}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                <span className={`badge badge-${statusColors[s.status]}`}>{s.status}</span>
                                {user?.role === 'mentor' && s.status === 'pending' && (
                                    <>
                                        <button className="btn btn-success btn-sm" onClick={() => handleStatusUpdate(s._id, 'approved')}><FiCheck /> Approve</button>
                                        <button className="btn btn-danger btn-sm" onClick={() => handleStatusUpdate(s._id, 'rejected')}><FiX /> Reject</button>
                                    </>
                                )}
                                {s.status === 'approved' && (
                                    <button className="btn btn-primary btn-sm" onClick={() => handleStatusUpdate(s._id, 'completed')}>Mark Complete</button>
                                )}
                                {s.status === 'completed' && !s.ratingGiven && (
                                    <button className="btn btn-secondary btn-sm" onClick={() => setRatingModal(s)}><FiStar /> Rate</button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
            {!loading && sessions.length === 0 && <div className="empty-state"><div className="icon">📅</div><p>No sessions yet</p></div>}

            {ratingModal && (
                <div className="modal-overlay" onClick={() => setRatingModal(null)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <h2>Rate Session</h2>
                        <form onSubmit={handleRate}>
                            <div className="form-group">
                                <label>Rating (1-5)</label>
                                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                                    {[1, 2, 3, 4, 5].map((v) => (
                                        <button key={v} type="button" onClick={() => setRating(v)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 28, color: v <= rating ? 'var(--accent-warning)' : 'var(--text-muted)' }}>★</button>
                                    ))}
                                </div>
                            </div>
                            <div className="form-group"><label>Feedback</label><textarea className="form-textarea" value={feedback} onChange={(e) => setFeedback(e.target.value)} placeholder="Share your experience..." /></div>
                            <button className="btn btn-primary" style={{ width: '100%' }}>Submit Rating</button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Sessions;
