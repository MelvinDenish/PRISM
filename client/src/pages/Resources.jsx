import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { getResources, getTopics, getCompanies, completeResource, uncompleteResource, getProgress, createResource } from '../services/api';
import { FiSearch, FiFilter, FiPlay, FiExternalLink, FiCheckCircle, FiPlus, FiX } from 'react-icons/fi';

const Resources = () => {
    const { user } = useAuth();
    const [resources, setResources] = useState([]);
    const [topics, setTopics] = useState([]);
    const [companies, setCompanies] = useState([]);
    const [completed, setCompleted] = useState([]);
    const [filters, setFilters] = useState({ topic: '', level: '', type: '', search: '' });
    const [loading, setLoading] = useState(true);
    const [showAdd, setShowAdd] = useState(false);
    const [newResource, setNewResource] = useState({ title: '', description: '', topic: '', level: 'beginner', resourceType: 'video', link: '' });

    useEffect(() => {
        const fetch = async () => {
            try {
                const [resRes, topRes, compRes, progRes] = await Promise.all([
                    getResources(filters), getTopics(), getCompanies(),
                    getProgress().catch(() => ({ data: { progress: { completedResources: [] } } }))
                ]);
                setResources(resRes.data.resources || []);
                setTopics(topRes.data.topics || []);
                setCompanies(compRes.data.companies || []);
                setCompleted((progRes.data.progress?.completedResources || []).map((r) => r._id || r));
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

    const toggleComplete = async (id) => {
        try {
            if (completed.includes(id)) {
                await uncompleteResource(id);
                setCompleted(completed.filter((c) => c !== id));
            } else {
                await completeResource(id);
                setCompleted([...completed, id]);
            }
        } catch (err) { console.error(err); }
    };

    const handleAddResource = async (e) => {
        e.preventDefault();
        try {
            await createResource(newResource);
            setShowAdd(false);
            setNewResource({ title: '', description: '', topic: '', level: 'beginner', resourceType: 'video', link: '' });
            handleFilter();
        } catch (err) { console.error(err); }
    };

    const getTypeIcon = (type) => {
        switch (type) {
            case 'video': return <FiPlay />;
            default: return <FiExternalLink />;
        }
    };

    const getLevelColor = (level) => {
        switch (level) {
            case 'beginner': return 'badge-success';
            case 'intermediate': return 'badge-warning';
            case 'advanced': return 'badge-danger';
            default: return 'badge-info';
        }
    };

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
                <input className="form-input" style={{ flex: 1, minWidth: 200 }} placeholder="Search resources..." value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} />
                <select className="form-select" style={{ width: 160 }} value={filters.topic} onChange={(e) => setFilters({ ...filters, topic: e.target.value })}>
                    <option value="">All Topics</option>
                    {topics.map((t) => <option key={t._id} value={t._id}>{t.name}</option>)}
                </select>
                <select className="form-select" style={{ width: 140 }} value={filters.level} onChange={(e) => setFilters({ ...filters, level: e.target.value })}>
                    <option value="">All Levels</option>
                    <option value="beginner">Beginner</option>
                    <option value="intermediate">Intermediate</option>
                    <option value="advanced">Advanced</option>
                </select>
                <select className="form-select" style={{ width: 130 }} value={filters.type} onChange={(e) => setFilters({ ...filters, type: e.target.value })}>
                    <option value="">All Types</option>
                    <option value="video">Video</option>
                    <option value="article">Article</option>
                    <option value="pdf">PDF</option>
                    <option value="link">Link</option>
                </select>
                <button className="btn btn-primary btn-sm" onClick={handleFilter}><FiSearch /> Search</button>
            </div>

            {loading ? <div className="spinner" /> : (
                <div className="grid grid-3">
                    {resources.map((r) => (
                        <div key={r._id} className="glass-card" style={{ cursor: 'pointer', position: 'relative' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 12 }}>
                                <span className={`badge ${getLevelColor(r.level)}`}>{r.level}</span>
                                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                    <span className="chip">{getTypeIcon(r.resourceType)} {r.resourceType}</span>
                                    {user?.role === 'mentee' && (
                                        <button onClick={() => toggleComplete(r._id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: completed.includes(r._id) ? 'var(--accent-success)' : 'var(--text-muted)', fontSize: 20 }}>
                                            <FiCheckCircle />
                                        </button>
                                    )}
                                </div>
                            </div>
                            <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>{r.title}</h3>
                            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12, lineHeight: 1.5 }}>{r.description?.slice(0, 100)}</p>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{r.topic?.name}</span>
                                {r.link && (
                                    <a href={r.link} target="_blank" rel="noreferrer" className="btn btn-secondary btn-sm" onClick={(e) => e.stopPropagation()}>
                                        <FiExternalLink /> Open
                                    </a>
                                )}
                            </div>
                            {completed.includes(r._id) && (
                                <div style={{ position: 'absolute', top: 0, right: 0, background: 'var(--accent-success)', color: 'white', padding: '4px 12px', borderRadius: '0 var(--radius-lg) 0 var(--radius-sm)', fontSize: 11, fontWeight: 600 }}>
                                    ✓ Done
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
            {!loading && resources.length === 0 && <div className="empty-state"><div className="icon">📚</div><p>No resources found. Try adjusting your filters.</p></div>}

            {/* Add Resource Modal */}
            {showAdd && (
                <div className="modal-overlay" onClick={() => setShowAdd(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                            <h2>Add Resource</h2>
                            <button style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 20 }} onClick={() => setShowAdd(false)}><FiX /></button>
                        </div>
                        <form onSubmit={handleAddResource}>
                            <div className="form-group"><label>Title</label><input className="form-input" value={newResource.title} onChange={(e) => setNewResource({ ...newResource, title: e.target.value })} required /></div>
                            <div className="form-group"><label>Description</label><textarea className="form-textarea" value={newResource.description} onChange={(e) => setNewResource({ ...newResource, description: e.target.value })} /></div>
                            <div className="form-group"><label>Topic</label><select className="form-select" value={newResource.topic} onChange={(e) => setNewResource({ ...newResource, topic: e.target.value })} required><option value="">Select topic</option>{topics.map((t) => <option key={t._id} value={t._id}>{t.name}</option>)}</select></div>
                            <div className="grid grid-2">
                                <div className="form-group"><label>Level</label><select className="form-select" value={newResource.level} onChange={(e) => setNewResource({ ...newResource, level: e.target.value })}><option value="beginner">Beginner</option><option value="intermediate">Intermediate</option><option value="advanced">Advanced</option></select></div>
                                <div className="form-group"><label>Type</label><select className="form-select" value={newResource.resourceType} onChange={(e) => setNewResource({ ...newResource, resourceType: e.target.value })}><option value="video">Video</option><option value="article">Article</option><option value="pdf">PDF</option><option value="link">Link</option></select></div>
                            </div>
                            <div className="form-group"><label>Link / URL</label><input className="form-input" value={newResource.link} onChange={(e) => setNewResource({ ...newResource, link: e.target.value })} placeholder="https://..." /></div>
                            <button className="btn btn-primary" style={{ width: '100%' }}>Add Resource</button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Resources;
