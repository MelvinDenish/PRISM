import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getMockInterviews, createMockInterview, joinMockInterview, getTopics } from '../services/api';
import { FiPlus, FiMonitor, FiUsers, FiMessageSquare, FiX } from 'react-icons/fi';

const MockInterviews = () => {
    const { user } = useAuth();
    const [interviews, setInterviews] = useState([]);
    const [topics, setTopics] = useState([]);
    const [filter, setFilter] = useState('');
    const [showCreate, setShowCreate] = useState(false);
    const [form, setForm] = useState({ type: 'technical', scheduledDate: '', duration: 60 });
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => { fetchData(); }, [filter]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [iRes, tRes] = await Promise.all([
                getMockInterviews(filter ? { type: filter } : {}),
                getTopics()
            ]);
            setInterviews(iRes.data.interviews || []);
            setTopics(tRes.data.topics || []);
        } catch (err) { console.error(err); }
        setLoading(false);
    };

    const handleCreate = async (e) => {
        e.preventDefault();
        try {
            const res = await createMockInterview(form);
            setShowCreate(false);
            fetchData();
            navigate(`/interview/${res.data.interview._id}`);
        } catch (err) { console.error(err); }
    };

    const handleJoin = async (id) => {
        try {
            await joinMockInterview(id);
            navigate(`/interview/${id}`);
        } catch (err) { console.error(err); }
    };

    const typeIcons = { technical: <FiMonitor />, hr: <FiUsers />, gd: <FiMessageSquare /> };
    const typeColors = { technical: 'badge-primary', hr: 'badge-success', gd: 'badge-warning' };

    return (
        <div className="page">
            <div className="page-header">
                <h1 className="page-title">🎤 <span>Mock Interviews</span></h1>
                {(user?.role === 'mentor' || user?.role === 'admin') && (
                    <button className="btn btn-primary" onClick={() => setShowCreate(true)}><FiPlus /> Create Interview</button>
                )}
            </div>

            <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
                {['', 'technical', 'hr', 'gd'].map((t) => (
                    <button key={t} className={`btn btn-sm ${filter === t ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setFilter(t)}>
                        {t === '' ? 'All' : t.toUpperCase()}
                    </button>
                ))}
            </div>

            {loading ? <div className="spinner" /> : (
                <div className="grid grid-3">
                    {interviews.map((i) => (
                        <div key={i._id} className="glass-card">
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                                <span className={`badge ${typeColors[i.type]}`}>{typeIcons[i.type]} {i.type}</span>
                                <span className={`badge badge-${i.status === 'completed' ? 'success' : i.status === 'ongoing' ? 'warning' : 'info'}`}>{i.status}</span>
                            </div>
                            <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8, textTransform: 'capitalize' }}>{i.type} Mock Interview</h3>
                            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 4 }}>
                                {i.companyFocus?.name && <span>📍 {i.companyFocus.name}</span>}
                            </div>
                            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 4 }}>
                                👤 Host: {i.mentor?.name || 'TBD'}
                            </div>
                            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>
                                👥 Participants: {i.participants?.length || 0}
                            </div>
                            {i.scheduledDate && (
                                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
                                    📅 {new Date(i.scheduledDate).toLocaleString()}
                                </div>
                            )}
                            <div style={{ display: 'flex', gap: 8 }}>
                                {i.status !== 'completed' && (
                                    <button className="btn btn-primary btn-sm" style={{ flex: 1 }} onClick={() => handleJoin(i._id)}>
                                        Join
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
            {!loading && interviews.length === 0 && <div className="empty-state"><div className="icon">🎤</div><p>No mock interviews available</p></div>}

            {showCreate && (
                <div className="modal-overlay" onClick={() => setShowCreate(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}><h2>Create Mock Interview</h2><button style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 20 }} onClick={() => setShowCreate(false)}><FiX /></button></div>
                        <form onSubmit={handleCreate}>
                            <div className="form-group"><label>Type</label><select className="form-select" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}><option value="technical">Technical</option><option value="hr">HR</option><option value="gd">Group Discussion</option></select></div>
                            <div className="form-group"><label>Schedule</label><input className="form-input" type="datetime-local" value={form.scheduledDate} onChange={(e) => setForm({ ...form, scheduledDate: e.target.value })} /></div>
                            <div className="form-group"><label>Duration (minutes)</label><input className="form-input" type="number" value={form.duration} onChange={(e) => setForm({ ...form, duration: parseInt(e.target.value) })} /></div>
                            <button className="btn btn-primary" style={{ width: '100%' }}>Create</button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MockInterviews;
