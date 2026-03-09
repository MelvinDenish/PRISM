import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { getCodingQuestions, createCodingQuestion, getTopics } from '../services/api';
import { FiPlus, FiX } from 'react-icons/fi';

const CodingQuestions = () => {
    const { user } = useAuth();
    const [questions, setQuestions] = useState([]);
    const [topics, setTopics] = useState([]);
    const [filter, setFilter] = useState('');
    const [showAdd, setShowAdd] = useState(false);
    const [form, setForm] = useState({ title: '', description: '', difficulty: 'easy', topic: '', sampleInput: '', sampleOutput: '' });
    const [loading, setLoading] = useState(true);

    useEffect(() => { fetch(); }, [filter]);
    const fetch = async () => {
        setLoading(true);
        const [q, t] = await Promise.all([getCodingQuestions(filter ? { difficulty: filter } : {}), getTopics()]);
        setQuestions(q.data.questions || []);
        setTopics(t.data.topics || []);
        setLoading(false);
    };

    const handleCreate = async (e) => {
        e.preventDefault();
        await createCodingQuestion(form);
        setShowAdd(false);
        fetch();
    };

    const diffColors = { easy: 'badge-success', medium: 'badge-warning', hard: 'badge-danger' };

    return (
        <div className="page">
            <div className="page-header">
                <h1 className="page-title">💻 <span>Coding Questions</span></h1>
                {(user?.role === 'mentor' || user?.role === 'admin') && <button className="btn btn-primary" onClick={() => setShowAdd(true)}><FiPlus /> Add</button>}
            </div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
                {['', 'easy', 'medium', 'hard'].map((d) => <button key={d} className={`btn btn-sm ${filter === d ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setFilter(d)}>{d || 'All'}</button>)}
            </div>
            {loading ? <div className="spinner" /> : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {questions.map((q) => (
                        <div key={q._id} className="glass-card">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                                <div>
                                    <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 6 }}>{q.title}</h3>
                                    <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8 }}>{q.description?.slice(0, 200)}</p>
                                    <div style={{ display: 'flex', gap: 8 }}>
                                        <span className={`badge ${diffColors[q.difficulty]}`}>{q.difficulty}</span>
                                        {q.topic?.name && <span className="chip">{q.topic.name}</span>}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                    {questions.length === 0 && <div className="empty-state"><p>No questions found</p></div>}
                </div>
            )}
            {showAdd && (
                <div className="modal-overlay" onClick={() => setShowAdd(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}><h2>Add Question</h2><button style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 20 }} onClick={() => setShowAdd(false)}><FiX /></button></div>
                        <form onSubmit={handleCreate}>
                            <div className="form-group"><label>Title</label><input className="form-input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required /></div>
                            <div className="form-group"><label>Description</label><textarea className="form-textarea" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} required /></div>
                            <div className="grid grid-2">
                                <div className="form-group"><label>Difficulty</label><select className="form-select" value={form.difficulty} onChange={(e) => setForm({ ...form, difficulty: e.target.value })}><option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option></select></div>
                                <div className="form-group"><label>Topic</label><select className="form-select" value={form.topic} onChange={(e) => setForm({ ...form, topic: e.target.value })}><option value="">Select</option>{topics.map((t) => <option key={t._id} value={t._id}>{t.name}</option>)}</select></div>
                            </div>
                            <div className="form-group"><label>Sample Input</label><input className="form-input" value={form.sampleInput} onChange={(e) => setForm({ ...form, sampleInput: e.target.value })} /></div>
                            <div className="form-group"><label>Sample Output</label><input className="form-input" value={form.sampleOutput} onChange={(e) => setForm({ ...form, sampleOutput: e.target.value })} /></div>
                            <button className="btn btn-primary" style={{ width: '100%' }}>Add Question</button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CodingQuestions;
