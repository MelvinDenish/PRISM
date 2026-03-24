import { useState, useEffect } from 'react';
import { getTopics, getLearningPaths, generateLearningPath, updatePathProgress, deleteLearningPath } from '../services/api';
import { FiMap, FiPlus, FiTrash2, FiCheckCircle, FiCircle, FiArrowLeft, FiZap, FiExternalLink } from 'react-icons/fi';

const LearningPaths = () => {
    const [paths, setPaths] = useState([]);
    const [topics, setTopics] = useState([]);
    const [selectedPath, setSelectedPath] = useState(null);
    const [creating, setCreating] = useState(false);
    const [newPath, setNewPath] = useState({ topicId: '', level: 'beginner' });
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);

    useEffect(() => { loadData(); }, []);

    const loadData = async () => {
        try {
            const [pathsRes, topicsRes] = await Promise.all([getLearningPaths(), getTopics()]);
            setPaths(pathsRes.data.paths || []);
            setTopics(topicsRes.data.topics || []);
        } catch {}
        setLoading(false);
    };

    const createPath = async () => {
        if (!newPath.topicId) return;
        setGenerating(true);
        try {
            const { data } = await generateLearningPath(newPath);
            setPaths(prev => [data.path, ...prev]);
            setCreating(false);
            setSelectedPath(data.path);
        } catch (err) { console.error(err); }
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

    return (
        <div className="page">
            <div className="page-header">
                <h1 className="page-title">🗺️ <span>Learning Paths</span></h1>
                <button className="btn btn-primary" onClick={() => setCreating(true)}><FiPlus /> New Path</button>
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
                                {topics.map(t => <option key={t._id} value={t._id}>{t.name}</option>)}
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
