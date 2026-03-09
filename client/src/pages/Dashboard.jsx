import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { getDashboardAnalytics, getSessions, getMockInterviews } from '../services/api';
import { FiBook, FiMonitor, FiCalendar, FiTrendingUp, FiTarget, FiAward } from 'react-icons/fi';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis } from 'recharts';

const Dashboard = () => {
    const { user } = useAuth();
    const [analytics, setAnalytics] = useState(null);
    const [sessions, setSessions] = useState([]);
    const [interviews, setInterviews] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [analyticsRes, sessionsRes, interviewsRes] = await Promise.all([
                    getDashboardAnalytics().catch(() => ({ data: { dashboard: null } })),
                    getSessions().catch(() => ({ data: { sessions: [] } })),
                    getMockInterviews().catch(() => ({ data: { interviews: [] } }))
                ]);
                setAnalytics(analyticsRes.data.dashboard);
                setSessions(sessionsRes.data.sessions?.slice(0, 5) || []);
                setInterviews(interviewsRes.data.interviews?.slice(0, 5) || []);
            } catch (err) { console.error(err); }
            setLoading(false);
        };
        fetchData();
    }, []);

    if (loading) return <div className="page"><div className="spinner" /></div>;

    const stats = analytics || {};
    const topicData = stats.topicProgress?.map((t) => ({
        name: t.topic?.name || 'Unknown', progress: t.percentage || 0
    })) || [];

    const radarData = [
        { subject: 'Technical', score: stats.averageScores?.technical || 0 },
        { subject: 'Communication', score: stats.averageScores?.communication || 0 },
        { subject: 'Confidence', score: stats.averageScores?.confidence || 0 },
        { subject: 'Problem Solving', score: stats.averageScores?.problemSolving || 0 },
    ];

    return (
        <div className="page">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Welcome back, <span>{user?.name}</span></h1>
                    <p style={{ color: 'var(--text-muted)', marginTop: 4 }}>
                        {user?.role === 'mentor' ? 'Manage your sessions and guide mentees' : 'Track your preparation progress'}
                    </p>
                </div>
                <span className="badge badge-primary" style={{ fontSize: 14, padding: '8px 16px' }}>{user?.role}</span>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-4" style={{ marginBottom: 32 }}>
                <div className="stat-card">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                        <FiBook style={{ fontSize: 20, color: 'var(--accent-primary)' }} />
                        <span className="stat-label">Resources Completed</span>
                    </div>
                    <div className="stat-value">{stats.resourcesCompleted || 0}<span style={{ fontSize: 14, color: 'var(--text-muted)' }}>/{stats.totalResources || 0}</span></div>
                    <div className="progress-bar" style={{ marginTop: 8 }}>
                        <div className="fill" style={{ width: `${stats.overallProgress || 0}%` }} />
                    </div>
                </div>
                <div className="stat-card">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                        <FiMonitor style={{ fontSize: 20, color: 'var(--accent-secondary)' }} />
                        <span className="stat-label">Mock Interviews</span>
                    </div>
                    <div className="stat-value">{stats.totalMockInterviews || 0}</div>
                </div>
                <div className="stat-card">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                        <FiTrendingUp style={{ fontSize: 20, color: 'var(--accent-success)' }} />
                        <span className="stat-label">Overall Score</span>
                    </div>
                    <div className="stat-value">{stats.averageScores?.overall || 0}%</div>
                </div>
                <div className="stat-card">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                        <FiAward style={{ fontSize: 20, color: 'var(--accent-warning)' }} />
                        <span className="stat-label">Code Submissions</span>
                    </div>
                    <div className="stat-value">{stats.totalSubmissions || 0}</div>
                </div>
            </div>

            <div className="grid grid-2" style={{ marginBottom: 32 }}>
                {/* Topic Progress Chart */}
                <div className="glass-card">
                    <h3 style={{ marginBottom: 20 }}>📊 Topic Progress</h3>
                    {topicData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={250}>
                            <BarChart data={topicData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                                <XAxis dataKey="name" tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} />
                                <YAxis tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} />
                                <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 8, color: 'var(--text-primary)' }} />
                                <Bar dataKey="progress" fill="url(#barGrad)" radius={[6, 6, 0, 0]} />
                                <defs>
                                    <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#6366f1" />
                                        <stop offset="100%" stopColor="#8b5cf6" />
                                    </linearGradient>
                                </defs>
                            </BarChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="empty-state"><p>Complete resources to see your progress</p></div>
                    )}
                </div>

                {/* Skills Radar */}
                <div className="glass-card">
                    <h3 style={{ marginBottom: 20 }}>🎯 Skills Radar</h3>
                    {stats.totalMockInterviews > 0 ? (
                        <ResponsiveContainer width="100%" height={250}>
                            <RadarChart data={radarData}>
                                <PolarGrid stroke="var(--border-color)" />
                                <PolarAngleAxis dataKey="subject" tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} />
                                <PolarRadiusAxis tick={{ fill: 'var(--text-muted)', fontSize: 10 }} />
                                <Radar dataKey="score" stroke="#6366f1" fill="#6366f1" fillOpacity={0.3} />
                            </RadarChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="empty-state"><p>Take mock interviews to see your skills radar</p></div>
                    )}
                </div>
            </div>

            {/* Weak Areas */}
            {stats.weakAreas?.length > 0 && (
                <div className="glass-card" style={{ marginBottom: 32, borderColor: 'rgba(245, 158, 11, 0.3)' }}>
                    <h3 style={{ marginBottom: 16 }}>⚠️ Target Areas</h3>
                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                        {stats.weakAreas.map((w, i) => (
                            <div key={i} className="badge badge-warning" style={{ fontSize: 13, padding: '8px 16px' }}>
                                <FiTarget style={{ marginRight: 4 }} /> {w.topic} — {w.gap}% behind
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="grid grid-2">
                {/* Upcoming Sessions */}
                <div className="glass-card">
                    <h3 style={{ marginBottom: 16 }}>📅 Recent Sessions</h3>
                    {sessions.length > 0 ? sessions.map((s) => (
                        <div key={s._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid var(--border-color)' }}>
                            <div>
                                <div style={{ fontWeight: 600, fontSize: 14 }}>{s.mentor?.name || s.mentee?.name}</div>
                                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{new Date(s.scheduledDate).toLocaleDateString()}</div>
                            </div>
                            <span className={`badge badge-${s.status === 'completed' ? 'success' : s.status === 'pending' ? 'warning' : 'primary'}`}>{s.status}</span>
                        </div>
                    )) : <div className="empty-state"><p>No sessions yet</p></div>}
                </div>

                {/* Recent Interviews */}
                <div className="glass-card">
                    <h3 style={{ marginBottom: 16 }}>🎤 Recent Mock Interviews</h3>
                    {interviews.length > 0 ? interviews.map((i) => (
                        <div key={i._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid var(--border-color)' }}>
                            <div>
                                <div style={{ fontWeight: 600, fontSize: 14, textTransform: 'capitalize' }}>{i.type} Interview</div>
                                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{i.companyFocus?.name || 'General'}</div>
                            </div>
                            <span className={`badge badge-${i.status === 'completed' ? 'success' : 'info'}`}>{i.status}</span>
                        </div>
                    )) : <div className="empty-state"><p>No mock interviews yet</p></div>}
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
