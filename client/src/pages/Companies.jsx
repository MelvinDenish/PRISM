import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getCompanies, createCompany, updateCompany, deleteCompany, getCompanyTrack, getMyEligibility } from '../services/api';
import { FiPlus, FiTrash2, FiX, FiBriefcase, FiClipboard, FiZap, FiTarget, FiCheckCircle, FiXCircle, FiAlertCircle, FiEdit2 } from 'react-icons/fi';
import Reveal from '../components/motion/Reveal';
import PageHero from '../components/ui/PageHero';
import { SkeletonGrid } from '../components/ui/Skeleton';
import Modal from '../components/ui/Modal';

const diffColors = { easy: 'badge-success', medium: 'badge-warning', hard: 'badge-danger' };

// Eligibility criteria fields shown in the mentor/admin form (numbers + branches).
const ELIG_NUM = [
    ['cgpaCutoff', 'CGPA cutoff'],
    ['maxActiveArrears', 'Max active arrears'],
    ['maxHistoryArrears', 'Max arrears (history)'],
    ['tenthMin', '10th % min'],
    ['twelfthMin', '12th % min'],
];

const emptyForm = () => ({ name: '', description: '', interviewPattern: '', difficultyLevel: '', elig: { cgpaCutoff: '', maxActiveArrears: '', maxHistoryArrears: '', tenthMin: '', twelfthMin: '', eligibleBranches: '', batch: '' } });

const formFromCompany = (c) => ({
    name: c.name || '', description: c.description || '', interviewPattern: c.interviewPattern || '', difficultyLevel: c.difficultyLevel || '',
    elig: {
        cgpaCutoff: c.eligibility?.cgpaCutoff ?? '', maxActiveArrears: c.eligibility?.maxActiveArrears ?? '',
        maxHistoryArrears: c.eligibility?.maxHistoryArrears ?? '', tenthMin: c.eligibility?.tenthMin ?? '',
        twelfthMin: c.eligibility?.twelfthMin ?? '', eligibleBranches: (c.eligibility?.eligibleBranches || []).join(', '),
        batch: c.eligibility?.batch || '',
    },
});

// Build the eligibility payload, omitting blank fields so an empty form means
// "no criteria" (open to all) rather than zeroed-out cutoffs.
const buildEligibility = (elig) => {
    const out = {};
    for (const [k] of ELIG_NUM) { if (elig[k] !== '' && elig[k] !== null) out[k] = Number(elig[k]); }
    const branches = (elig.eligibleBranches || '').split(',').map((s) => s.trim()).filter(Boolean);
    if (branches.length) out.eligibleBranches = branches;
    if (elig.batch && elig.batch.trim()) out.batch = elig.batch.trim();
    return Object.keys(out).length ? out : undefined;
};

const ELIG_STATE = {
    eligible: { icon: <FiCheckCircle />, cls: 'badge-success', label: 'Eligible' },
    no: { icon: <FiXCircle />, cls: 'badge-danger', label: 'Not eligible' },
    unknown: { icon: <FiAlertCircle />, cls: 'badge-warning', label: 'Complete profile' },
};

