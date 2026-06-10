import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { getCompanies, createCompany, deleteCompany } from '../services/api';
import { FiPlus, FiTrash2, FiX, FiBriefcase, FiClipboard, FiZap } from 'react-icons/fi';
import Reveal from '../components/motion/Reveal';
import PageHero from '../components/ui/PageHero';
import { SkeletonGrid } from '../components/ui/Skeleton';
import Modal from '../components/ui/Modal';

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
            <PageHero
                eyebrow="Target"
                title="Companies"
                subtitle="Know each company's interview pattern before you walk in."
                icon={<FiBriefcase />}
                actions={(user?.role === 'admin' || user?.role === 'mentor') && <button className="btn btn-action" onClick={() => setShowAdd(true)}><FiPlus /> Add</button>}
            />
            {loading ? <SkeletonGrid count={6} cols={3} /> : (
                <div className="grid grid-3">
                    {companies.map((c, i) => (
                        <Reveal as="div" key={c._id} i={i} className="glass-card spotlight">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                                    <span className="company-emblem">{c.name?.[0]?.toUpperCase() || 'C'}</span>
                                    <h3 style={{ fontSize: 18, fontWeight: 700 }}>{c.name}</h3>
                                </div>
                                {user?.role === 'admin' && <button style={{ background: 'none', border: 'none', color: 'var(--accent-danger)', cursor: 'pointer' }} onClick={() => handleDelete(c._id)}><FiTrash2 /></button>}
                            </div>
                            {c.description && <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '10px 0' }}>{c.description}</p>}
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                                {c.interviewPattern && <div className="chip"><FiClipboard /> {c.interviewPattern}</div>}
                                {c.difficultyLevel && <div className="chip"><FiZap /> {c.difficultyLevel}</div>}
                            </div>
                        </Reveal>
                    ))}
                </div>
            )}
            {showAdd && (
                <Modal onClose={() => setShowAdd(false)}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}><h2>Add Company</h2><button style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 20 }} onClick={() => setShowAdd(false)}><FiX /></button></div>
                        <form onSubmit={handleCreate}>
                            <div className="form-group"><label>Name</label><input className="form-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
                            <div className="form-group"><label>Description</label><textarea className="form-textarea" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
                            <div className="form-group"><label>Interview Pattern</label><input className="form-input" value={form.interviewPattern} onChange={(e) => setForm({ ...form, interviewPattern: e.target.value })} placeholder="e.g. Coding + HR + GD" /></div>
                            <div className="form-group"><label>Difficulty</label><input className="form-input" value={form.difficultyLevel} onChange={(e) => setForm({ ...form, difficultyLevel: e.target.value })} placeholder="Easy / Medium / Hard" /></div>
                            <button className="btn btn-primary" style={{ width: '100%' }}>Add Company</button>
                        </form>
                </Modal>
            )}
        </div>
    );
};

export default Companies;
