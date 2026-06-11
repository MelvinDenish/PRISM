import { useState, useEffect } from 'react';
import { getBehavioralAnswers, createBehavioralAnswer, updateBehavioralAnswer, deleteBehavioralAnswer } from '../services/api';
import { FiPlus, FiX, FiEdit2, FiTrash2, FiMessageSquare } from 'react-icons/fi';
import Reveal from '../components/motion/Reveal';
import PageHero from '../components/ui/PageHero';
import { SkeletonGrid } from '../components/ui/Skeleton';
import Modal from '../components/ui/Modal';

// Common behavioral prompts to seed a new answer.
const PROMPTS = [
    'Tell me about a time you faced a conflict in a team.',
    'Describe a time you failed. What did you learn?',
    'Tell me about a challenging project and your role in it.',
    'Describe a situation where you showed leadership.',
    'Tell me about a time you had to learn something quickly.',
    'Describe a time you disagreed with a decision. What did you do?',
];

const EMPTY = { question: '', situation: '', task: '', action: '', result: '', tags: '' };

const STAR_FIELDS = [
    ['situation', 'Situation', 'Set the scene — context and background.'],
    ['task', 'Task', 'What was your responsibility or goal?'],
    ['action', 'Action', 'What did you specifically do?'],
    ['result', 'Result', 'What was the outcome? Quantify if you can.'],
];

const BehavioralBank = () => {
    const [answers, setAnswers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState(null); // null = closed; object = open
    const [form, setForm] = useState(EMPTY);
    const [saving, setSaving] = useState(false);

    useEffect(() => { load(); }, []);
    const load = async () => {
        setLoading(true);
        try { const { data } = await getBehavioralAnswers(); setAnswers(data.answers || []); }
        catch { setAnswers([]); }
        setLoading(false);
    };

    const openNew = (prompt = '') => { setForm({ ...EMPTY, question: prompt }); setEditing({}); };
    const openEdit = (a) => {
        setForm({ question: a.question, situation: a.situation || '', task: a.task || '', action: a.action || '', result: a.result || '', tags: (a.tags || []).join(', ') });
        setEditing(a);
    };

    const save = async (e) => {
        e.preventDefault();
        setSaving(true);
        const payload = { ...form, tags: form.tags.split(',').map((t) => t.trim()).filter(Boolean) };
        try {
            if (editing && editing._id) await updateBehavioralAnswer(editing._id, payload);
            else await createBehavioralAnswer(payload);
            setEditing(null);
            await load();
        } catch { /* surfaced by empty save; keep modal open */ }
        setSaving(false);
    };

    const remove = async (id) => { await deleteBehavioralAnswer(id); load(); };

    return (
        <div className="page">
            <PageHero
                eyebrow="Behavioral"
                title="STAR Answer Bank"
                subtitle="Draft, save, and refine your behavioral stories using the STAR framework — reuse them across interviews."
                icon={<FiMessageSquare />}
                actions={<button className="btn btn-action" onClick={() => openNew()}><FiPlus /> New Answer</button>}
            />

            {!loading && answers.length === 0 && (
                <div className="glass-card" style={{ padding: 24, marginBottom: 24 }}>
                    <h3 style={{ fontSize: 15, marginBottom: 12 }}>Start with a common question</h3>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {PROMPTS.map((p) => (
                            <button key={p} className="chip" style={{ cursor: 'pointer' }} onClick={() => openNew(p)}>{p}</button>
                        ))}
                    </div>
                </div>
            )}

            {loading ? <SkeletonGrid count={4} cols={2} /> : (
                <div className="grid grid-2">
                    {answers.map((a, i) => (
                        <Reveal as="div" key={a._id} i={i} className="glass-card spotlight">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                                <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>{a.question}</h3>
                                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                                    <button className="icon-btn" onClick={() => openEdit(a)}><FiEdit2 /></button>
                                    <button className="icon-btn" style={{ color: 'var(--accent-danger)' }} onClick={() => remove(a._id)}><FiTrash2 /></button>
                                </div>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13 }}>
                                {STAR_FIELDS.map(([key, label]) => a[key] && (
                                    <div key={key}><strong style={{ color: 'var(--accent-primary, #10b981)' }}>{label}:</strong> <span style={{ color: 'var(--text-secondary)' }}>{a[key]}</span></div>
                                ))}
                            </div>
                            {a.tags?.length > 0 && (
                                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
                                    {a.tags.map((t) => <span key={t} className="chip" style={{ fontSize: 11 }}>{t}</span>)}
                                </div>
                            )}
                        </Reveal>
                    ))}
                </div>
            )}

            {editing && (
                <Modal onClose={() => setEditing(null)} size="lg">
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
                        <h2>{editing._id ? 'Edit Answer' : 'New STAR Answer'}</h2>
                        <button className="icon-btn" onClick={() => setEditing(null)}><FiX /></button>
                    </div>
                    <form onSubmit={save}>
                        <div className="form-group">
                            <label>Question</label>
                            <input className="form-input" value={form.question} onChange={(e) => setForm({ ...form, question: e.target.value })} placeholder="e.g. Tell me about a conflict you resolved" required />
                        </div>
                        {STAR_FIELDS.map(([key, label, hint]) => (
                            <div className="form-group" key={key}>
                                <label>{label}</label>
                                <textarea className="form-textarea" value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} placeholder={hint} rows={2} />
                            </div>
                        ))}
                        <div className="form-group">
                            <label>Tags (comma-separated)</label>
                            <input className="form-input" value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="leadership, conflict" />
                        </div>
                        <button className="btn btn-primary" style={{ width: '100%' }} disabled={saving}>{saving ? 'Saving…' : 'Save Answer'}</button>
                    </form>
                </Modal>
            )}
        </div>
    );
};

export default BehavioralBank;
