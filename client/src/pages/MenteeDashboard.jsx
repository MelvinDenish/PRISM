import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { getDashboardAnalytics, getSessions, getGameHistory, getLearningPaths, getResumeDrafts, getProgress } from '../services/api';
import { FiBook, FiTrendingUp, FiAward, FiPlay, FiArrowRight, FiFileText, FiGrid, FiCalendar, FiMap, FiTarget, FiBarChart2 } from 'react-icons/fi';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, AreaChart, Area } from 'recharts';
import Reveal from '../components/motion/Reveal';
import AnimatedNumber from '../components/motion/AnimatedNumber';
import StatTile from '../components/ui/StatTile';
import { PageSkeleton } from '../components/ui/Skeleton';

const MenteeDashboard = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const reduce = useReducedMotion();
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

    if (loading) return <PageSkeleton stats={4} cards={4} />;

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
        { icon: FiPlay, title: 'Interview Game', desc: 'Start a mock interview', path: '/interview-game' },
        { icon: FiBook, title: 'Topics', desc: 'Learn by topic', path: '/topics' },
        { icon: FiFileText, title: 'Resume Builder', desc: 'Build your resume', path: '/resume-builder' },
        { icon: FiGrid, title: 'Resources', desc: 'Browse resources', path: '/resources' },
    ];

    const avgScore = games.length > 0 ? Math.round(games.reduce((s, g) => s + ((g.totalScore || 0) / (g.maxTotalScore || 600) * 100), 0) / games.length) : 0;

    return (
        <div className="page">
            {/* Hero Header */}
            <motion.div
                className="dash-hero"
                initial={reduce ? false : { opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            >
                <div className="dash-hero-row">
                    <div>
                        <p className="dash-hero-eyebrow">{greeting()}</p>
                        <h1 className="dash-hero-title">{user?.name?.split(' ')[0]}, ready to prep?</h1>
                        <p className="dash-hero-sub">
                            You've completed <strong>{completedCount}</strong> of {totalRes} resources
                            {games.length > 0 ? <> and played <strong>{games.length}</strong> interview {games.length === 1 ? 'game' : 'games'}</> : null}. Keep the momentum going.
                        </p>
                        <button className="btn btn-action" style={{ marginTop: 18 }} onClick={() => navigate('/interview-game')}>
                            <FiPlay /> Start a mock interview
                        </button>
                    </div>
                    <div className="dash-hero-ring">
                        <div className="score-ring" style={{ width: 104, height: 104, fontSize: 26, '--ring-pct': overallPct }}>
                            <span><AnimatedNumber value={overallPct} suffix="%" /></span>
                        </div>
                        <span className="dash-hero-ring-label">Overall progress</span>
                    </div>
                </div>
            </motion.div>

            {/* Quick Actions */}
            <div className="grid grid-4" style={{ marginBottom: 32 }}>
                {quickActions.map((a, idx) => (
                    <Reveal key={a.title} as="div" i={idx} className="card quick-action spotlight" onClick={() => navigate(a.path)} role="button" tabIndex={0}>
                        <span className="quick-action-icon"><a.icon /></span>
                        <div>
                            <h4 style={{ fontSize: 14, marginBottom: 2 }}>{a.title}</h4>
                            <p style={{ color: 'var(--text-muted)', fontSize: 12 }}>{a.desc}</p>
                        </div>
                        <FiArrowRight className="quick-action-arrow" />
                    </Reveal>
                ))}
            </div>

            {/* Stats Row */}
            <div className="grid grid-4" style={{ marginBottom: 32 }}>
                <Reveal as="div" i={0}><StatTile icon={<FiBook />} label="Resources Done" value={completedCount} suffix={`/${totalRes}`} pct={overallPct} accent="primary" /></Reveal>
                <Reveal as="div" i={1}><StatTile icon={<FiPlay />} label="Games Played" value={games.length} accent="secondary" /></Reveal>
                <Reveal as="div" i={2}><StatTile icon={<FiTrendingUp />} label="Avg Game Score" value={avgScore} suffix="%" accent="success" /></Reveal>
                <Reveal as="div" i={3}><StatTile icon={<FiAward />} label="Learning Paths" value={paths.length} accent="warning" /></Reveal>
            </div>

            <Reveal className="grid grid-2" style={{ marginBottom: 32 }}>
                {/* Game Performance Trend */}
                <div className="card spotlight">
                    <h3 style={{ marginBottom: 20 }} className="card-title"><FiTrendingUp /> Interview Game Trend</h3>
                    {gamePerformance.length > 0 ? (
                        <ResponsiveContainer width="100%" height={220}>
                            <AreaChart data={gamePerformance}>
                                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                                <XAxis dataKey="game" tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
                                <YAxis tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} domain={[0, 100]} />
                                <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 8, color: 'var(--text-primary)' }} />
                                <defs><linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--accent-primary)" stopOpacity={0.3} /><stop offset="100%" stopColor="var(--accent-primary)" stopOpacity={0} /></linearGradient></defs>
                                <Area type="monotone" dataKey="score" stroke="var(--accent-primary)" fill="url(#areaGrad)" strokeWidth={2} />
                            </AreaChart>
                        </ResponsiveContainer>
                    ) : <div className="empty-state"><p>Play interview games to see your trend</p></div>}
                </div>

                {/* Skills Radar */}
                <div className="card spotlight">
                    <h3 style={{ marginBottom: 20 }} className="card-title"><FiTarget /> Skills Radar</h3>
                    {games.length > 0 ? (
                        <ResponsiveContainer width="100%" height={220}>
                            <RadarChart data={radarData}>
                                <PolarGrid stroke="var(--border-color)" />
                                <PolarAngleAxis dataKey="subject" tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} />
                                <PolarRadiusAxis tick={{ fill: 'var(--text-muted)', fontSize: 10 }} />
                                <Radar dataKey="score" stroke="var(--accent-primary)" fill="var(--accent-primary)" fillOpacity={0.2} />
                            </RadarChart>
                        </ResponsiveContainer>
                    ) : <div className="empty-state"><p>Complete interviews to see your skills</p></div>}
                </div>
            </Reveal>

            <Reveal className="grid grid-2" style={{ marginBottom: 32 }}>
                {/* Topic Progress */}
                <div className="card spotlight">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                        <h3 className="card-title"><FiBarChart2 /> Topic Progress</h3>
                        <button className="btn btn-sm btn-secondary" onClick={() => navigate('/topics')}>View All <FiArrowRight /></button>
                    </div>
                    {topicData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={220}>
                            <BarChart data={topicData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                                <XAxis dataKey="name" tick={{ fill: 'var(--text-secondary)', fontSize: 10 }} angle={-20} />
                                <YAxis tick={{ fill: 'var(--text-secondary)', fontSize: 10 }} domain={[0, 100]} />
                                <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 8, color: 'var(--text-primary)' }} />
                                <Bar dataKey="progress" fill="var(--accent-primary)" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    ) : <div className="empty-state"><p>Complete resources to track progress</p></div>}
                </div>

                {/* Recent Sessions */}
                <div className="card spotlight">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                        <h3 className="card-title"><FiCalendar /> Recent Sessions</h3>
                        <button className="btn btn-sm btn-secondary" onClick={() => navigate('/sessions')}>View All <FiArrowRight /></button>
                    </div>
                    {sessions.length > 0 ? sessions.map(s => (
                        <div key={s._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid var(--border-color)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <div className="avatar-sm">{(s.mentor?.name || s.mentee?.name)?.[0]}</div>
                                <div>
                                    <div style={{ fontWeight: 600, fontSize: 14 }}>{s.mentor?.name || s.mentee?.name}</div>
                                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{new Date(s.scheduledDate).toLocaleDateString()}</div>
                                </div>
                            </div>
                            <span className={`badge badge-${s.status === 'completed' ? 'success' : s.status === 'pending' ? 'warning' : 'primary'}`} style={{ fontSize: 11 }}>{s.status}</span>
                        </div>
                    )) : <div className="empty-state"><p>No sessions yet</p></div>}
                </div>
            </Reveal>

            {/* Learning Paths & Resumes */}
            <Reveal className="grid grid-2">
                <div className="card spotlight">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                        <h3 className="card-title"><FiMap /> Learning Paths</h3>
                        <button className="btn btn-sm btn-secondary" onClick={() => navigate('/learning-paths')}>View All <FiArrowRight /></button>
                    </div>
                    {paths.length > 0 ? paths.map(p => (
                        <div key={p._id} style={{ marginBottom: 16 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, marginBottom: 4 }}><span style={{ fontWeight: 600 }}>{p.title?.slice(0, 30)}</span><span style={{ color: 'var(--accent-primary)', fontWeight: 700 }}>{p.progress}%</span></div>
                            <div className="progress-bar" style={{ height: 4 }}><div className="fill" style={{ width: `${p.progress}%` }} /></div>
                        </div>
                    )) : <div className="empty-state"><p>Create a learning path to get started</p></div>}
                </div>
                <div className="card spotlight">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                        <h3 className="card-title"><FiFileText /> Resume Drafts</h3>
                        <button className="btn btn-sm btn-secondary" onClick={() => navigate('/resume-builder')}>View All <FiArrowRight /></button>
                    </div>
                    {resumes.length > 0 ? resumes.map(r => (
                        <div key={r._id} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border-color)' }}>
                            <div><div style={{ fontWeight: 600, fontSize: 14 }}>{r.name}</div><div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{r.template} • Updated {new Date(r.updatedAt).toLocaleDateString()}</div></div>
                            <span className="badge badge-info">{r.template}</span>
                        </div>
                    )) : <div className="empty-state"><p>No resumes yet</p></div>}
                </div>
            </Reveal>
        </div>
    );
};

export default MenteeDashboard;
