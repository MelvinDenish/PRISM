import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getTopics, getResources, getProgress, completeResource, uncompleteResource } from '../services/api';
import { FiBook, FiVideo, FiFileText, FiSearch, FiCheckCircle, FiExternalLink, FiArrowLeft, FiX, FiZap } from 'react-icons/fi';

const Topics = () => {
    const [topics, setTopics] = useState([]);
    const [selectedTopic, setSelectedTopic] = useState(null);
    const [resources, setResources] = useState([]);
    const [completed, setCompleted] = useState([]);
    const [viewingResource, setViewingResource] = useState(null);
    const [summary, setSummary] = useState('');
    const [summarizing, setSummarizing] = useState(false);
    const [filter, setFilter] = useState('all');
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => { loadTopics(); loadProgress(); }, []);

    const loadTopics = async () => {
        try {
            const { data } = await getTopics();
            const resData = await getResources({});
            const resourcesByTopic = {};
            (resData.data.resources || []).forEach(r => {
                const tid = r.topic?._id || r.topic;
                resourcesByTopic[tid] = (resourcesByTopic[tid] || 0) + 1;
            });
            setTopics((data.topics || []).map(t => ({ ...t, resourceCount: resourcesByTopic[t._id] || 0 })));
        } catch (err) { console.error(err); }
        setLoading(false);
    };

    const loadProgress = async () => {
        try {
            const { data } = await getProgress();
            setCompleted((data.progress?.completedResources || []).map(id => id.toString()));
        } catch {}
    };

    const selectTopic = async (topic) => {
        setSelectedTopic(topic);
        setLoading(true);
        try {
            const { data } = await getResources({ topic: topic._id });
            setResources(data.resources || []);
        } catch (err) { console.error(err); }
        setLoading(false);
    };

    const toggleComplete = async (resourceId) => {
        try {
            if (completed.includes(resourceId)) {
                await uncompleteResource(resourceId);
                setCompleted(prev => prev.filter(id => id !== resourceId));
            } else {
                await completeResource(resourceId);
                setCompleted(prev => [...prev, resourceId]);
            }
        } catch (err) { console.error(err); }
    };

    const openResource = (resource) => {
        setViewingResource(resource);
        setSummary('');
    };

    const handleSummarize = async (resource) => {
        setSummarizing(true);
        setSummary('Open the resource to read the full article. AI summarization is planned for a future update.');
        setSummarizing(false);
    };

    const getYouTubeId = (url) => {
        const match = url?.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/))([^?&]+)/);
        return match ? match[1] : null;
    };

    const filteredResources = resources.filter(r => {
        if (filter !== 'all' && r.resourceType !== filter) return false;
        if (search && !r.title.toLowerCase().includes(search.toLowerCase())) return false;
        return true;
    });

    const topicProgress = selectedTopic ? Math.round((resources.filter(r => completed.includes(r._id)).length / Math.max(resources.length, 1)) * 100) : 0;

    const icons = { video: <FiVideo />, article: <FiFileText />, pdf: <FiBook />, link: <FiExternalLink /> };
    const topicIcons = ['📊','🗄️','🧩','💻','🌐','🏗️','🕸️','📋','🧠','☕','🐍','⚡'];

    if (viewingResource) {
        const ytId = getYouTubeId(viewingResource.link);
        return (
            <div className="resource-viewer-overlay">
                <div className="resource-viewer">
                    <div className="resource-viewer-header">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <button className="btn btn-secondary btn-sm" onClick={() => setViewingResource(null)}><FiArrowLeft /> Back</button>
                            <h3 style={{ fontSize: 16 }}>{viewingResource.title}</h3>
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                            {viewingResource.resourceType === 'article' && (
                                <button className="btn btn-primary btn-sm" onClick={() => handleSummarize(viewingResource)} disabled={summarizing}>
                                    <FiZap /> {summarizing ? 'Summarizing...' : 'AI Summary'}
                                </button>
                            )}
                            <button className={`btn btn-sm ${completed.includes(viewingResource._id) ? 'btn-success' : 'btn-secondary'}`}
                                onClick={() => toggleComplete(viewingResource._id)}>
                                <FiCheckCircle /> {completed.includes(viewingResource._id) ? 'Completed' : 'Mark Complete'}
                            </button>
                        </div>
                    </div>
                    <div className="resource-viewer-content">
                        {ytId ? (
                            <div className="video-embed-container">
                                <iframe src={`https://www.youtube.com/embed/${ytId}`} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen title={viewingResource.title}></iframe>
                            </div>
                        ) : (
                            <div style={{ padding: 20, textAlign: 'center' }}>
                                <a href={viewingResource.link} target="_blank" rel="noopener noreferrer" className="btn btn-primary btn-lg">
                                    <FiExternalLink /> Open Resource
                                </a>
                            </div>
                        )}
                        {viewingResource.description && <p style={{ color: 'var(--text-secondary)', marginTop: 16 }}>{viewingResource.description}</p>}
                        {summary && (
                            <div className="glass-card" style={{ marginTop: 20 }}>
                                <h4 style={{ color: 'var(--accent-primary)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}><FiZap /> AI Summary</h4>
                                <p style={{ whiteSpace: 'pre-wrap', lineHeight: 1.8, color: 'var(--text-secondary)' }}>{summary}</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    if (selectedTopic) {
        return (
            <div className="page">
                <div className="page-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                        <button className="btn btn-secondary" onClick={() => { setSelectedTopic(null); setResources([]); }}><FiArrowLeft /></button>
                        <div>
                            <h1 className="page-title"><span>{selectedTopic.name}</span></h1>
                            <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>{resources.length} resources • {topicProgress}% complete</p>
                        </div>
                    </div>
                </div>
                <div className="progress-bar" style={{ marginBottom: 24, height: 6 }}>
                    <div className="fill" style={{ width: `${topicProgress}%` }}></div>
                </div>
                <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: 200, position: 'relative' }}>
                        <FiSearch style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                        <input className="form-input" placeholder="Search resources..." value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: 40 }} />
                    </div>
                    {['all', 'video', 'article', 'pdf'].map(f => (
                        <button key={f} className={`btn ${filter === f ? 'btn-primary' : 'btn-secondary'} btn-sm`} onClick={() => setFilter(f)}>
                            {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}s
                        </button>
                    ))}
                </div>
                {loading ? <div className="spinner" /> : (
                    <div className="grid grid-2">
                        {filteredResources.map(r => (
                            <div key={r._id} className="glass-card" style={{ cursor: 'pointer', display: 'flex', gap: 16, alignItems: 'flex-start' }} onClick={() => openResource(r)}>
                                <div style={{ width: 44, height: 44, borderRadius: 12, background: completed.includes(r._id) ? 'rgba(52,211,153,0.12)' : 'rgba(16,185,129,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: completed.includes(r._id) ? 'var(--accent-success)' : 'var(--accent-primary)', fontSize: 20, flexShrink: 0 }}>
                                    {completed.includes(r._id) ? <FiCheckCircle /> : (icons[r.resourceType] || <FiBook />)}
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <h4 style={{ fontSize: 15, marginBottom: 4, textDecoration: completed.includes(r._id) ? 'line-through' : 'none', opacity: completed.includes(r._id) ? 0.7 : 1 }}>{r.title}</h4>
                                    <p style={{ color: 'var(--text-muted)', fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.description}</p>
                                    <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                                        <span className={`badge badge-${r.level === 'advanced' ? 'danger' : r.level === 'intermediate' ? 'warning' : 'success'}`}>{r.level}</span>
                                        <span className="badge badge-info">{r.resourceType}</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="page">
            <div className="page-header">
                <h1 className="page-title">📚 <span>Topics</span></h1>
            </div>
            {loading ? <div className="spinner" /> : (
                <div className="grid grid-3">
                    {topics.map((topic, i) => (
                        <div key={topic._id} className="glass-card" style={{ cursor: 'pointer', textAlign: 'center', padding: 32 }} onClick={() => selectTopic(topic)}>
                            <div style={{ fontSize: 48, marginBottom: 16 }}>{topicIcons[i] || '📚'}</div>
                            <h3 style={{ fontSize: 18, marginBottom: 8, fontWeight: 700 }}>{topic.name}</h3>
                            <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 16, lineHeight: 1.6 }}>{topic.description?.slice(0, 80)}...</p>
                            <div style={{ display: 'flex', justifyContent: 'center', gap: 12 }}>
                                <span className="badge badge-primary">{topic.resourceCount} resources</span>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default Topics;
