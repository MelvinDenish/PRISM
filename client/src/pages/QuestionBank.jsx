import { useState, useEffect, useCallback } from 'react';
import { getBankQuestions, addBankQuestion, deleteBankQuestion, getCompanies } from '../services/api';
import { FiDatabase, FiPlus, FiTrash2, FiX, FiAlertCircle, FiCheckCircle } from 'react-icons/fi';
import Reveal from '../components/motion/Reveal';
import PageHero from '../components/ui/PageHero';
import Modal from '../components/ui/Modal';

const TYPES = [
    { value: 'technical', label: 'Technical MCQ' },
    { value: 'aptitude', label: 'Aptitude MCQ' },
    { value: 'hr', label: 'HR / Behavioral' },
    { value: 'coding', label: 'Coding' },
];
const DIFFS = ['easy', 'medium', 'hard'];

const emptyForm = () => ({
    type: 'technical', companyTag: '', category: '', difficulty: 'medium', year: '',
    q: '', opts: ['', '', '', ''], ans: '',
    title: '', description: '', reference: '', testInputs: '',
});

const QuestionBank = () => {
    const [questions, setQuestions] = useState([]);
    const [companies, setCompanies] = useState([]);
    const [loading, setLoading] = useState(true);
    const [show, setShow] = useState(false);
    const [form, setForm] = useState(emptyForm());
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [filterCompany, setFilterCompany] = useState('');

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const [{ data: q }, { data: c }] = await Promise.all([
                getBankQuestions(filterCompany ? { companyTag: filterCompany } : {}),
                getCompanies(),
            ]);
            setQuestions(q.questions || []);
            setCompanies(c.companies || []);
        } catch { /* ignore */ }
        setLoading(false);
    }, [filterCompany]);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load-on-mount/filter is the app-wide data pattern
    useEffect(() => { load(); }, [load]);

    const companyName = (id) => companies.find((c) => c._id === id)?.name || (typeof id === 'object' ? id?.name : '') || '—';

    const submit = async (e) => {
        e.preventDefault();
        setSaving(true); setError('');
        const isMcq = form.type === 'technical' || form.type === 'aptitude';
        const payload = {
            type: form.type, category: form.category || undefined, difficulty: form.difficulty,
            companyTag: form.companyTag || undefined, year: form.year || undefined,
        };
        if (isMcq) { payload.q = form.q; payload.opts = form.opts.filter(Boolean); payload.ans = form.ans; }
        else if (form.type === 'hr') { payload.q = form.q; }
        else { payload.title = form.title; payload.description = form.description; payload.referenceSolution = form.reference; payload.testInputs = form.testInputs.split('\n---\n').map((s) => s.trim()).filter(Boolean); }
        try {
            await addBankQuestion(payload);
            setShow(false); setForm(emptyForm());
            await load();
        } catch (err) {
            setError(err.response?.data?.message || 'Could not save the question.');
        }
        setSaving(false);
    };

    const remove = async (id) => { try { await deleteBankQuestion(id); load(); } catch { /* ignore */ } };

    const isMcq = form.type === 'technical' || form.type === 'aptitude';

    return (
        <div className="page">
            <PageHero
                eyebrow="Content"
                title="Question Bank"
                subtitle="Upload real past-interview questions tagged to a company. They're served first when a candidate targets that company in the Interview Game."
                icon={<FiDatabase />}
                actions={<button className="btn btn-action" onClick={() => { setForm(emptyForm()); setError(''); setShow(true); }}><FiPlus /> Add Question</button>}
            />

            <div style={{ display: 'flex', gap: 12, marginBottom: 20, alignItems: 'center' }}>
                <label style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Filter by company</label>
                <select className="form-select" style={{ maxWidth: 240 }} value={filterCompany} onChange={(e) => setFilterCompany(e.target.value)}>
                    <option value="">All companies</option>
                    {companies.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
                </select>
            </div>

            {loading ? <div className="spinner" /> : questions.length === 0 ? (
                <div className="empty-state"><div className="icon"><FiDatabase /></div><p>No mentor/research questions yet. Add company-specific questions to power targeted games.</p></div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {questions.map((q, i) => (
                        <Reveal as="div" key={q._id} i={i} className="glass-card" style={{ padding: 16, display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                            <div style={{ minWidth: 0 }}>
                                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
                                    <span className="chip" style={{ fontSize: 11 }}>{q.type}</span>
                                    <span className="chip" style={{ fontSize: 11 }}>{companyName(q.companyTag)}</span>
                                    {q.source && <span className="chip" style={{ fontSize: 11 }}>{q.source}</span>}
                                    {q.difficulty && <span className="chip" style={{ fontSize: 11 }}>{q.difficulty}</span>}
                                </div>
                                <p style={{ fontSize: 14, fontWeight: 600 }}>{q.q || q.title}</p>
                                {q.ans && <p style={{ fontSize: 12, color: 'var(--accent-success, #16a34a)', marginTop: 4 }}><FiCheckCircle style={{ verticalAlign: 'middle' }} /> {q.ans}</p>}
                            </div>
                            <button className="icon-btn" style={{ color: 'var(--accent-danger)', flexShrink: 0 }} onClick={() => remove(q._id)}><FiTrash2 /></button>
                        </Reveal>
                    ))}
                </div>
            )}

            {show && (
                <Modal onClose={() => setShow(false)} size="lg">
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                        <h2>Add Company Question</h2>
                        <button className="icon-btn" onClick={() => setShow(false)}><FiX /></button>
                    </div>
                    <form onSubmit={submit}>
                        <div className="grid grid-2" style={{ gap: 12 }}>
                            <div className="form-group"><label>Type</label>
                                <select className="form-select" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                                    {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                                </select>
                            </div>
                            <div className="form-group"><label>Company</label>
                                <select className="form-select" value={form.companyTag} onChange={(e) => setForm({ ...form, companyTag: e.target.value })}>
                                    <option value="">— none (generic) —</option>
                                    {companies.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
                                </select>
                            </div>
                            <div className="form-group"><label>Category</label><input className="form-input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="e.g. dsa, dbms" /></div>
                            <div className="form-group"><label>Difficulty</label><select className="form-select" value={form.difficulty} onChange={(e) => setForm({ ...form, difficulty: e.target.value })}>{DIFFS.map((d) => <option key={d} value={d}>{d}</option>)}</select></div>
                        </div>

                        {(isMcq || form.type === 'hr') && (
                            <div className="form-group"><label>Question</label><textarea className="form-textarea" rows={2} value={form.q} onChange={(e) => setForm({ ...form, q: e.target.value })} required /></div>
                        )}
                        {isMcq && (
                            <>
                                <label style={{ fontSize: 13, fontWeight: 600 }}>Options (pick the correct one)</label>
                                {form.opts.map((o, oi) => (
                                    <div key={oi} style={{ display: 'flex', gap: 8, alignItems: 'center', margin: '6px 0' }}>
                                        <input type="radio" name="ans" checked={form.ans === o && o !== ''} onChange={() => setForm({ ...form, ans: o })} />
                                        <input className="form-input" value={o} onChange={(e) => { const opts = [...form.opts]; opts[oi] = e.target.value; setForm({ ...form, opts, ans: form.ans === form.opts[oi] ? e.target.value : form.ans }); }} placeholder={`Option ${oi + 1}`} />
                                    </div>
                                ))}
                            </>
                        )}
                        {form.type === 'coding' && (
                            <>
                                <div className="form-group"><label>Title</label><input className="form-input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required /></div>
                                <div className="form-group"><label>Description (with stdin/stdout format)</label><textarea className="form-textarea" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} required /></div>
                                <div className="form-group"><label>Python 3 reference solution (reads stdin, prints stdout — verified before saving)</label><textarea className="form-textarea" style={{ fontFamily: 'monospace', fontSize: 13 }} rows={6} value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} required /></div>
                                <div className="form-group"><label>Test inputs (separate each with a line containing only <code>---</code>)</label><textarea className="form-textarea" style={{ fontFamily: 'monospace', fontSize: 13 }} rows={4} value={form.testInputs} onChange={(e) => setForm({ ...form, testInputs: e.target.value })} placeholder={'5\\n3 1 4 1 5\\n---\\n1\\n42'} required /></div>
                            </>
                        )}

                        {error && <p style={{ color: 'var(--accent-danger)', fontSize: 13, marginBottom: 10, display: 'flex', gap: 6, alignItems: 'center' }}><FiAlertCircle /> {error}</p>}
                        <button className="btn btn-primary" style={{ width: '100%' }} disabled={saving}>{saving ? 'Saving…' : 'Add Question'}</button>
                    </form>
                </Modal>
            )}
        </div>
    );
};

export default QuestionBank;
