import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getSessions, updateSessionStatus, rateSession } from '../services/api';
import { FiCheck, FiX, FiStar, FiClock, FiVideo, FiPhoneOff, FiCalendar } from 'react-icons/fi';
import Reveal from '../components/motion/Reveal';
import PageHero from '../components/ui/PageHero';
import SegmentedControl from '../components/ui/SegmentedControl';
import { SkeletonGrid } from '../components/ui/Skeleton';
import Modal from '../components/ui/Modal';

const Sessions = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [sessions, setSessions] = useState([]);
    const [filter, setFilter] = useState('');
    const [loading, setLoading] = useState(true);
    const [ratingModal, setRatingModal] = useState(null);
    const [rating, setRating] = useState(5);
    const [feedback, setFeedback] = useState('');

    useEffect(() => { fetchSessions(); }, [filter]);

    const fetchSessions = async () => {
        setLoading(true);
        try { const res = await getSessions(filter ? { status: filter } : {}); setSessions(res.data.sessions || []); }
        catch (err) { console.error(err); }
        setLoading(false);
    };

    const handleStatusUpdate = async (id, status) => {
        try { await updateSessionStatus(id, { status }); fetchSessions(); }
        catch (err) { console.error(err); }
    };

    const handleStartCall = (sessionId) => {
        navigate(`/video-call/${sessionId}`);
    };

    const handleRate = async (e) => {
        e.preventDefault();
        try { await rateSession(ratingModal._id, { rating, feedback }); setRatingModal(null); fetchSessions(); }
        catch (err) { console.error(err); }
    };

    const statusColors = { pending: 'warning', approved: 'primary', 'in-progress': 'info', completed: 'success', rejected: 'danger', cancelled: 'danger' };

    return (
        <div className="page">
            <PageHero
                eyebrow="Mentorship"
                title="Mentorship Sessions"
                subtitle="Approve, join and review your 1:1 sessions."
                icon={<FiCalendar />}
                actions={
                    <SegmentedControl
                        id="session-filter"
                        size="sm"
                        value={filter}
                        onChange={setFilter}
                        options={[
                            { value: '', label: 'All' },
                            { value: 'pending', label: 'Pending' },
                            { value: 'approved', label: 'Approved' },
                            { value: 'in-progress', label: 'Live' },
                            { value: 'completed', label: 'Done' },
                        ]}
                    />
                }
            />

            {loading ? <SkeletonGrid count={4} cols={1} /> : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {sessions.map((s, idx) => (
                        <Reveal as="div" key={s._id} i={idx} className="glass-card spotlight" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
                            <div style={{ flex: 1 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                                    <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--gradient-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: 'white', fontSize: 18 }}>
                                        {(user?.role === 'mentor' ? s.mentee?.name : s.mentor?.name)?.[0]}
                                    </div>
                                    <div>
                                        <div style={{ fontWeight: 600, fontSize: 15 }}>{user?.role === 'mentor' ? s.mentee?.name : s.mentor?.name}</div>
                                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                            {user?.role === 'mentor' ? `Mentee • ${s.mentee?.email || ''}` : `${s.mentor?.currentCompany || 'Mentor'} • ${s.mentor?.email || ''}`}
                                        </div>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: 16, color: 'var(--text-muted)', fontSize: 13, flexWrap: 'wrap' }}>
                                    <span><FiClock style={{ marginRight: 4 }} />{new Date(s.scheduledDate).toLocaleString()}</span>
                                    {s.duration && <span>⏱ {s.duration} min</span>}
                                </div>
                                {s.agenda && <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 8, padding: '8px 12px', background: 'rgba(201,162,75,0.04)', borderRadius: 'var(--radius-sm)', borderLeft: '2px solid var(--accent-primary)' }}>{s.agenda}</p>}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                                <span className={`badge badge-${statusColors[s.status]}`}>{s.status}</span>

                                {/* Mentor: Approve/Reject pending sessions */}
                                {user?.role === 'mentor' && s.status === 'pending' && (
                                    <>
                                        <button className="btn btn-success btn-sm" onClick={() => handleStatusUpdate(s._id, 'approved')}><FiCheck /> Approve</button>
                                        <button className="btn btn-danger btn-sm" onClick={() => handleStatusUpdate(s._id, 'rejected')}><FiX /> Reject</button>
                                    </>
                                )}

                                {/* START VIDEO CALL — once session is approved */}
                                {s.status === 'approved' && (
                                    <>
                                        <button className="btn btn-primary btn-sm" onClick={() => handleStartCall(s._id)} style={{ background: 'var(--gradient-primary)', border: 'none' }}>
                                            <FiVideo /> Start Video Call
                                        </button>
                                        <button className="btn btn-danger btn-sm" onClick={() => handleStatusUpdate(s._id, 'completed')}>
                                            <FiPhoneOff /> End Session
                                        </button>
                                    </>
                                )}

                                {/* In progress — go to call or end */}
                                {s.status === 'in-progress' && (
                                    <>
                                        <button className="btn btn-primary btn-sm" onClick={() => handleStartCall(s._id)}>
                                            <FiVideo /> Rejoin Call
                                        </button>
                                        <button className="btn btn-danger btn-sm" onClick={() => handleStatusUpdate(s._id, 'completed')}>
                                            <FiPhoneOff /> End Session
                                        </button>
                                    </>
                                )}

                                {/* Completed — rate */}
                                {s.status === 'completed' && !s.ratingGiven && (
                                    <button className="btn btn-secondary btn-sm" onClick={() => setRatingModal(s)}><FiStar /> Rate</button>
                                )}
                                {s.ratingGiven && (
                                    <span style={{ display: 'flex', gap: 2, color: 'var(--accent-warning)' }}>
                                        {'★'.repeat(s.ratingGiven)}{'☆'.repeat(5 - s.ratingGiven)}
                                    </span>
                                )}
                            </div>
                        </Reveal>
                    ))}
                </div>
            )}
            {!loading && sessions.length === 0 && <div className="empty-state"><div className="icon"><FiCalendar /></div><p>No sessions yet</p></div>}

            {ratingModal && (
                <Modal onClose={() => setRatingModal(null)}>
                        <h2>Rate Session</h2>
                        <p style={{ color: 'var(--text-muted)', marginBottom: 16 }}>How was your session with {user?.role === 'mentor' ? ratingModal.mentee?.name : ratingModal.mentor?.name}?</p>
                        <form onSubmit={handleRate}>
                            <div className="form-group">
                                <label>Rating</label>
                                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                                    {[1, 2, 3, 4, 5].map(v => (
                                        <button key={v} type="button" onClick={() => setRating(v)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 32, color: v <= rating ? 'var(--accent-warning)' : 'var(--text-muted)', transition: 'transform 0.2s' }}>★</button>
                                    ))}
                                </div>
                            </div>
                            <div className="form-group"><label>Feedback</label><textarea className="form-textarea" rows={4} value={feedback} onChange={e => setFeedback(e.target.value)} placeholder="Share your experience..." /></div>
                            <button className="btn btn-primary" style={{ width: '100%' }}>Submit Rating</button>
                        </form>
                </Modal>
            )}
        </div>
    );
};

export default Sessions;