const Companies = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const isManager = user?.role === 'admin' || user?.role === 'mentor';
    const [companies, setCompanies] = useState([]);
    const [eligibility, setEligibility] = useState({});
    const [modal, setModal] = useState(null); // null | { mode:'add' } | { mode:'edit', id }
    const [form, setForm] = useState(emptyForm());
    const [loading, setLoading] = useState(true);
    const [track, setTrack] = useState(null);
    const [trackLoading, setTrackLoading] = useState(false);

    const fetchAll = useCallback(async () => {
        setLoading(true);
        const r = await getCompanies();
        setCompanies(r.data.companies || []);
        setLoading(false);
        try { const e = await getMyEligibility(); setEligibility(e.data.eligibility || {}); } catch { /* best-effort */ }
    }, []);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load-on-mount is the app-wide data pattern
    useEffect(() => { fetchAll(); }, [fetchAll]);

    const openTrack = async (c) => {
        setTrack({ company: c, problems: null });
        setTrackLoading(true);
        try { const { data } = await getCompanyTrack(c._id); setTrack(data); }
        catch { setTrack({ company: c, problems: [], solvedCount: 0, totalCount: 0 }); }
        setTrackLoading(false);
    };

    const openAdd = () => { setForm(emptyForm()); setModal({ mode: 'add' }); };
    const openEdit = (c) => { setForm(formFromCompany(c)); setModal({ mode: 'edit', id: c._id }); };

    const submit = async (e) => {
        e.preventDefault();
        const payload = {
            name: form.name, description: form.description, interviewPattern: form.interviewPattern,
            difficultyLevel: form.difficultyLevel, eligibility: buildEligibility(form.elig),
        };
        if (modal.mode === 'edit') await updateCompany(modal.id, payload);
        else await createCompany(payload);
        setModal(null);
        fetchAll();
    };

    const handleDelete = async (id) => { await deleteCompany(id); fetchAll(); };

    const setElig = (k, v) => setForm((f) => ({ ...f, elig: { ...f.elig, [k]: v } }));

    return (
        <div className="page">
            <PageHero
                eyebrow="Target"
                title="Companies"
                subtitle="Know each company's interview pattern and whether you're eligible before you walk in."
                icon={<FiBriefcase />}
                actions={isManager && <button className="btn btn-action" onClick={openAdd}><FiPlus /> Add</button>}
            />
            {loading ? <SkeletonGrid count={6} cols={3} /> : (
                <div className="grid grid-3">
                    {companies.map((c, i) => {
                        const e = eligibility[c._id];
                        const state = !e || !e.hasCriteria ? null : e.eligible ? 'eligible' : e.unknown ? 'unknown' : 'no';
                        const badge = state ? ELIG_STATE[state] : null;
                        const note = e?.reasons?.length ? e.reasons.join('; ') : e?.missing?.length ? `Add to your profile: ${e.missing.join(', ')}` : '';
                        return (
                            <Reveal as="div" key={c._id} i={i} className="glass-card spotlight">
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                                        <span className="company-emblem">{c.name?.[0]?.toUpperCase() || 'C'}</span>
                                        <h3 style={{ fontSize: 18, fontWeight: 700 }}>{c.name}</h3>
                                    </div>
                                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                                        {isManager && <button className="icon-btn" onClick={() => openEdit(c)} aria-label="Edit"><FiEdit2 /></button>}
                                        {user?.role === 'admin' && <button className="icon-btn" style={{ color: 'var(--accent-danger)' }} onClick={() => handleDelete(c._id)}><FiTrash2 /></button>}
                                    </div>
                                </div>
                                {badge && (
                                    <div style={{ marginTop: 10 }}>
                                        <span className={`badge ${badge.cls}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>{badge.icon} {badge.label}</span>
                                        {note && <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 6 }}>{note}</p>}
                                    </div>
                                )}
                                {c.description && <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '10px 0' }}>{c.description}</p>}
                                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                                    {c.interviewPattern && <div className="chip"><FiClipboard /> {c.interviewPattern}</div>}
                                    {c.difficultyLevel && <div className="chip"><FiZap /> {c.difficultyLevel}</div>}
                                </div>
                                <button className="btn btn-secondary btn-sm" style={{ width: '100%', marginTop: 12 }} onClick={() => openTrack(c)}><FiTarget /> Prep Track</button>
                            </Reveal>
                        );
                    })}
                </div>
            )}

            {modal && (
                <Modal onClose={() => setModal(null)} size="lg">
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
                        <h2>{modal.mode === 'edit' ? 'Edit Company' : 'Add Company'}</h2>
                        <button className="icon-btn" onClick={() => setModal(null)}><FiX /></button>
                    </div>
                    <form onSubmit={submit}>
                        <div className="form-group"><label>Name</label><input className="form-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
                        <div className="form-group"><label>Description</label><textarea className="form-textarea" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
                        <div className="grid grid-2" style={{ gap: 12 }}>
                            <div className="form-group"><label>Interview Pattern</label><input className="form-input" value={form.interviewPattern} onChange={(e) => setForm({ ...form, interviewPattern: e.target.value })} placeholder="e.g. Coding + HR + GD" /></div>
                            <div className="form-group"><label>Difficulty</label><input className="form-input" value={form.difficultyLevel} onChange={(e) => setForm({ ...form, difficultyLevel: e.target.value })} placeholder="Easy / Medium / Hard" /></div>
                        </div>

                        <h3 style={{ fontSize: 14, fontWeight: 700, margin: '12px 0 8px' }}>Eligibility (optional)</h3>
                        <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 10 }}>Leave a field blank to not enforce it. Empty = open to all.</p>
                        <div className="grid grid-2" style={{ gap: 12 }}>
                            {ELIG_NUM.map(([k, label]) => (
                                <div className="form-group" key={k}><label>{label}</label><input className="form-input" type="number" step="any" value={form.elig[k]} onChange={(e) => setElig(k, e.target.value)} /></div>
                            ))}
                            <div className="form-group"><label>Batch</label><input className="form-input" value={form.elig.batch} onChange={(e) => setElig('batch', e.target.value)} placeholder="e.g. 2026" /></div>
                            <div className="form-group" style={{ gridColumn: '1 / -1' }}><label>Eligible branches (comma-separated)</label><input className="form-input" value={form.elig.eligibleBranches} onChange={(e) => setElig('eligibleBranches', e.target.value)} placeholder="CSE, IT, ECE — blank for all" /></div>
                        </div>

                        <button className="btn btn-primary" style={{ width: '100%', marginTop: 6 }}>{modal.mode === 'edit' ? 'Save Changes' : 'Add Company'}</button>
                    </form>
                </Modal>
            )}

            {track && (
                <Modal onClose={() => setTrack(null)} size="lg">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <span className="company-emblem">{track.company?.name?.[0]?.toUpperCase() || 'C'}</span>
                            <div>
                                <h2 style={{ fontSize: 20 }}>{track.company?.name} Prep Track</h2>
                                {typeof track.solvedCount === 'number' && track.totalCount > 0 && (
                                    <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{track.solvedCount}/{track.totalCount} tagged problems solved</p>
                                )}
                            </div>
                        </div>
                        <button className="icon-btn" onClick={() => setTrack(null)}><FiX /></button>
                    </div>

                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
                        {track.company?.interviewPattern && <div className="chip"><FiClipboard /> {track.company.interviewPattern}</div>}
                        {track.company?.difficultyLevel && <div className="chip"><FiZap /> {track.company.difficultyLevel}</div>}
                    </div>

                    {trackLoading ? <div className="spinner" /> : (
                        <>
                            <h3 style={{ fontSize: 14, marginBottom: 10 }}>Tagged coding problems</h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                {(track.problems || []).map((p) => (
                                    <div
                                        key={p._id}
                                        className="card card-clickable"
                                        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '10px 14px', cursor: 'pointer' }}
                                        onClick={() => navigate('/coding-questions')}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                                            <FiCheckCircle style={{ flexShrink: 0, color: p.solved ? 'var(--accent-success, #10b981)' : 'var(--border, #334155)' }} />
                                            <span style={{ fontSize: 14, fontWeight: p.solved ? 600 : 400 }}>{p.title}</span>
                                            {p.topic && <span className="chip" style={{ fontSize: 11 }}>{p.topic}</span>}
                                        </div>
                                        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
                                            {!p.gradeable && <span className="chip" style={{ fontSize: 10 }}>run-only</span>}
                                            <span className={`badge ${diffColors[p.difficulty] || ''}`}>{p.difficulty}</span>
                                        </div>
                                    </div>
                                ))}
                                {(!track.problems || track.problems.length === 0) && (
                                    <div className="empty-state"><p>No problems tagged for this company yet.</p></div>
                                )}
                            </div>
                        </>
                    )}
                </Modal>
            )}
        </div>
    );
};

export default Companies;
