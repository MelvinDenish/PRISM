import { useState, useEffect } from 'react';
import { getTopics, getResources, getLearningPaths, generateLearningPath, updatePathProgress, deleteLearningPath } from '../services/api';
import { FiMap, FiPlus, FiTrash2, FiCheckCircle, FiCircle, FiArrowLeft, FiZap, FiExternalLink, FiAlertCircle } from 'react-icons/fi';

const LearningPaths = () => {
    const [paths, setPaths] = useState([]);
    const [topics, setTopics] = useState([]);
    const [topicResourceCounts, setTopicResourceCounts] = useState({});
    const [selectedPath, setSelectedPath] = useState(null);
    const [creating, setCreating] = useState(false);
    const [newPath, setNewPath] = useState({ topicId: '', level: 'beginner' });
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);
    const [generateError, setGenerateError] = useState('');

    useEffect(() => { loadData(); }, []);

    const loadData = async () => {
        try {
            const [pathsRes, topicsRes, resourcesRes] = await Promise.all([
                getLearningPaths(), getTopics(), getResources()
            ]);
            setPaths(pathsRes.data.paths || []);
            const topicList = topicsRes.data.topics || [];
            setTopics(topicList);

            // Count resources per topic
            const resources = resourcesRes.data.resources || [];
            const counts = {};
            resources.forEach(r => {
                const tid = typeof r.topic === 'object' ? r.topic?._id : r.topic;
                if (tid) counts[tid] = (counts[tid] || 0) + 1;
            });
            setTopicResourceCounts(counts);
        } catch {}
        setLoading(false);
    };

    const createPath = async () => {
        if (!newPath.topicId) return;
        setGenerating(true);
        setGenerateError('');
        try {
            const { data } = await generateLearningPath(newPath);
            setPaths(prev => [data.path, ...prev]);
            setCreating(false);
            setSelectedPath(data.path);
        } catch (err) {
            const msg = err.response?.data?.message || 'Failed to generate path. Check that GROQ_API_KEY is configured on the server.';
            setGenerateError(msg);
        }
        setGenerating(false);
    };

    const toggleStep = async (pathId, stepIndex, completed) => {
        try {
            const { data } = await updatePathProgress(pathId, { stepIndex, completed: !completed });
            setSelectedPath(data.path);
            setPaths(prev => prev.map(p => p._id === pathId ? data.path : p));
        } catch {}
    };

    const removePath = async (id) => {
        try { await deleteLearningPath(id); setPaths(prev => prev.filter(p => p._id !== id)); } catch {}
    };

    if (selectedPath) {
        return (
            <div className="page">
                <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', marginBottom: 24 }}>
                    <button className="btn btn-secondary btn-sm" onClick={() => setSelectedPath(null)}><FiArrowLeft /></button>
                    <div style={{ flex: 1 }}>
                        <h1 className="page-title"><span>{selectedPath.title}</span></h1>
                        <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>{selectedPath.description} • {selectedPath.completedSteps}/{selectedPath.totalSteps} completed</p>
                    </div>
                    <span className="badge badge-primary" style={{ fontSize: 16, padding: '8px 16px' }}>{selectedPath.progress}%</span>
                </div>
                <div className="progress-bar" style={{ marginBottom: 32, height: 6 }}>
                    <div className="fill" style={{ width: `${selectedPath.progress}%` }}></div>
                </div>
                <div className="path-timeline">
                    {(selectedPath.steps || []).map((step, i) => (
                        <div key={i} className={`path-step ${step.completed ? 'completed' : i === (selectedPath.steps?.findIndex(s => !s.completed) ?? 0) ? 'active' : ''}`}>
                            <div className="glass-card" style={{ display: 'flex', gap: 16, alignItems: 'flex-start', padding: 20 }}>
                                <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: step.completed ? 'var(--accent-success)' : 'var(--text-muted)', fontSize: 22, marginTop: 2, flexShrink: 0 }}
                                    onClick={() => toggleStep(selectedPath._id, i, step.completed)}>
                                    {step.completed ? <FiCheckCircle /> : <FiCircle />}
                                </button>
                                <div style={{ flex: 1 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                        <div>
                                            <p style={{ color: 'var(--text-muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 2 }}>Step {step.order || i + 1}</p>
                                            <h4 style={{ fontSize: 15, textDecoration: step.completed ? 'line-through' : 'none', opacity: step.completed ? 0.7 : 1 }}>{step.title || step.resourceTitle}</h4>
                                        </div>
                                        {step.estimatedTime && <span className="badge badge-info" style={{ flexShrink: 0 }}>{step.estimatedTime}</span>}
                                    </div>
                                    {step.description && <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 6 }}>{step.description}</p>}
                                    {step.resourceLink && (
                                        <a href={step.resourceLink} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--accent-primary)', fontSize: 13, marginTop: 8, textDecoration: 'none' }}>
                                            <FiExternalLink /> Open Resource
                                        </a>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    // Sort topics: ones with resources first
    const sortedTopics = [...topics].sort((a, b) => {
        const ca = topicResourceCounts[a._id] || 0;
        const cb = topicResourceCounts[b._id] || 0;
        return cb - ca;
    });

    return (
        <div className="page">
            <div className="page-header">
                <h1 className="page-title">🗺️ <span>Learning Paths</span></h1>
                <button className="btn btn-primary" onClick={() => { setCreating(true); setGenerateError(''); }}><FiPlus /> New Path</button>
            </div>

            {creating && (
                <div className="modal-overlay" onClick={() => setCreating(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <h2>🗺️ Create Learning Path</h2>
                        <p style={{ color: 'var(--text-muted)', marginBottom: 20 }}>AI will generate a personalized learning roadmap based on your level.</p>
                        <div className="form-group">
                            <label>Select Topic</label>
                            <select className="form-select" value={newPath.topicId} onChange={e => setNewPath(prev => ({ ...prev, topicId: e.target.value }))}>
                                <option value="">Choose a topic...</option>
                                {sortedTopics.map(t => {
                                    const count = topicResourceCounts[t._id] || 0;
                                    return (
                                        <option key={t._id} value={t._id} disabled={count === 0}>
                                            {t.name} {count > 0 ? `(${count} resources)` : '— no resources yet'}
                                        </option>
                                    );
                                })}
                            </select>
                        </div>
                        <div className="form-group">
                            <label>Your Current Level</label>
                            <select className="form-select" value={newPath.level} onChange={e => setNewPath(prev => ({ ...prev, level: e.target.value }))}>
                                <option value="beginner">Beginner</option>
                                <option value="intermediate">Intermediate</option>
                                <option value="advanced">Advanced</option>
                            </select>
                        </div>
                        {generateError && (
                            <div style={{ padding: '10px 14px', background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.25)', borderRadius: 'var(--radius-sm)', color: 'var(--accent-danger)', fontSize: 13, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                                <FiAlertCircle /> {generateError}
                            </div>
                        )}
                        <button className="btn btn-primary btn-lg" style={{ width: '100%' }} onClick={createPath} disabled={generating || !newPath.topicId}>
                            <FiZap /> {generating ? 'AI is generating your path...' : 'Generate Path'}
                        </button>
                    </div>
                </div>
            )}

            {loading ? <div className="spinner" /> : paths.length === 0 ? (
                <div className="empty-state"><div className="icon">🗺️</div><p>No learning paths yet. Create one to get a personalized roadmap!</p></div>
            ) : (
                <div className="grid grid-2">
                    {paths.map(path => (
                        <div key={path._id} className="glass-card" style={{ cursor: 'pointer' }} onClick={() => setSelectedPath(path)}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                                <div>
                                    <h3 style={{ fontSize: 16, marginBottom: 4 }}>{path.title}</h3>
                                    <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>{path.topic?.name || 'Topic'} • {path.level}</p>
                                </div>
                                <button className="btn btn-sm" style={{ background: 'none', color: 'var(--accent-danger)' }} onClick={e => { e.stopPropagation(); removePath(path._id); }}><FiTrash2 /></button>
                            </div>
                            <div className="progress-bar" style={{ marginBottom: 8, height: 6 }}>
                                <div className="fill" style={{ width: `${path.progress}%` }}></div>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-muted)' }}>
                                <span>{path.completedSteps}/{path.totalSteps} completed</span>
                                <span style={{ color: 'var(--accent-primary)', fontWeight: 700 }}>{path.progress}%</span>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default LearningPaths;
