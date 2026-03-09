import { useState, useEffect } from 'react';
import { getDashboardAnalytics } from '../services/api';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, PieChart, Pie, Cell } from 'recharts';
import { FiTrendingUp, FiTarget, FiAward, FiBook } from 'react-icons/fi';

const Analytics = () => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        getDashboardAnalytics()
            .then((res) => setData(res.data.dashboard))
            .catch(console.error)
            .finally(() => setLoading(false));
    }, []);

    if (loading) return <div className="page"><div className="spinner" /></div>;

    const d = data || {};
    const topicData = d.topicProgress?.map((t) => ({ name: t.topic?.name || 'Unknown', progress: t.percentage || 0 })) || [];
    const radarData = [
        { subject: 'Technical', score: d.averageScores?.technical || 0 },
        { subject: 'Communication', score: d.averageScores?.communication || 0 },
        { subject: 'Confidence', score: d.averageScores?.confidence || 0 },
        { subject: 'Problem Solving', score: d.averageScores?.problemSolving || 0 },
    ];
    const pieData = [
        { name: 'Completed', value: d.resourcesCompleted || 0 },
        { name: 'Remaining', value: (d.totalResources || 0) - (d.resourcesCompleted || 0) },
    ];
    const COLORS = ['#6366f1', '#1e2538'];

    return (
        <div className="page">
            <div className="page-header">
                <h1 className="page-title">📊 <span>Performance Analytics</span></h1>
            </div>

            {/* Stats */}
            <div className="grid grid-4" style={{ marginBottom: 32 }}>
                <div className="stat-card"><div className="stat-label"><FiBook style={{ marginRight: 4 }} /> Resources</div><div className="stat-value">{d.resourcesCompleted || 0}/{d.totalResources || 0}</div></div>
                <div className="stat-card"><div className="stat-label"><FiAward style={{ marginRight: 4 }} /> Mock Interviews</div><div className="stat-value">{d.totalMockInterviews || 0}</div></div>
                <div className="stat-card"><div className="stat-label"><FiTrendingUp style={{ marginRight: 4 }} /> Avg Score</div><div className="stat-value">{d.averageScores?.overall || 0}%</div></div>
                <div className="stat-card"><div className="stat-label"><FiTarget style={{ marginRight: 4 }} /> Submissions</div><div className="stat-value">{d.totalSubmissions || 0}</div></div>
            </div>

            <div className="grid grid-2" style={{ marginBottom: 32 }}>
                {/* Progress Pie */}
                <div className="glass-card">
                    <h3 style={{ marginBottom: 20 }}>📈 Overall Progress</h3>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <ResponsiveContainer width="100%" height={250}>
                            <PieChart>
                                <Pie data={pieData} innerRadius={60} outerRadius={100} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                                    {pieData.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
                                </Pie>
                                <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 8, color: 'var(--text-primary)' }} />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Skills Radar */}
                <div className="glass-card">
                    <h3 style={{ marginBottom: 20 }}>🎯 Skills Breakdown</h3>
                    <ResponsiveContainer width="100%" height={250}>
                        <RadarChart data={radarData}>
                            <PolarGrid stroke="var(--border-color)" />
                            <PolarAngleAxis dataKey="subject" tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} />
                            <PolarRadiusAxis tick={{ fill: 'var(--text-muted)', fontSize: 10 }} domain={[0, 100]} />
                            <Radar dataKey="score" stroke="#6366f1" fill="#6366f1" fillOpacity={0.4} />
                        </RadarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Topic Progress */}
            {topicData.length > 0 && (
                <div className="glass-card" style={{ marginBottom: 32 }}>
                    <h3 style={{ marginBottom: 20 }}>📚 Topic-wise Progress</h3>
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={topicData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                            <XAxis dataKey="name" tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} />
                            <YAxis tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} domain={[0, 100]} />
                            <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 8, color: 'var(--text-primary)' }} />
                            <Bar dataKey="progress" radius={[6, 6, 0, 0]}>
                                {topicData.map((_, i) => <Cell key={i} fill={i % 2 === 0 ? '#6366f1' : '#8b5cf6'} />)}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            )}

            {/* Weak Areas */}
            {(d.weakAreas?.length > 0 || d.scoreWeaknesses?.length > 0) && (
                <div className="glass-card" style={{ borderColor: 'rgba(245, 158, 11, 0.3)' }}>
                    <h3 style={{ marginBottom: 16 }}>⚠️ Areas Needing Improvement</h3>
                    <div className="grid grid-2">
                        {d.weakAreas?.map((w, i) => (
                            <div key={i} className="stat-card" style={{ borderColor: 'rgba(245, 158, 11, 0.2)' }}>
                                <div className="stat-label">{w.topic}</div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div className="stat-value" style={{ fontSize: 20 }}>{w.percentage}%</div>
                                    <span className="badge badge-warning">{w.gap}% behind</span>
                                </div>
                                <div className="progress-bar" style={{ marginTop: 8 }}>
                                    <div className="fill" style={{ width: `${w.percentage}%`, background: 'var(--accent-warning)' }} />
                                </div>
                            </div>
                        ))}
                        {d.scoreWeaknesses?.map((s, i) => (
                            <div key={`s${i}`} className="stat-card" style={{ borderColor: 'rgba(239, 68, 68, 0.2)' }}>
                                <div className="stat-label">{s.area}</div>
                                <div className="stat-value" style={{ fontSize: 20 }}>{s.score}%</div>
                                <span className="badge badge-danger" style={{ marginTop: 8 }}>Needs Focus</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default Analytics;
