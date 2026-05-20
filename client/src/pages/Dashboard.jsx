import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getDashboardAnalytics, getSessions, getGameHistory, getLearningPaths, getResumeDrafts, getProgress } from '../services/api';
import { FiBook, FiCalendar, FiTrendingUp, FiAward, FiPlay, FiMap, FiFileText, FiCpu, FiArrowRight } from 'react-icons/fi';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, AreaChart, Area } from 'recharts';

const Dashboard = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [analytics, setAnalytics] = useState(null);
    const [sessions, setSessions] = useState([]);
    const [games, setGames] = useState([]);
    const [paths, setPaths] = useState([]);
    const [resumes, setResumes] = useState([]);
    const [progress, setProgress] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [analyticsRes, sessionsRes, gamesRes, pathsRes, resumesRes, progressRes] = await Promise.all([
                    getDashboardAnalytics().catch(() => ({ data: { dashboard: null } })),
                    getSessions().catch(() => ({ data: { sessions: [] } })),
                    getGameHistory().catch(() => ({ data: { games: [] } })),
                    getLearningPaths().catch(() => ({ data: { paths: [] } })),
                    getResumeDrafts().catch(() => ({ data: { drafts: [] } })),
                    getProgress().catch(() => ({ data: { progress: null } }))
                ]);
                setAnalytics(analyticsRes.data.dashboard);
                setSessions(sessionsRes.data.sessions?.slice(0, 5) || []);
                setGames(gamesRes.data.games?.slice(0, 10) || []);
                setPaths(pathsRes.data.paths?.slice(0, 3) || []);
                setResumes(resumesRes.data.drafts?.slice(0, 3) || []);
                setProgress(progressRes.data.progress);
            } catch (err) { console.error(err); }
            setLoading(false);
        };
        fetchData();
    }, []);

    if (loading) return <div className="page"><div className="spinner" /></div>;

    const stats = analytics || {};
    const completedCount = progress?.completedResources?.length || stats.resourcesCompleted || 0;
    const totalRes = stats.totalResources || 0;
    const overallPct = totalRes > 0 ? Math.round((completedCount / totalRes) * 100) : 0;

    const topicData = stats.topicProgress?.map(t => ({ name: (t.topic?.name || 'Unknown').split(' ')[0], progress: t.percentage || 0 })) || [];

    const radarData = [
        { subject: 'Technical', score: stats.averageScores?.technical || 0 },
        { subject: 'Communication', score: stats.averageScores?.communication || 0 },
        { subject: 'Confidence', score: stats.averageScores?.confidence || 0 },
        { subject: 'Problem Solving', score: stats.averageScores?.problemSolving || 0 },
    ];

    // Game performance over time
    const gamePerformance = games.map((g, i) => ({
        game: `#${games.length - i}`,
        score: g.totalScore ? Math.round((g.totalScore / (g.maxTotalScore || 600)) * 100) : 0
    })).reverse();

    const greeting = () => {
        const h = new Date().getHours();
        if (h < 12) return 'Good Morning';
        if (h < 17) return 'Good Afternoon';
        return 'Good Evening';
    };

    const quickActions = [
        { icon: '🎮', title: 'Interview Game', desc: 'Start a mock interview', path: '/interview-game', color: '#10b981' },
        { icon: '📚', title: 'Topics', desc: 'Learn by topic', path: '/topics', color: '#8b5cf6' },
        { icon: '📄', title: 'Resume Builder', desc: 'Build your resume', path: '/resume-builder', color: '#f59e0b' },
        { icon: '📊', title: 'Resources', desc: 'Browse resources', path: '/resources', color: '#06b6d4' },
    ];

    return (
        <div className="page">
            {/* Hero Header */}
            <div style={{ background: 'linear-gradient(135deg, rgba(16,185,129,0.08), rgba(6,182,212,0.06))', borderRadius: 'var(--radius-lg)', padding: '32px 40px', marginBottom: 32, border: '1px solid rgba(16,185,129,0.1)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <p style={{ color: 'var(--accent-primary)', fontSize: 14, fontWeight: 600, marginBottom: 4 }}>{greeting()} 👋</p>
                        <h1 style={{ fontSize: 32, fontWeight: 800, marginBottom: 8, background: 'var(--gradient-primary)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>{user?.name}</h1>
                        <p style={{ color: 'var(--text-muted)', fontSize: 15 }}>
                            {user?.role === 'mentor' ? 'Manage your mentorship sessions and guide students' : 'Your preparation journey at a glance'}
                        </p>
                    </div>
                    <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                        <div className="score-ring" style={{ width: 100, height: 100, fontSize: 24, borderColor: overallPct > 50 ? 'var(--accent-success)' : 'var(--accent-warning)' }}>
                            <span style={{ background: 'var(--gradient-primary)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>{overallPct}%</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Quick Actions */}
            <div className="grid grid-4" style={{ marginBottom: 32 }}>
                {quickActions.map(a => (
                    <div key={a.title} className="glass-card" style={{ cursor: 'pointer', textAlign: 'center', padding: 24, transition: 'all 0.3s' }} onClick={() => navigate(a.path)}>
                        <div style={{ fontSize: 36, marginBottom: 8 }}>{a.icon}</div>
                        <h4 style={{ fontSize: 14, marginBottom: 4 }}>{a.title}</h4>
                        <p style={{ color: 'var(--text-muted)', fontSize: 12 }}>{a.desc}</p>
                    </div>
                ))}
            </div>

            {/* Stats Row */}
            <div className="grid grid-4" style={{ marginBottom: 32 }}>
                <div className="stat-card">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}><FiBook style={{ fontSize: 20, color: 'var(--accent-primary)' }} /><span className="stat-label">Resources Done</span></div>
                    <div className="stat-value">{completedCount}<span style={{ fontSize: 14, color: 'var(--text-muted)' }}>/{totalRes}</span></div>
                    <div className="progress-bar" style={{ marginTop: 8 }}><div className="fill" style={{ width: `${overallPct}%` }} /></div>
                </div>
                <div className="stat-card">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}><FiPlay style={{ fontSize: 20, color: 'var(--accent-secondary)' }} /><span className="stat-label">Games Played</span></div>
                    <div className="stat-value">{games.length}</div>
                </div>
                <div className="stat-card">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}><FiTrendingUp style={{ fontSize: 20, color: 'var(--accent-success)' }} /><span className="stat-label">Avg Game Score</span></div>
                    <div className="stat-value">{games.length > 0 ? Math.round(games.reduce((s, g) => s + ((g.totalScore || 0) / (g.maxTotalScore || 600) * 100), 0) / games.length) : 0}%</div>
                </div>
                <div className="stat-card">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}><FiAward style={{ fontSize: 20, color: 'var(--accent-warning)' }} /><span className="stat-label">Learning Paths</span></div>
                    <div className="stat-value">{paths.length}</div>
                </div>
            </div>

            <div className="grid grid-2" style={{ marginBottom: 32 }}>
                {/* Game Performance Trend */}
                <div className="glass-card">
                    <h3 style={{ marginBottom: 20 }}>📈 Interview Game Trend</h3>
                    {gamePerformance.length > 0 ? (
                        <ResponsiveContainer width="100%" height={220}>
                            <AreaChart data={gamePerformance}>
                                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                                <XAxis dataKey="game" tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
                                <YAxis tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} domain={[0, 100]} />
                                <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 8, color: 'var(--text-primary)' }} />
                                <defs><linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#10b981" stopOpacity={0.3} /><stop offset="100%" stopColor="#10b981" stopOpacity={0} /></linearGradient></defs>
                                <Area type="monotone" dataKey="score" stroke="#10b981" fill="url(#areaGrad)" strokeWidth={2} />
                            </AreaChart>
                        </ResponsiveContainer>
                    ) : <div className="empty-state"><p>Play interview games to see your trend</p></div>}
                </div>

                {/* Skills Radar */}
                <div className="glass-card">
                    <h3 style={{ marginBottom: 20 }}>🎯 Skills Radar</h3>
                    {games.length > 0 ? (
                        <ResponsiveContainer width="100%" height={220}>
                            <RadarChart data={radarData}>
                                <PolarGrid stroke="var(--border-color)" />
                                <PolarAngleAxis dataKey="subject" tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} />
                                <PolarRadiusAxis tick={{ fill: 'var(--text-muted)', fontSize: 10 }} />
                                <Radar dataKey="score" stroke="#10b981" fill="#10b981" fillOpacity={0.2} />
                            </RadarChart>
                        </ResponsiveContainer>
                    ) : <div className="empty-state"><p>Complete interviews to see your skills</p></div>}
                </div>
            </div>

            <div className="grid grid-2" style={{ marginBottom: 32 }}>
                {/* Topic Progress */}
                <div className="glass-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                        <h3>📊 Topic Progress</h3>
                        <button className="btn btn-sm btn-secondary" onClick={() => navigate('/topics')}>View All <FiArrowRight /></button>
                    </div>
                    {topicData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={220}>
                            <BarChart data={topicData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                                <XAxis dataKey="name" tick={{ fill: 'var(--text-secondary)', fontSize: 10 }} angle={-20} />
                                <YAxis tick={{ fill: 'var(--text-secondary)', fontSize: 10 }} domain={[0, 100]} />
                                <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 8, color: 'var(--text-primary)' }} />
                                <defs><linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#10b981" /><stop offset="100%" stopColor="#06b6d4" /></linearGradient></defs>
                                <Bar dataKey="progress" fill="url(#barGrad)" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    ) : <div className="empty-state"><p>Complete resources to track progress</p></div>}
                </div>

                {/* Upcoming Sessions */}
                <div className="glass-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                        <h3>📅 Recent Sessions</h3>
                        <button className="btn btn-sm btn-secondary" onClick={() => navigate('/sessions')}>View All <FiArrowRight /></button>
                    </div>
                    {sessions.length > 0 ? sessions.map(s => (
                        <div key={s._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid var(--border-color)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--gradient-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: 'white', fontSize: 14 }}>
                                    {(s.mentor?.name || s.mentee?.name)?.[0]}
                                </div>
                                <div>
                                    <div style={{ fontWeight: 600, fontSize: 14 }}>{s.mentor?.name || s.mentee?.name}</div>
                                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{new Date(s.scheduledDate).toLocaleDateString()}</div>
                                </div>
                            </div>
                            <span className={`badge badge-${s.status === 'completed' ? 'success' : s.status === 'pending' ? 'warning' : 'primary'}`} style={{ fontSize: 11 }}>{s.status}</span>
                        </div>
                    )) : <div className="empty-state"><p>No sessions yet</p></div>}
                </div>
            </div>

            {/* Learning Paths & Resumes */}
            <div className="grid grid-2">
                <div className="glass-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                        <h3>🗺️ Learning Paths</h3>
                        <button className="btn btn-sm btn-secondary" onClick={() => navigate('/learning-paths')}>View All <FiArrowRight /></button>
                    </div>
                    {paths.length > 0 ? paths.map(p => (
                        <div key={p._id} style={{ marginBottom: 16 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, marginBottom: 4 }}><span style={{ fontWeight: 600 }}>{p.title?.slice(0, 30)}</span><span style={{ color: 'var(--accent-primary)', fontWeight: 700 }}>{p.progress}%</span></div>
                            <div className="progress-bar" style={{ height: 4 }}><div className="fill" style={{ width: `${p.progress}%` }} /></div>
                        </div>
                    )) : <div className="empty-state"><p>Create a learning path to get started</p></div>}
                </div>
                <div className="glass-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                        <h3>📄 Resume Drafts</h3>
                        <button className="btn btn-sm btn-secondary" onClick={() => navigate('/resume-builder')}>View All <FiArrowRight /></button>
                    </div>
                    {resumes.length > 0 ? resumes.map(r => (
                        <div key={r._id} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border-color)' }}>
                            <div><div style={{ fontWeight: 600, fontSize: 14 }}>{r.name}</div><div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{r.template} • Updated {new Date(r.updatedAt).toLocaleDateString()}</div></div>
                            <span className="badge badge-info">{r.template}</span>
                        </div>
                    )) : <div className="empty-state"><p>No resumes yet</p></div>}
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
