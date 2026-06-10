import { useState, useEffect } from 'react';
import { getDashboardAnalytics } from '../services/api';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, PieChart, Pie, Cell } from 'recharts';
import { FiTrendingUp, FiTarget, FiAward, FiBook, FiPieChart, FiAlertTriangle } from 'react-icons/fi';
import Reveal from '../components/motion/Reveal';
import PageHero from '../components/ui/PageHero';
import StatTile from '../components/ui/StatTile';
import { PageSkeleton } from '../components/ui/Skeleton';

const Analytics = () => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        getDashboardAnalytics()
            .then((res) => setData(res.data.dashboard))
            .catch(console.error)
            .finally(() => setLoading(false));
    }, []);

    if (loading) return <PageSkeleton stats={4} cards={2} />;

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
    const COLORS = ['#C9A24B', '#2E2A22'];

    return (
        <div className="page">
            <PageHero
                eyebrow="Activity"
                title="Performance Analytics"
                subtitle="See where you're strong and where to focus next."
                icon={<FiTrendingUp />}
            />

            {/* Stats */}
            <div className="grid grid-4" style={{ marginBottom: 32 }}>
                <Reveal as="div" i={0}><StatTile icon={<FiBook />} label="Resources" value={d.resourcesCompleted || 0} suffix={`/${d.totalResources || 0}`} accent="primary" /></Reveal>
                <Reveal as="div" i={1}><StatTile icon={<FiAward />} label="Mock Interviews" value={d.totalMockInterviews || 0} accent="secondary" /></Reveal>
                <Reveal as="div" i={2}><StatTile icon={<FiTrendingUp />} label="Avg Score" value={d.averageScores?.overall || 0} suffix="%" accent="success" /></Reveal>
                <Reveal as="div" i={3}><StatTile icon={<FiTarget />} label="Submissions" value={d.totalSubmissions || 0} accent="action" /></Reveal>
            </div>

            <Reveal className="grid grid-2" style={{ marginBottom: 32 }}>
                {/* Progress Pie */}
                <div className="glass-card spotlight">
                    <h3 className="card-title" style={{ marginBottom: 20 }}><FiPieChart /> Overall Progress</h3>
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
                <div className="glass-card spotlight">
                    <h3 className="card-title" style={{ marginBottom: 20 }}><FiTarget /> Skills Breakdown</h3>
                    <ResponsiveContainer width="100%" height={250}>
                        <RadarChart data={radarData}>
                            <PolarGrid stroke="var(--border-color)" />
                            <PolarAngleAxis dataKey="subject" tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} />
                            <PolarRadiusAxis tick={{ fill: 'var(--text-muted)', fontSize: 10 }} domain={[0, 100]} />
                            <Radar dataKey="score" stroke="var(--accent-primary)" fill="var(--accent-primary)" fillOpacity={0.35} />
                        </RadarChart>
                    </ResponsiveContainer>
                </div>
            </Reveal>

            {/* Topic Progress */}
            {topicData.length > 0 && (
                <Reveal as="div" className="glass-card spotlight" style={{ marginBottom: 32 }}>
                    <h3 className="card-title" style={{ marginBottom: 20 }}><FiBook /> Topic-wise Progress</h3>
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={topicData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                            <XAxis dataKey="name" tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} />
                            <YAxis tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} domain={[0, 100]} />
                            <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 8, color: 'var(--text-primary)' }} />
                            <Bar dataKey="progress" radius={[6, 6, 0, 0]}>
                                {topicData.map((_, i) => <Cell key={i} fill={i % 2 === 0 ? '#C9A24B' : '#E2682A'} />)}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </Reveal>
            )}

            {/* Weak Areas */}
            {(d.weakAreas?.length > 0 || d.scoreWeaknesses?.length > 0) && (
                <Reveal as="div" className="glass-card" style={{ borderColor: 'rgba(245, 158, 11, 0.3)' }}>
                    <h3 className="card-title" style={{ marginBottom: 16 }}><FiAlertTriangle /> Areas Needing Improvement</h3>
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
                </Reveal>
            )}
        </div>
    );
};

export default Analytics;
