import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { getSessions, updateSessionStatus } from '../services/api';
import { FiClock, FiCheckCircle, FiUsers, FiStar, FiArrowRight, FiCheck, FiX, FiCalendar } from 'react-icons/fi';
import Reveal from '../components/motion/Reveal';
import StatTile from '../components/ui/StatTile';
import { PageSkeleton } from '../components/ui/Skeleton';

const MentorDashboard = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const reduce = useReducedMotion();
    const [sessions, setSessions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [busyId, setBusyId] = useState(null);

    const load = async () => {
        try {
            const res = await getSessions();
            setSessions(res.data.sessions || []);
        } catch (err) { console.error(err); }
        setLoading(false);
    };

    useEffect(() => { load(); }, []);

    const act = async (id, status) => {
        setBusyId(id);
        try {
            await updateSessionStatus(id, { status });
            await load();
        } catch (err) { console.error(err); }
        setBusyId(null);
    };

    if (loading) return <PageSkeleton stats={4} cards={2} />;

    const greeting = () => {
        const h = new Date().getHours();
        if (h < 12) return 'Good Morning';
        if (h < 17) return 'Good Afternoon';
        return 'Good Evening';
    };

    const pending = sessions.filter(s => s.status === 'pending');
    const upcoming = sessions
        .filter(s => ['approved', 'in-progress'].includes(s.status) && new Date(s.scheduledDate) >= new Date(Date.now() - 36e5))
        .sort((a, b) => new Date(a.scheduledDate) - new Date(b.scheduledDate));
    const completed = sessions.filter(s => s.status === 'completed');
    const uniqueMentees = new Set(sessions.map(s => s.mentee?._id).filter(Boolean));
    const fmt = (d) => new Date(d).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });

    return (
        <div className="page">
            <motion.div
                className="dash-hero"
                initial={reduce ? false : { opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
                    <div>
                        <p className="dash-hero-eyebrow">{greeting()}</p>
                        <h1 className="dash-hero-title">{user?.name}</h1>
                        <p style={{ color: 'var(--text-muted)', fontSize: 15 }}>Manage your mentorship sessions and guide students</p>
                    </div>
                    <button className="btn btn-primary" onClick={() => navigate('/sessions')}>Open Session Manager <FiArrowRight /></button>
                </div>
            </motion.div>

            {/* Stats */}
            <div className="grid grid-4" style={{ marginBottom: 32 }}>
                <Reveal as="div" i={0}><StatTile icon={<FiClock />} label="Pending Requests" value={pending.length} accent="warning" /></Reveal>
                <Reveal as="div" i={1}><StatTile icon={<FiCheckCircle />} label="Upcoming Sessions" value={upcoming.length} accent="primary" /></Reveal>
                <Reveal as="div" i={2}><StatTile icon={<FiUsers />} label="Mentees" value={uniqueMentees.size} accent="secondary" /></Reveal>
                <Reveal as="div" i={3}><StatTile icon={<FiStar />} label="Rating" value={Number(user?.rating || 0)} decimals={1} sub={`${user?.totalReviews || 0} reviews`} accent="action" /></Reveal>
            </div>

            <Reveal className="grid grid-2">
                {/* Pending requests with quick approve/reject */}
                <div className="card spotlight">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                        <h3 className="card-title"><FiClock /> Pending Requests</h3>
                        <button className="btn btn-sm btn-secondary" onClick={() => navigate('/sessions')}>View All <FiArrowRight /></button>
                    </div>
                    {pending.length > 0 ? pending.slice(0, 5).map(s => (
                        <div key={s._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: '12px 0', borderBottom: '1px solid var(--border-color)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                                <div className="avatar-sm">{s.mentee?.name?.[0]}</div>
                                <div style={{ minWidth: 0 }}>
                                    <div style={{ fontWeight: 600, fontSize: 14 }}>{s.mentee?.name}</div>
                                    <div style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{fmt(s.scheduledDate)} • {s.agenda}</div>
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                                <button className="btn btn-sm btn-primary" disabled={busyId === s._id} onClick={() => act(s._id, 'approved')} title="Approve"><FiCheck /></button>
                                <button className="btn btn-sm btn-secondary" disabled={busyId === s._id} onClick={() => act(s._id, 'rejected')} title="Reject"><FiX /></button>
                            </div>
                        </div>
                    )) : <div className="empty-state"><p>No pending requests 🎉</p></div>}
                </div>

                {/* Upcoming approved sessions */}
                <div className="card spotlight">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                        <h3 className="card-title"><FiCalendar /> Upcoming Sessions</h3>
                        <button className="btn btn-sm btn-secondary" onClick={() => navigate('/sessions')}>View All <FiArrowRight /></button>
                    </div>
                    {upcoming.length > 0 ? upcoming.slice(0, 5).map(s => (
                        <div key={s._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid var(--border-color)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <div className="avatar-sm">{s.mentee?.name?.[0]}</div>
                                <div>
                                    <div style={{ fontWeight: 600, fontSize: 14 }}>{s.mentee?.name}</div>
                                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{fmt(s.scheduledDate)} • {s.duration} min</div>
                                </div>
                            </div>
                            <button className="btn btn-sm btn-primary" onClick={() => navigate(`/video-call/${s._id}`)}>Join</button>
                        </div>
                    )) : <div className="empty-state"><p>No upcoming sessions</p></div>}
                </div>
            </Reveal>

            {/* Recent mentees */}
            <Reveal as="div" className="card spotlight" style={{ marginTop: 32 }}>
                <h3 style={{ marginBottom: 20 }} className="card-title"><FiUsers /> Your Mentees</h3>
                {uniqueMentees.size > 0 ? (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                        {[...new Map(sessions.filter(s => s.mentee).map(s => [s.mentee._id, s.mentee])).values()].slice(0, 12).map(m => (
                            <div key={m._id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)' }}>
                                <div className="avatar-sm" style={{ width: 28, height: 28, fontSize: 12 }}>{m.name?.[0]}</div>
                                <div>
                                    <div style={{ fontWeight: 600, fontSize: 13 }}>{m.name}</div>
                                    {m.aimingCompany && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>🎯 {m.aimingCompany}</div>}
                                </div>
                            </div>
                        ))}
                    </div>
                ) : <div className="empty-state"><p>No mentees yet — approved sessions will show your mentees here.</p></div>}
                <p style={{ marginTop: 16, fontSize: 12, color: 'var(--text-muted)' }}>{completed.length} completed session{completed.length === 1 ? '' : 's'} so far.</p>
            </Reveal>
        </div>
    );
};

export default MentorDashboard;
