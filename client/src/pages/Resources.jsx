import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { getResources, getTopics, completeResource, uncompleteResource, getProgress, createResource, summarizeArticle } from '../services/api';
import { FiSearch, FiFilter, FiPlay, FiExternalLink, FiCheckCircle, FiPlus, FiX, FiBook, FiFileText, FiZap, FiChevronDown, FiChevronUp } from 'react-icons/fi';

const Resources = () => {
    const { user } = useAuth();
    const [resources, setResources] = useState([]);
    const [topics, setTopics] = useState([]);
    const [completed, setCompleted] = useState([]);
    const [filters, setFilters] = useState({ topic: '', level: '', type: '', search: '' });
    const [loading, setLoading] = useState(true);
    const [showAdd, setShowAdd] = useState(false);
    const [expandedId, setExpandedId] = useState(null);
    const [summary, setSummary] = useState('');
    const [summarizing, setSummarizing] = useState(false);
    const [articleContent, setArticleContent] = useState('');
    const [extracting, setExtracting] = useState(false);
    const [newResource, setNewResource] = useState({ title: '', description: '', topic: '', level: 'beginner', resourceType: 'video', link: '' });

    useEffect(() => {
        const fetch = async () => {
            try {
                const [resRes, topRes, progRes] = await Promise.all([
                    getResources(filters), getTopics(),
                    getProgress().catch(() => ({ data: { progress: { completedResources: [] } } }))
                ]);
                setResources(resRes.data.resources || []);
                setTopics(topRes.data.topics || []);
                setCompleted((progRes.data.progress?.completedResources || []).map(r => r._id || r));
            } catch (err) { console.error(err); }
            setLoading(false);
        };
        fetch();
    }, []);

    const handleFilter = async () => {
        setLoading(true);
        const params = {};
        if (filters.topic) params.topic = filters.topic;
        if (filters.level) params.level = filters.level;
        if (filters.type) params.type = filters.type;
        if (filters.search) params.search = filters.search;
        const res = await getResources(params);
        setResources(res.data.resources || []);
        setLoading(false);
    };

    const toggleComplete = async (id, e) => {
        e?.stopPropagation();
        try {
            if (completed.includes(id)) { await uncompleteResource(id); setCompleted(completed.filter(c => c !== id)); }
            else { await completeResource(id); setCompleted([...completed, id]); }
        } catch (err) { console.error(err); }
    };

    const handleAddResource = async (e) => {
        e.preventDefault();
        try { await createResource(newResource); setShowAdd(false); setNewResource({ title: '', description: '', topic: '', level: 'beginner', resourceType: 'video', link: '' }); handleFilter(); }
        catch (err) { console.error(err); }
    };

    const toggleExpand = (id) => {
        if (expandedId === id) { setExpandedId(null); setSummary(''); setArticleContent(''); }
        else { setExpandedId(id); setSummary(''); setArticleContent(''); }
    };

    const handleSummarize = async (resource, e) => {
        e.stopPropagation();
        setSummarizing(true);
        try {
            const { data } = await summarizeArticle({ url: resource.link });
            setSummary(data.summary);
        } catch { setSummary('Could not generate summary. The GROQ_API_KEY may not be configured.'); }
        setSummarizing(false);
    };

    const extractArticle = async (resource, e) => {
        e.stopPropagation();
        setExtracting(true);
        try {
            const { data } = await summarizeArticle({ url: resource.link });
            setArticleContent(data.summary);
        } catch { setArticleContent('Could not extract article content.'); }
        setExtracting(false);
    };

    const getYouTubeId = (url) => {
        const match = url?.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/))([^?&]+)/);
        return match ? match[1] : null;
    };

    const getLevelColor = (level) => ({ beginner: 'badge-success', intermediate: 'badge-warning', advanced: 'badge-danger' }[level] || 'badge-info');

    return (
        <div className="page">
            <div className="page-header">
                <h1 className="page-title">📚 <span>Learning Resources</span></h1>
                {(user?.role === 'mentor' || user?.role === 'admin') && (
                    <button className="btn btn-primary" onClick={() => setShowAdd(true)}><FiPlus /> Add Resource</button>
                )}
            </div>

            {/* Filters */}
            <div className="glass-card" style={{ marginBottom: 24, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                <FiFilter style={{ color: 'var(--text-muted)' }} />
                <input className="form-input" style={{ flex: 1, minWidth: 200 }} placeholder="Search resources..." value={filters.search} onChange={e => setFilters({ ...filters, search: e.target.value })} />
                <select className="form-select" style={{ width: 160 }} value={filters.topic} onChange={e => setFilters({ ...filters, topic: e.target.value })}>
                    <option value="">All Topics</option>
                    {topics.map(t => <option key={t._id} value={t._id}>{t.name}</option>)}
                </select>
                <select className="form-select" style={{ width: 140 }} value={filters.level} onChange={e => setFilters({ ...filters, level: e.target.value })}>
                    <option value="">All Levels</option>
                    <option value="beginner">Beginner</option>
                    <option value="intermediate">Intermediate</option>
                    <option value="advanced">Advanced</option>
                </select>
                <select className="form-select" style={{ width: 130 }} value={filters.type} onChange={e => setFilters({ ...filters, type: e.target.value })}>
                    <option value="">All Types</option>
                    <option value="video">Video</option>
                    <option value="article">Article</option>
                    <option value="pdf">PDF</option>
                </select>
                <button className="btn btn-primary btn-sm" onClick={handleFilter}><FiSearch /> Search</button>
            </div>

            {loading ? <div className="spinner" /> : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {resources.map(r => {
                        const isExpanded = expandedId === r._id;
                        const ytId = getYouTubeId(r.link);
                        const isVideo = r.resourceType === 'video' && ytId;
                        const isArticle = r.resourceType === 'article';
                        return (
                            <div key={r._id} className="glass-card" style={{ position: 'relative', overflow: 'hidden' }}>
                                {/* Card Header — always visible */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }} onClick={() => toggleExpand(r._id)}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 14, flex: 1 }}>
                                        <div style={{ width: 42, height: 42, borderRadius: 10, background: isVideo ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: isVideo ? '#ef4444' : 'var(--accent-primary)', fontSize: 18, flexShrink: 0 }}>
                                            {isVideo ? <FiPlay /> : isArticle ? <FiFileText /> : <FiBook />}
                                        </div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 2, textDecoration: completed.includes(r._id) ? 'line-through' : 'none', opacity: completed.includes(r._id) ? 0.6 : 1 }}>{r.title}</h3>
                                            <p style={{ fontSize: 12, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.description}</p>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
                                        <span className={`badge ${getLevelColor(r.level)}`}>{r.level}</span>
                                        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{r.topic?.name}</span>
                                        {user?.role === 'mentee' && (
                                            <button onClick={e => toggleComplete(r._id, e)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: completed.includes(r._id) ? 'var(--accent-success)' : 'var(--text-muted)', fontSize: 20 }}>
                                                <FiCheckCircle />
                                            </button>
                                        )}
                                        <span style={{ color: 'var(--text-muted)' }}>{isExpanded ? <FiChevronUp /> : <FiChevronDown />}</span>
                                    </div>
                                </div>

                                {/* Expanded Content */}
                                {isExpanded && (
                                    <div style={{ marginTop: 16, borderTop: '1px solid var(--border-color)', paddingTop: 16 }}>
                                        {/* YouTube Video Embed */}
                                        {isVideo && (
                                            <div style={{ marginBottom: 16 }}>
                                                <div className="video-embed-container">
                                                    <iframe src={`https://www.youtube.com/embed/${ytId}`} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen title={r.title}></iframe>
                                                </div>
                                            </div>
                                        )}

                                        {/* Article Content / Summary */}
                                        {isArticle && (
                                            <div style={{ marginBottom: 16 }}>
                                                <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                                                    <button className="btn btn-primary btn-sm" onClick={e => handleSummarize(r, e)} disabled={summarizing}>
                                                        <FiZap /> {summarizing ? 'Summarizing...' : 'AI Summary'}
                                                    </button>
                                                    <a href={r.link} target="_blank" rel="noreferrer" className="btn btn-secondary btn-sm" onClick={e => e.stopPropagation()}>
                                                        <FiExternalLink /> Open Original
                                                    </a>
                                                </div>
                                                {summary && (
                                                    <div style={{ padding: 16, background: 'rgba(16,185,129,0.04)', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(16,185,129,0.15)' }}>
                                                        <h4 style={{ color: 'var(--accent-primary)', marginBottom: 8, fontSize: 13 }}>🤖 AI-Generated Summary</h4>
                                                        <div style={{ color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>{summary}</div>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* Non-video, non-article */}
                                        {!isVideo && !isArticle && r.link && (
                                            <a href={r.link} target="_blank" rel="noreferrer" className="btn btn-primary btn-sm">
                                                <FiExternalLink /> Open Resource
                                            </a>
                                        )}

                                        {r.description && <p style={{ color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.7, marginTop: 8 }}>{r.description}</p>}
                                    </div>
                                )}

                                {completed.includes(r._id) && (
                                    <div style={{ position: 'absolute', top: 0, right: 0, background: 'var(--accent-success)', color: 'white', padding: '3px 10px', borderRadius: '0 var(--radius-lg) 0 var(--radius-sm)', fontSize: 10, fontWeight: 600 }}>✓ Done</div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
            {!loading && resources.length === 0 && <div className="empty-state"><div className="icon">📚</div><p>No resources found. Try adjusting your filters.</p></div>}

            {/* Add Resource Modal */}
            {showAdd && (
                <div className="modal-overlay" onClick={() => setShowAdd(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                            <h2>Add Resource</h2>
                            <button style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 20 }} onClick={() => setShowAdd(false)}><FiX /></button>
                        </div>
                        <form onSubmit={handleAddResource}>
                            <div className="form-group"><label>Title</label><input className="form-input" value={newResource.title} onChange={e => setNewResource({ ...newResource, title: e.target.value })} required /></div>
                            <div className="form-group"><label>Description</label><textarea className="form-textarea" value={newResource.description} onChange={e => setNewResource({ ...newResource, description: e.target.value })} /></div>
                            <div className="form-group"><label>Topic</label><select className="form-select" value={newResource.topic} onChange={e => setNewResource({ ...newResource, topic: e.target.value })} required><option value="">Select topic</option>{topics.map(t => <option key={t._id} value={t._id}>{t.name}</option>)}</select></div>
                            <div className="grid grid-2">
                                <div className="form-group"><label>Level</label><select className="form-select" value={newResource.level} onChange={e => setNewResource({ ...newResource, level: e.target.value })}><option value="beginner">Beginner</option><option value="intermediate">Intermediate</option><option value="advanced">Advanced</option></select></div>
                                <div className="form-group"><label>Type</label><select className="form-select" value={newResource.resourceType} onChange={e => setNewResource({ ...newResource, resourceType: e.target.value })}><option value="video">Video</option><option value="article">Article</option><option value="pdf">PDF</option></select></div>
                            </div>
                            <div className="form-group"><label>Link / URL</label><input className="form-input" value={newResource.link} onChange={e => setNewResource({ ...newResource, link: e.target.value })} placeholder="https://..." /></div>
                            <button className="btn btn-primary" style={{ width: '100%' }}>Add Resource</button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Resources;
