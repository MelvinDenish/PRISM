import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { getCompanies, createCompany, deleteCompany } from '../services/api';
import { FiPlus, FiTrash2, FiX } from 'react-icons/fi';

const Companies = () => {
    const { user } = useAuth();
    const [companies, setCompanies] = useState([]);
    const [showAdd, setShowAdd] = useState(false);
    const [form, setForm] = useState({ name: '', description: '', interviewPattern: '', difficultyLevel: '' });
    const [loading, setLoading] = useState(true);

    useEffect(() => { fetch(); }, []);
    const fetch = async () => { setLoading(true); const r = await getCompanies(); setCompanies(r.data.companies || []); setLoading(false); };

    const handleCreate = async (e) => {
        e.preventDefault();
        await createCompany(form);
        setShowAdd(false);
        setForm({ name: '', description: '', interviewPattern: '', difficultyLevel: '' });
        fetch();
    };

    const handleDelete = async (id) => { await deleteCompany(id); fetch(); };

    return (
        <div className="page">
            <div className="page-header">
                <h1 className="page-title">🏢 <span>Companies</span></h1>
                {(user?.role === 'admin' || user?.role === 'mentor') && <button className="btn btn-primary" onClick={() => setShowAdd(true)}><FiPlus /> Add</button>}
            </div>
            {loading ? <div className="spinner" /> : (
                <div className="grid grid-3">
                    {companies.map((c) => (
                        <div key={c._id} className="glass-card">
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <h3 style={{ fontSize: 18, fontWeight: 700 }}>{c.name}</h3>
                                {user?.role === 'admin' && <button style={{ background: 'none', border: 'none', color: 'var(--accent-danger)', cursor: 'pointer' }} onClick={() => handleDelete(c._id)}><FiTrash2 /></button>}
                            </div>
                            {c.description && <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '8px 0' }}>{c.description}</p>}
                            {c.interviewPattern && <div className="chip" style={{ marginRight: 6 }}>📋 {c.interviewPattern}</div>}
                            {c.difficultyLevel && <div className="chip">⚡ {c.difficultyLevel}</div>}
                        </div>
                    ))}
                </div>
            )}
            {showAdd && (
                <div className="modal-overlay" onClick={() => setShowAdd(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}><h2>Add Company</h2><button style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 20 }} onClick={() => setShowAdd(false)}><FiX /></button></div>
                        <form onSubmit={handleCreate}>
                            <div className="form-group"><label>Name</label><input className="form-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
                            <div className="form-group"><label>Description</label><textarea className="form-textarea" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
                            <div className="form-group"><label>Interview Pattern</label><input className="form-input" value={form.interviewPattern} onChange={(e) => setForm({ ...form, interviewPattern: e.target.value })} placeholder="e.g. Coding + HR + GD" /></div>
                            <div className="form-group"><label>Difficulty</label><input className="form-input" value={form.difficultyLevel} onChange={(e) => setForm({ ...form, difficultyLevel: e.target.value })} placeholder="Easy / Medium / Hard" /></div>
                            <button className="btn btn-primary" style={{ width: '100%' }}>Add Company</button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Companies;
